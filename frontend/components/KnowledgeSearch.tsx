'use client';

import { useState } from 'react';
import { Search, Database, Sparkles, Calendar, Tag } from 'lucide-react';

interface SearchResult {
  id: string;
  document: string;
  metadata: {
    date?: string;
    category?: string;
    tags?: string;
  };
  relevance: number;
}

interface SimilarDay {
  date: string;
  similarity_score: number;
  sample_content: string[];
}

interface Props {
  className?: string;
}

export default function KnowledgeSearch({ className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'ask' | 'similar'>('ask');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [similarDays, setSimilarDays] = useState<SimilarDay[]>([]);
  const [stats, setStats] = useState<{ indexed_count: number; database_count: number } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResults([]);
    setAnswer(null);
    setSimilarDays([]);
    
    try {
      if (mode === 'search') {
        const res = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}&n=5`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } else if (mode === 'ask') {
        const res = await fetch(`/api/rag/ask?q=${encodeURIComponent(query)}&n=5`);
        if (res.ok) {
          const data = await res.json();
          setAnswer(data.answer);
          setResults(data.sources || []);
        }
      } else if (mode === 'similar') {
        const res = await fetch(`/api/rag/similar-days?date=${query}&n=5`);
        if (res.ok) {
          const data = await res.json();
          setSimilarDays(data.similar_days || []);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIndex = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rag/index/all', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`索引完成！已索引 ${data.indexed} 条记录。`);
        fetchStats();
      }
    } catch (error) {
      console.error('Index failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/rag/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Fetch stats on mount
  useState(() => {
    fetchStats();
  });

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      SLEEP: 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-300',
      DIET: 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-300',
      ACTIVITY: 'bg-orange-500/20 text-orange-500 dark:text-orange-300',
      MOOD: 'bg-pink-500/20 text-pink-500 dark:text-pink-300',
      SOCIAL: 'bg-purple-500/20 text-purple-500 dark:text-purple-300',
      WORK: 'bg-slate-500/20 text-slate-500 dark:text-slate-300',
      GROWTH: 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-300',
      LEISURE: 'bg-amber-500/20 text-amber-500 dark:text-amber-300',
    };
    return colors[category || ''] || 'bg-[var(--glass-bg)] text-[var(--text-tertiary)]';
  };

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">个人知识库</h3>
        </div>
        {stats && (
          <span className="text-xs text-[var(--text-tertiary)]">
            已索引 {stats.indexed_count} / {stats.database_count}
          </span>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('ask')}
          className={`flex-1 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-1 ${
            mode === 'ask'
              ? 'bg-purple-500/20 text-purple-500 dark:text-purple-300 border border-purple-500/30'
              : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] border border-transparent'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          智能问答
        </button>
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-1 ${
            mode === 'search'
              ? 'bg-purple-500/20 text-purple-500 dark:text-purple-300 border border-purple-500/30'
              : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] border border-transparent'
          }`}
        >
          <Search className="w-3 h-3" />
          语义搜索
        </button>
        <button
          onClick={() => setMode('similar')}
          className={`flex-1 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-1 ${
            mode === 'similar'
              ? 'bg-purple-500/20 text-purple-500 dark:text-purple-300 border border-purple-500/30'
              : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] border border-transparent'
          }`}
        >
          <Calendar className="w-3 h-3" />
          相似日
        </button>
      </div>

      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <input
          type={mode === 'similar' ? 'date' : 'text'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={
            mode === 'ask'
              ? '问我任何关于你生活的问题...'
              : mode === 'search'
              ? '搜索关键词或描述...'
              : '选择日期查找相似的日子'
          }
          className="flex-1 bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-500 dark:text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 transition-all"
        >
          {loading ? '...' : <Search className="w-5 h-5" />}
        </button>
      </div>

      {/* AI Answer */}
      {answer && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-500 dark:text-purple-300">AI 回答</span>
          </div>
          <p className="text-[var(--text-primary)] text-sm whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-tertiary)] mb-2">
            {mode === 'ask' ? '参考来源' : '搜索结果'}
          </div>
          {results.map((result, idx) => (
            <div
              key={result.id || idx}
              className="p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--border)]"
            >
              <div className="flex items-center gap-2 mb-1">
                {result.metadata.date && (
                  <span className="text-xs text-[var(--text-tertiary)]">{result.metadata.date}</span>
                )}
                {result.metadata.category && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(
                      result.metadata.category
                    )}`}
                  >
                    {result.metadata.category}
                  </span>
                )}
                <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                  相关度: {(result.relevance * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                {result.document.slice(0, 150)}
                {result.document.length > 150 && '...'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Similar Days */}
      {similarDays.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-tertiary)] mb-2">相似的日子</div>
          {similarDays.map((day, idx) => (
            <div
              key={day.date}
              className="p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--border)]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">{day.date}</span>
                <span className="text-xs text-purple-500 dark:text-purple-400">
                  相似度: {(day.similarity_score * 100).toFixed(0)}%
                </span>
              </div>
              {day.sample_content && day.sample_content.length > 0 && (
                <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">
                  {day.sample_content.join(' | ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Index button */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <button
          onClick={handleIndex}
          disabled={loading}
          className="w-full py-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {loading ? '索引中...' : '🔄 重新索引所有记录'}
        </button>
      </div>
    </div>
  );
}
