'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Clock, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface Finding {
  type: 'positive' | 'warning' | 'neutral';
  icon: string;
  title: string;
  detail: string;
}

interface Suggestion {
  icon: string;
  action: string;
  reason: string;
}

interface DigestData {
  has_data: boolean;
  status_summary: string;
  status_emoji?: string;
  findings: Finding[];
  suggestions: Suggestion[];
  encouragement: string;
}

interface CachedDigest {
  data: DigestData;
  timestamp: number;
}

const CACHE_KEY = 'daily_digest_cache';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

const findingTypeConfig = {
  positive: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  },
  warning: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  },
  neutral: {
    border: 'border-[var(--border)]',
    bg: 'bg-[var(--glass-bg)]',
    icon: <Info className="w-4 h-4 text-[var(--text-tertiary)]" />,
  },
};

export default function DailyDigest({ className = '' }: { className?: string }) {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data: cachedData, timestamp }: CachedDigest = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setData(cachedData);
          setLastUpdated(new Date(timestamp));
          setInitialized(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchDigest = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: d, timestamp }: CachedDigest = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setData(d);
            setLastUpdated(new Date(timestamp));
            setInitialized(true);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ai/daily-digest');
      if (res.ok) {
        const digest = await res.json();
        setData(digest);
        const now = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: digest, timestamp: now }));
        setLastUpdated(new Date(now));
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  const formatTime = () => {
    if (!lastUpdated) return '';
    const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    return `${Math.floor(mins / 60)}小时前`;
  };

  // Not initialized and no cache - show generate button
  if (!initialized && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <Header />
        <div className="text-center py-10">
          <div className="text-5xl mb-4">🔮</div>
          <p className="text-[var(--text-secondary)] mb-1">AI 综合洞察</p>
          <p className="text-xs text-[var(--text-tertiary)] mb-5">基于你的生活数据，一键生成今日分析报告</p>
          <button
            onClick={() => fetchDigest(true)}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 text-[var(--text-primary)] hover:border-purple-500/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />生成中...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" />生成洞察</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <Header />
        <div className="text-center py-10">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">AI 正在分析你的数据...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <Header />
        <div className="text-center py-10">
          <div className="text-4xl mb-3">😅</div>
          <p className="text-[var(--text-secondary)] mb-4">生成失败，请稍后重试</p>
          <button
            onClick={() => fetchDigest(true)}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />重试</span>
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">今日洞察</h3>
          {lastUpdated && (
            <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatTime()}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchDigest(true)}
          disabled={loading}
          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          aria-label="刷新洞察"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Summary */}
      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-purple-500/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{data.status_emoji || '📊'}</span>
          <p className="text-[var(--text-primary)] font-medium leading-relaxed">{data.status_summary}</p>
        </div>
      </div>

      {/* Findings */}
      {data.findings && data.findings.length > 0 && (
        <div className="space-y-2.5 mb-5">
          <h4 className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1">关键发现</h4>
          {data.findings.map((f, i) => {
            const config = findingTypeConfig[f.type] || findingTypeConfig.neutral;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3.5 rounded-xl border ${config.border} ${config.bg} transition-colors`}
              >
                <span className="text-xl mt-0.5">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{f.title}</span>
                    {config.icon}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2">行动建议</h4>
          <div className="grid gap-2">
            {data.suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                <span className="text-lg">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{s.action}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encouragement */}
      {data.encouragement && (
        <div className="pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-secondary)] text-center italic">
            {data.encouragement}
          </p>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
        <Sparkles className="w-4 h-4 text-purple-400" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">今日洞察</h3>
    </div>
  );
}
