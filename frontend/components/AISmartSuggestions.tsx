'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, Target, RefreshCw, Zap, Heart, Clock } from 'lucide-react';

interface Suggestion {
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'high' | 'medium' | 'low';
  emoji: string;
}

interface SuggestionsData {
  focus_area: string | null;
  focus_reason: string | null;
  suggestions: Suggestion[];
  encouragement: string;
}

interface CachedData {
  data: SuggestionsData;
  timestamp: number;
}

interface Props {
  className?: string;
}

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '挑战',
};

const impactColors = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
};

const categoryIcons: Record<string, React.ReactNode> = {
  sleep: <span>😴</span>,
  activity: <span>🏃</span>,
  screen: <span>📱</span>,
  mood: <span>😊</span>,
  diet: <span>🍎</span>,
  social: <span>👥</span>,
};

const CACHE_KEY = 'ai_suggestions_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

export default function AISmartSuggestions({ className = '' }: Props) {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(false);

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    setError(false);
    
    // 检查缓存
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp }: CachedData = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < CACHE_DURATION) {
            setData(cachedData);
            setLastUpdated(new Date(timestamp));
            setLoading(false);
            setInitialized(true);
            return;
          }
        }
      } catch (e) {
        console.error('Cache read error:', e);
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/suggestions');
      if (res.ok) {
        const suggestions = await res.json();
        setData(suggestions);
        
        // 保存缓存
        const cacheData: CachedData = { data: suggestions, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        setLastUpdated(new Date());
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to fetch AI suggestions:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialized(true);
    }
  }, []);

  // 只在组件挂载时检查缓存，不自动请求 API
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data: cachedData, timestamp }: CachedData = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < CACHE_DURATION) {
          setData(cachedData);
          setLastUpdated(new Date(timestamp));
          setInitialized(true);
        }
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSuggestions(true);
  };
  
  const handleGenerate = () => {
    fetchSuggestions(true);
  };
  
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const diff = Date.now() - lastUpdated.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return lastUpdated.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 未初始化且没有缓存 - 显示生成按钮
  if (!initialized && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💡</div>
          <p className="text-white/50 mb-4">点击生成个性化 AI 建议</p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                生成建议
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 加载中
  if (loading && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-white/50">正在生成建议...</p>
          <p className="text-xs text-white/30 mt-1">AI 正在分析你的数据</p>
        </div>
      </div>
    );
  }

  // 错误状态 - 显示重试按钮
  if (error && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">😅</div>
          <p className="text-white/60 mb-2">生成失败</p>
          <p className="text-xs text-white/40 mb-4">可能是网络问题或 AI 服务繁忙</p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              重试
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <p className="text-white/50 text-center py-4">暂无建议</p>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
          {lastUpdated && (
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatLastUpdated()}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
          title="重新生成建议"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 聚焦区域 */}
      {data.focus_area && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">当前聚焦</span>
          </div>
          <p className="text-white/80 font-medium">{data.focus_area}</p>
          {data.focus_reason && (
            <p className="text-xs text-white/50 mt-1">{data.focus_reason}</p>
          )}
        </div>
      )}

      {/* 建议列表 */}
      <div className="space-y-3">
        {data.suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {suggestion.emoji || categoryIcons[suggestion.category] || '💡'}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-white/90">
                    {suggestion.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${impactColors[suggestion.impact]}`}>
                      <Zap className="w-3 h-3 inline mr-0.5" />
                      {suggestion.impact === 'high' ? '高影响' : 
                       suggestion.impact === 'medium' ? '中影响' : '低影响'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  {suggestion.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                    {difficultyLabels[suggestion.difficulty]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 鼓励语 */}
      {data.encouragement && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Heart className="w-4 h-4 text-pink-400" />
            <p>{data.encouragement}</p>
          </div>
        </div>
      )}
    </div>
  );
}
