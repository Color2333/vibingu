'use client';

import { useEffect, useState } from 'react';
import { 
  Sparkles, TrendingUp, TrendingDown, Minus, 
  Lightbulb, AlertCircle, Star, RefreshCw 
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

interface Props {
  className?: string;
}

const priorityColors = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function AIWeeklyAnalysis({ className = '' }: Props) {
  const [data, setData] = useState<WeeklyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalysis = async () => {
    try {
      const res = await fetch('/api/ai/weekly-analysis');
      if (res.ok) {
        const analysis = await res.json();
        setData(analysis);
      }
    } catch (error) {
      console.error('Failed to fetch AI analysis:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalysis();
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-white/5 rounded mb-4"></div>
          <div className="h-16 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || !data.has_data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 周度分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-white/60">暂无足够数据进行分析</p>
          <p className="text-xs text-white/40 mt-1">
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
    : 'text-white/50';

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 周度分析</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 总结 & 分数 */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
        {data.overall_score !== undefined && (
          <div className="text-center px-4 border-r border-white/10">
            <div className={`text-3xl font-bold ${
              data.overall_score >= 70 ? 'text-emerald-400' :
              data.overall_score >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {data.overall_score}
            </div>
            <div className="text-xs text-white/40">综合评分</div>
          </div>
        )}
        <div className="flex-1">
          <p className="text-white/80 leading-relaxed">{data.summary}</p>
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
                  <li key={idx} className="text-sm text-white/60">• {h}</li>
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
                  <li key={idx} className="text-sm text-white/60">• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI 洞察 */}
      {data.insights && data.insights.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white/60 mb-3">AI 洞察</h4>
          <div className="space-y-3">
            {data.insights.map((insight, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{insight.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-white/80">{insight.title}</p>
                    <p className="text-sm text-white/50 mt-1">{insight.content}</p>
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
          <h4 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
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
