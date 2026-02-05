'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'markdown';
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
      // 获取推荐问题
      fetchSuggestions();
      // 添加欢迎消息
      setMessages([
        {
          role: 'assistant',
          content: '👋 你好！我是你的生活数据助手。\n\n我可以帮你分析睡眠、心情、运动等数据，也可以生成总结和给出建议。\n\n试试问我"今天怎么样"或点击下方的推荐问题吧！',
          type: 'markdown',
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/chat/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      type: 'text',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.content,
          type: data.type || 'text',
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '抱歉，出了点问题。请稍后再试。',
            type: 'text',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '网络错误，请检查连接后重试。',
          type: 'text',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 shadow-lg hover:shadow-xl transition-all z-40 flex items-center justify-center ${
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
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white/90">AI 助手</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-500/30 to-cyan-500/30 text-white'
                    : 'bg-white/5 text-white/80'
                }`}
              >
                {msg.type === 'markdown' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc ml-4 mb-2">{children}</ul>
                        ),
                        li: ({ children }) => (
                          <li className="mb-1">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-white font-semibold">
                            {children}
                          </strong>
                        ),
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

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
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
              {suggestions.slice(0, 4).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(s.text)}
                  className="px-3 py-1.5 text-xs rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                >
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="问我任何关于你生活数据的问题..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-gradient-to-r from-purple-500/30 to-cyan-500/30 border border-white/10 hover:border-purple-500/30 disabled:opacity-50 transition-all"
            >
              <Send className="w-5 h-5 text-white/80" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
