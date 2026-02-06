'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, X, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  text: string;
  icon: string;
}

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      fetchSuggestions();
      setMessages([
        {
          role: 'assistant',
          content:
            '👋 你好！我是你的 AI 生活助手。\n\n我可以基于你的所有记录进行智能分析，包括：\n- 📊 数据总结（今天/本周/本月）\n- 😴 睡眠、心情、运动分析\n- 📈 状态趋势洞察\n- 💡 个性化建议\n\n直接问我任何问题，或点击下方推荐吧！',
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/chat/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  };

  // 构建对话历史（不含系统消息和首条欢迎语）
  const buildHistory = useCallback((): { role: string; content: string }[] => {
    // 跳过第一条欢迎消息
    return messages.slice(1).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          history: buildHistory(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.content },
        ]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `抱歉，出了点问题 (${res.status})。${errData.detail || '请稍后再试。'}`,
          },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '网络错误，请检查连接后重试。' },
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

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '对话已清空，有什么新问题可以继续问我！✨',
      },
    ]);
  };

  const retryLast = () => {
    // 找到最后一条用户消息，重新发送
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      // 移除最后一条 assistant 回复
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
          copy.pop();
        }
        return copy;
      });
      setTimeout(() => sendMessage(lastUser.content), 100);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="打开 AI 助手"
        className={`fixed bottom-28 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 shadow-lg hover:shadow-xl transition-all z-40 flex items-center justify-center ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] glass-card rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'scale-100 opacity-100'
            : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-[var(--text-primary)]">AI 助手</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">LLM</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              aria-label="清空对话"
              className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
              title="清空对话"
            >
              <Trash2 className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="关闭对话"
              className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-[var(--text-primary)]'
                    : 'bg-[var(--glass-bg)] text-[var(--text-secondary)]'
                }`}
              >
                {msg.role === 'assistant' ? (
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
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--glass-bg)] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">AI 正在分析你的数据...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && suggestions.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 6).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(s.text)}
                  className="px-3 py-1.5 text-xs rounded-full bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
                >
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Retry hint if last message was an error */}
        {messages.length > 1 &&
          !loading &&
          messages[messages.length - 1]?.role === 'assistant' &&
          (messages[messages.length - 1]?.content.includes('抱歉') ||
            messages[messages.length - 1]?.content.includes('网络错误')) && (
            <div className="px-4 pb-1">
              <button
                onClick={retryLast}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重试
              </button>
            </div>
          )}

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问我任何关于你生活数据的问题..."
              className="flex-1 bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="发送消息"
              className="p-2 rounded-xl bg-gradient-to-r from-purple-500/30 to-cyan-500/30 border border-[var(--border)] hover:border-purple-500/30 disabled:opacity-50 transition-all"
            >
              <Send className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
