'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, Plus, MessageCircle, Clock, RotateCcw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ======= 类型 =======

interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ======= API helpers =======

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

async function apiPatch(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

// ======= 组件 =======

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // ref 用来追踪当前 activeId，避免闭包问题
  const activeIdRef = useRef<string | null>(null);

  // ======= 加载会话列表 =======
  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiGet<{ conversations: ConversationItem[] }>('/api/chat/conversations');
      setConversations(data.conversations);
      return data.conversations;
    } catch (err) {
      console.error('加载会话列表失败:', err);
      return [];
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  // ======= 加载单个会话的消息 =======
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiGet<{
        id: string;
        title: string;
        messages: Message[];
      }>(`/api/chat/conversations/${convId}`);
      // 只有当仍然是当前活跃会话时才更新
      if (activeIdRef.current === convId) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('加载消息失败:', err);
      if (activeIdRef.current === convId) {
        setMessages([]);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ======= 初始化 =======
  useEffect(() => {
    (async () => {
      const convs = await fetchConversations();
      if (convs.length > 0) {
        setActiveId(convs[0].id);
        activeIdRef.current = convs[0].id;
      }
    })();
  }, [fetchConversations]);

  // ======= 切换会话时加载消息 =======
  useEffect(() => {
    activeIdRef.current = activeId;
    if (activeId) {
      fetchMessages(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, fetchMessages]);

  // ======= 滚动到底部 =======
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, loading]);

  // ======= 操作 =======

  const createNewChat = useCallback(async () => {
    try {
      const data = await apiPost<{ id: string; title: string }>('/api/chat/conversations', {
        title: '新对话',
      });
      // 在列表头部插入新会话
      setConversations((prev) => [
        {
          id: data.id,
          title: data.title,
          updated_at: new Date().toISOString(),
          message_count: 0,
        },
        ...prev,
      ]);
      setActiveId(data.id);
      setMessages([]);
      setInput('');
    } catch (err) {
      console.error('创建会话失败:', err);
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDelete(`/api/chat/conversations/${id}`);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          setConversations((prev) => {
            const next = prev.find((c) => c.id !== id);
            setActiveId(next?.id || null);
            return prev;
          });
        }
      } catch (err) {
        console.error('删除会话失败:', err);
      }
    },
    [activeId]
  );

  // ======= 发送消息（流式） =======

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    setInput('');
    setLoading(true);
    setStreamingContent('');

    // 乐观更新：先在本地显示用户消息
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          message: text,
          conversation_id: activeId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMsg: Message = {
          id: `temp-err-${Date.now()}`,
          role: 'assistant',
          content: `抱歉，出了点问题 (${res.status})。${errData.detail || ''}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-err-${Date.now()}`,
            role: 'assistant',
            content: '流式连接失败',
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let newConvId: string | null = null;
      let hasError = false;

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

            // 处理 meta 事件（第一个 data，包含 conversation_id）
            if (data.conversation_id) {
              newConvId = data.conversation_id;
              if (data.is_new) {
                // 新会话：更新 activeId 和会话列表
                setActiveId(data.conversation_id);
                activeIdRef.current = data.conversation_id;
                setConversations((prev) => [
                  {
                    id: data.conversation_id,
                    title: data.title || '新对话',
                    updated_at: new Date().toISOString(),
                    message_count: 1,
                  },
                  ...prev,
                ]);
              }
              continue;
            }

            // 处理错误事件
            if (data.error) {
              hasError = true;
              // 清空 streaming 状态
              setStreamingContent('');
              // 添加错误消息
              const errorMsg: Message = {
                id: `temp-err-${Date.now()}`,
                role: 'assistant',
                content: data.error || 'AI 响应失败，请稍后重试',
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, errorMsg]);
              // 清空 accumulated 避免在 finally 中重复添加
              accumulated = '';
              break;
            }

            if (data.done) break;
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // 流结束后：用最终内容替换 streaming 状态
      setStreamingContent('');
      if (accumulated && !hasError) {
        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulated,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else if (!hasError) {
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-err-${Date.now()}`,
            role: 'assistant',
            content: 'AI 未返回内容，请重试。',
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // 刷新会话列表以更新排序和标题
      fetchConversations();
    } catch (err) {
      console.error('Chat stream error:', err);
      setStreamingContent('');
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-err-${Date.now()}`,
          role: 'assistant',
          content: '网络错误，请检查连接后重试。',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const retryLast = () => {
    if (messages.length === 0) return;
    // 找到最后一条 user 消息
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const lastUser = messages[messages.length - 1 - lastUserIdx];
    // 移除最后一条 assistant 回复（如果有）
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') copy.pop();
      if (copy.length > 0 && copy[copy.length - 1].role === 'user') copy.pop();
      return copy;
    });
    setTimeout(() => sendMessage(lastUser.content), 100);
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

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const activeConv = conversations.find((c) => c.id === activeId) || null;

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
            {loadingConvs && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
              </div>
            )}
            {!loadingConvs && conversations.length === 0 && (
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
                    {formatTime(conv.updated_at)}
                    <span className="ml-auto">{conv.message_count} 条</span>
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
          {/* 加载消息中 */}
          {loadingMessages && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          )}

          {/* 空状态：推荐问题 */}
          {!loadingMessages && messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">AI 生活助手</h2>
                <p className="text-sm text-[var(--text-tertiary)] max-w-md">
                  基于你的所有生活记录，提供智能分析、趋势洞察和个性化建议。对话历史永久保存在服务器。
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
          {!loadingMessages && (messages.length > 0 || loading) && (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-[var(--text-primary)]'
                        : 'bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.content ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* 正在流式生成的 assistant 消息 */}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-5 py-3.5 bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {streamingContent ? (
                      <MarkdownContent content={streamingContent} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">AI 思考中...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 重试按钮 */}
              {!loading &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === 'assistant' &&
                (messages[messages.length - 1]?.content.includes('抱歉') ||
                  messages[messages.length - 1]?.content.includes('网络错误') ||
                  messages[messages.length - 1]?.content.includes('重试')) && (
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

// ======= Markdown 渲染子组件 =======

function MarkdownContent({ content }: { content: string }) {
  return (
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
          h1: ({ children }) => (
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{children}</h5>
          ),
          code: ({ children }) => (
            <code className="text-xs bg-[var(--bg-secondary)] px-1 py-0.5 rounded">{children}</code>
          ),
          hr: () => <hr className="border-[var(--border)] my-2" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
