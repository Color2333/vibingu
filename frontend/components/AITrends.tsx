'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw, Link2, Sparkles } from 'lucide-react';

interface Pattern {
  name: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface Correlation {
  factor1: string;
  factor2: string;
  relationship: string;
}

interface Prediction {
  area: string;
  prediction: string;
  confidence: 'high' | 'medium' | 'low';
}

interface TrendsData {
  has_data: boolean;
  overall_trend: 'improving' | 'declining' | 'stable';
  trend_description: string;
  patterns?: Pattern[];
  correlations?: Correlation[];
  predictions?: Prediction[];
  action_items?: string[];
  period_days?: number;
}

interface Props {
  className?: string;
}

const confidenceLabels = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
};

const confidenceColors = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-white/50',
};

const impactColors = {
  positive: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  negative: 'bg-red-500/10 border-red-500/20 text-red-400',
  neutral: 'bg-white/5 border-white/10 text-white/60',
};

export default function AITrends({ className = '' }: Props) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrends = async () => {
    try {
      const res = await fetch('/api/ai/trends?days=30');
      if (res.ok) {
        const trends = await res.json();
        setData(trends);
      }
    } catch (error) {
      console.error('Failed to fetch AI trends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrends();
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || !data.has_data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 趋势分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-white/60">{data?.trend_description || '数据不足'}</p>
          <p className="text-xs text-white/40 mt-1">
            需要至少 7 条记录进行趋势分析
          </p>
        </div>
      </div>
    );
  }

  const TrendIcon = data.overall_trend === 'improving'
    ? TrendingUp
    : data.overall_trend === 'declining'
    ? TrendingDown
    : Minus;

  const trendColor = data.overall_trend === 'improving'
    ? 'text-emerald-400'
    : data.overall_trend === 'declining'
    ? 'text-red-400'
    : 'text-white/50';

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 趋势分析</h3>
          {data.period_days && (
            <span className="text-xs text-white/40">
              近 {data.period_days} 天
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 整体趋势 */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
        <div className="flex items-center gap-3">
          <TrendIcon className={`w-8 h-8 ${trendColor}`} />
          <div>
            <div className={`text-lg font-semibold ${trendColor}`}>
              {data.overall_trend === 'improving' ? '整体改善' :
               data.overall_trend === 'declining' ? '需要关注' : '保持稳定'}
            </div>
            <p className="text-sm text-white/60 mt-1">
              {data.trend_description}
            </p>
          </div>
        </div>
      </div>

      {/* 发现的模式 */}
      {data.patterns && data.patterns.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white/60 mb-3">发现的模式</h4>
          <div className="space-y-2">
            {data.patterns.map((pattern, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border ${impactColors[pattern.impact]}`}
              >
                <p className="text-sm font-medium">{pattern.name}</p>
                <p className="text-xs opacity-70 mt-1">{pattern.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关联发现 */}
      {data.correlations && data.correlations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            关联发现
          </h4>
          <div className="space-y-2">
            {data.correlations.map((corr, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/80">{corr.factor1}</span>
                  <span className="text-white/30">↔</span>
                  <span className="text-white/80">{corr.factor2}</span>
                </div>
                <p className="text-xs text-white/50 mt-1">{corr.relationship}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 预测 */}
      {data.predictions && data.predictions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            AI 预测
          </h4>
          <div className="space-y-2">
            {data.predictions.map((pred, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white/80">{pred.area}</span>
                  <span className={`text-xs ${confidenceColors[pred.confidence]}`}>
                    {confidenceLabels[pred.confidence]}
                  </span>
                </div>
                <p className="text-sm text-white/60">{pred.prediction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行动建议 */}
      {data.action_items && data.action_items.length > 0 && (
        <div className="pt-4 border-t border-white/[0.06]">
          <h4 className="text-sm font-medium text-white/60 mb-2">建议行动</h4>
          <ul className="space-y-1">
            {data.action_items.map((item, idx) => (
              <li key={idx} className="text-sm text-white/50 flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
