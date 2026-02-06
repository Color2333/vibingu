'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, Plus, MessageCircle, Clock, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ======= 类型 =======

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ======= localStorage 持久化 =======

const STORAGE_KEY = 'vibingu_chat_conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ======= 组件 =======

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化：从 localStorage 加载
  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    if (loaded.length > 0) {
      setActiveId(loaded[0].id);
    }
  }, []);

  // 持久化
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeId, loading]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  // ======= 操作 =======

  const createNewChat = useCallback(() => {
    const newConv: Conversation = {
      id: generateId(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setInput('');
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      saveConversations(filtered);
      return filtered;
    });
    if (activeId === id) {
      setActiveId(conversations.length > 1 ? conversations.find(c => c.id !== id)?.id || null : null);
    }
  }, [activeId, conversations]);

  const buildHistory = useCallback((): { role: string; content: string }[] => {
    if (!activeConv) return [];
    return activeConv.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [activeConv]);

  // ======= 发送消息（流式） =======

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // 如果没有活跃对话，自动创建一个
    let targetId = activeId;
    if (!targetId) {
      const newConv: Conversation = {
        id: generateId(),
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations((prev) => [newConv, ...prev]);
      targetId = newConv.id;
      setActiveId(targetId);
    }

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };

    // 添加消息
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              messages: [...c.messages, userMsg, assistantMsg],
              updatedAt: Date.now(),
              title: c.messages.length === 0 ? text.slice(0, 20) + (text.length > 20 ? '...' : '') : c.title,
            }
          : c
      )
    );
    setInput('');
    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const history = buildHistory();

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        updateLastAssistant(targetId, `抱歉，出了点问题 (${res.status})。${errData.detail || ''}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        updateLastAssistant(targetId, '流式连接失败');
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done) break;
            if (data.content) {
              accumulated += data.content;
              updateLastAssistant(targetId, accumulated);
            }
          } catch {
            // skip
          }
        }
      }

      if (!accumulated) {
        updateLastAssistant(targetId, 'AI 未返回内容，请重试。');
      }
    } catch (err) {
      console.error('Chat stream error:', err);
      updateLastAssistant(targetId, '网络错误，请检查连接后重试。');
    } finally {
      setLoading(false);
    }
  };

  const updateLastAssistant = (convId: string, content: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
        }
        return { ...c, messages: msgs, updatedAt: Date.now() };
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const retryLast = () => {
    if (!activeConv) return;
    const lastUser = [...activeConv.messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      // 移除最后一条 assistant 回复
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
          return { ...c, messages: msgs };
        })
      );
      setTimeout(() => sendMessage(lastUser.content), 100);
    }
  };

  // ======= 推荐问题 =======
  const suggestions = [
    { text: '今天怎么样？', icon: '📊' },
    { text: '本周总结', icon: '📈' },
    { text: '我的睡眠情况', icon: '😴' },
    { text: '给我一些建议', icon: '💡' },
    { text: '最近状态趋势', icon: '📉' },
    { text: '最好的一天是哪天？', icon: '🏆' },
  ];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // ======= 渲染 =======

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] -mx-4 -my-6 md:-my-8 overflow-hidden">
      {/* 左侧会话列表 */}
      <div
        className={`${
          showSidebar ? 'w-64' : 'w-0'
        } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)]/50`}
      >
        <div className="w-64 h-full flex flex-col">
          {/* 新建对话按钮 */}
          <div className="p-3 border-b border-[var(--border)]">
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 hover:border-purple-500/50 text-[var(--text-primary)] transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              新对话
            </button>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 && (
              <div className="text-center text-[var(--text-tertiary)] text-xs py-8">
                还没有对话记录
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeId === conv.id
                    ? 'bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20'
                    : 'hover:bg-[var(--glass-bg)]'
                }`}
                onClick={() => setActiveId(conv.id)}
              >
                <MessageCircle className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate">{conv.title}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(conv.updatedAt)}
                    <span className="ml-auto">{conv.messages.filter((m) => m.role === 'user').length} 条</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
            title={showSidebar ? '收起会话列表' : '展开会话列表'}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-[var(--text-primary)]">
              {activeConv ? activeConv.title : 'AI 对话'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
              流式 LLM
            </span>
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {/* 空状态：推荐问题 */}
          {(!activeConv || activeConv.messages.length === 0) && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">AI 生活助手</h2>
                <p className="text-sm text-[var(--text-tertiary)] max-w-md">
                  基于你的所有生活记录，提供智能分析、趋势洞察和个性化建议。对话历史会自动保存。
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(s.text)}
                    className="px-4 py-2 text-sm rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] transition-all"
                  >
                    {s.icon} {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {activeConv && activeConv.messages.length > 0 && (
            <div className="max-w-3xl mx-auto space-y-6">
              {activeConv.messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-[var(--text-primary)]'
                        : 'bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.content ? (
                      <div className="prose prose-sm max-w-none text-[var(--text-secondary)]">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => (
                              <strong className="text-[var(--text-primary)] font-semibold">{children}</strong>
                            ),
                            h1: ({ children }) => <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">{children}</h3>,
                            h2: ({ children }) => <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">{children}</h4>,
                            h3: ({ children }) => <h5 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{children}</h5>,
                            code: ({ children }) => (
                              <code className="text-xs bg-[var(--bg-secondary)] px-1 py-0.5 rounded">{children}</code>
                            ),
                            hr: () => <hr className="border-[var(--border)] my-2" />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : msg.role === 'assistant' && !msg.content ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">AI 思考中...</span>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* 重试按钮 */}
              {!loading &&
                activeConv.messages.length > 0 &&
                activeConv.messages[activeConv.messages.length - 1]?.role === 'assistant' &&
                (activeConv.messages[activeConv.messages.length - 1]?.content.includes('抱歉') ||
                  activeConv.messages[activeConv.messages.length - 1]?.content.includes('网络错误') ||
                  activeConv.messages[activeConv.messages.length - 1]?.content.includes('重试')) && (
                  <div className="flex justify-start pl-2">
                    <button
                      onClick={retryLast}
                      className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      重试
                    </button>
                  </div>
                )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 px-4 py-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问我任何关于你生活数据的问题..."
              disabled={loading}
              className="flex-1 bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="发送消息"
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/30 to-cyan-500/30 border border-[var(--border)] hover:border-purple-500/30 disabled:opacity-50 transition-all"
            >
              <Send className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
