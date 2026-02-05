'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Sparkles, TrendingUp, TrendingDown, Minus, 
  Lightbulb, AlertCircle, Star, RefreshCw, Clock
} from 'lucide-react';

interface Insight {
  title: string;
  content: string;
  emoji: string;
}

interface Suggestion {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface WeeklyAnalysis {
  has_data: boolean;
  summary: string;
  highlights?: string[];
  concerns?: string[];
  insights?: Insight[];
  suggestions?: Suggestion[];
  mood_trend?: 'up' | 'down' | 'stable';
  overall_score?: number;
}

interface CachedData {
  data: WeeklyAnalysis;
  timestamp: number;
}

interface Props {
  className?: string;
}

const priorityColors = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const CACHE_KEY = 'ai_weekly_analysis_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

export default function AIWeeklyAnalysis({ className = '' }: Props) {
  const [data, setData] = useState<WeeklyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(false);

  const fetchAnalysis = useCallback(async (forceRefresh = false) => {
    setError(false);
    
    // 检查缓存（除非强制刷新）
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp }: CachedData = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          // 缓存有效（1小时内）
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

    // 从 API 获取
    setLoading(true);
    try {
      const res = await fetch('/api/ai/weekly-analysis');
      if (res.ok) {
        const analysis = await res.json();
        setData(analysis);
        
        // 保存到缓存
        const cacheData: CachedData = {
          data: analysis,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        setLastUpdated(new Date());
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to fetch AI analysis:', err);
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
    fetchAnalysis(true); // 手动刷新强制重新获取
  };
  
  const handleGenerate = () => {
    fetchAnalysis(true); // 首次生成
  };
  
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚更新';
    if (minutes < 60) return `${minutes}分钟前更新`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前更新`;
    return lastUpdated.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' 更新';
  };

  // 未初始化且没有缓存 - 显示生成按钮
  if (!initialized && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 周度分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-[var(--text-secondary)] mb-4">点击生成本周 AI 分析报告</p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                生成分析
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
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 周度分析</h3>
        </div>
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">正在生成分析...</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">AI 正在分析你的生活数据</p>
        </div>
      </div>
    );
  }

  // 错误状态 - 显示重试按钮
  if (error && !data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 周度分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">😅</div>
          <p className="text-[var(--text-secondary)] mb-2">生成失败</p>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">可能是网络问题或 AI 服务繁忙</p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
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

  if (!data || !data.has_data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 周度分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-[var(--text-secondary)]">暂无足够数据进行分析</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            记录更多生活数据，AI 将为你生成洞察
          </p>
        </div>
      </div>
    );
  }

  const TrendIcon = data.mood_trend === 'up' 
    ? TrendingUp 
    : data.mood_trend === 'down' 
    ? TrendingDown 
    : Minus;
  
  const trendColor = data.mood_trend === 'up'
    ? 'text-emerald-400'
    : data.mood_trend === 'down'
    ? 'text-red-400'
    : 'text-[var(--text-tertiary)]';

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 周度分析</h3>
          {lastUpdated && (
            <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatLastUpdated()}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          title="重新生成分析"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 总结 & 分数 */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
        {data.overall_score !== undefined && (
          <div className="text-center px-4 border-r border-[var(--border)]">
            <div className={`text-3xl font-bold ${
              data.overall_score >= 70 ? 'text-emerald-400' :
              data.overall_score >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {data.overall_score}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">综合评分</div>
          </div>
        )}
        <div className="flex-1">
          <p className="text-[var(--text-primary)] leading-relaxed">{data.summary}</p>
          {data.mood_trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm ${trendColor}`}>
                {data.mood_trend === 'up' ? '状态上升' : 
                 data.mood_trend === 'down' ? '状态下降' : '保持稳定'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 亮点 & 关注 */}
      {(data.highlights?.length || data.concerns?.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {data.highlights && data.highlights.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">亮点</span>
              </div>
              <ul className="space-y-1">
                {data.highlights.map((h, idx) => (
                  <li key={idx} className="text-sm text-[var(--text-secondary)]">• {h}</li>
                ))}
              </ul>
            </div>
          )}
          
          {data.concerns && data.concerns.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">需关注</span>
              </div>
              <ul className="space-y-1">
                {data.concerns.map((c, idx) => (
                  <li key={idx} className="text-sm text-[var(--text-secondary)]">• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI 洞察 */}
      {data.insights && data.insights.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">AI 洞察</h4>
          <div className="space-y-3">
            {data.insights.map((insight, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{insight.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{insight.title}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{insight.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            AI 建议
          </h4>
          <div className="space-y-2">
            {data.suggestions.map((s, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-xl border ${priorityColors[s.priority]}`}
              >
                <p className="text-sm font-medium">{s.action}</p>
                <p className="text-xs opacity-70 mt-1">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
