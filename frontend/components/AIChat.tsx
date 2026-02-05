'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  RefreshCw, 
  ChevronDown,
  Lightbulb,
  HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    date: string;
    category: string;
    preview: string;
    relevance: number;
  }>;
  timestamp: Date;
}

interface Props {
  className?: string;
}

// 预设问题建议
const SUGGESTED_QUESTIONS = [
  "我最近的睡眠质量怎么样？",
  "我上周的运动情况如何？",
  "我最近心情如何？有什么规律？",
  "什么时候我的状态最好？",
  "我应该如何改善作息？",
];

export default function AIChat({ className = '' }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息
  const handleSend = async (text?: string) => {
    const question = text || input.trim();
    if (!question || loading) return;

    setInput('');
    setShowSuggestions(false);

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // 构建对话历史
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: history.slice(-6), // 最近6条
          n_context: 7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('API 请求失败');
      }
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，处理你的问题时出错了。请稍后重试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 清空对话
  const handleClear = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  // 点击建议问题
  const handleSuggestion = (question: string) => {
    handleSend(question);
  };

  return (
    <div className={`glass-card flex flex-col h-[500px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">AI 生活助手</h3>
            <p className="text-[10px] text-white/40">基于你的生活数据回答问题</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="清空对话"
        >
          <RefreshCw className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && showSuggestions && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <HelpCircle className="w-6 h-6 text-violet-400" />
            </div>
            <h4 className="text-white/80 font-medium mb-2">有什么想问的？</h4>
            <p className="text-xs text-white/40 mb-4 max-w-xs">
              我可以基于你的生活记录回答问题，发现模式，给出建议
            </p>
            
            {/* 建议问题 */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-1 text-xs text-white/40 mb-2">
                <Lightbulb className="w-3 h-3" />
                试试这些问题
              </div>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(q)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white/90 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-violet-500/20 border border-violet-500/30 rounded-2xl rounded-br-md'
                  : 'bg-white/5 border border-white/10 rounded-2xl rounded-bl-md'
              } px-4 py-3`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-white/90">{msg.content}</p>
              )}
              
              {/* 来源展示 */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 mb-2">
                    <ChevronDown className="w-3 h-3" />
                    参考了 {msg.sources.length} 条记录
                  </div>
                  <div className="space-y-1">
                    {msg.sources.slice(0, 3).map((source, i) => (
                      <div
                        key={i}
                        className="text-[10px] text-white/40 flex items-center gap-2"
                      >
                        <span className="text-white/50">{source.date}</span>
                        <span className="px-1 py-0.5 rounded bg-white/10 text-white/50">
                          {source.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-1 text-[10px] text-white/30">
                {msg.timestamp.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white/60" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="问我任何关于你生活的问题..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-violet-500/30 to-purple-500/30 border border-violet-500/30 rounded-xl text-violet-300 hover:from-violet-500/40 hover:to-purple-500/40 disabled:opacity-50 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
