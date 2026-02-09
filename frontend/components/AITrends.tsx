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

const confidenceLabels: Record<string, string> = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
};

const confidenceColors: Record<string, string> = {
  high: 'text-emerald-500 dark:text-emerald-400',
  medium: 'text-amber-500 dark:text-amber-400',
  low: 'text-[var(--text-tertiary)]',
};

const impactColors: Record<string, string> = {
  positive: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
  neutral: 'bg-[var(--glass-bg)] border-[var(--border)] text-[var(--text-secondary)]',
};

export default function AITrends({ className = '' }: Props) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/trends?days=30');
      if (res.ok) {
        const trends = await res.json();
        setData(trends);
        setGenerated(true);
      }
    } catch (error) {
      console.error('Failed to fetch AI trends:', error);
    } finally {
      setLoading(false);
    }
  };

  // 未生成状态：显示提示 + 按钮
  if (!generated) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 趋势分析</h3>
        </div>
        <div className="text-center py-6">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm text-[var(--text-secondary)] mb-1">分析近 30 天的行为模式和趋势</p>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">将消耗少量 AI Token</p>
          <button
            onClick={fetchTrends}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />生成中...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" />生成趋势分析</>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.has_data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 趋势分析</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-[var(--text-secondary)]">{data?.trend_description || '数据不足'}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
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
    ? 'text-emerald-500 dark:text-emerald-400'
    : data.overall_trend === 'declining'
    ? 'text-rose-500 dark:text-rose-400'
    : 'text-[var(--text-tertiary)]';

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI 趋势分析</h3>
          {data.period_days && (
            <span className="text-xs text-[var(--text-tertiary)]">
              近 {data.period_days} 天
            </span>
          )}
        </div>
        <button
          onClick={fetchTrends}
          disabled={loading}
          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          title="重新生成（消耗 Token）"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {data.trend_description}
            </p>
          </div>
        </div>
      </div>

      {/* 发现的模式 */}
      {data.patterns && data.patterns.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">发现的模式</h4>
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
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            关联发现
          </h4>
          <div className="space-y-2">
            {data.correlations.map((corr, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-primary)]">{corr.factor1}</span>
                  <span className="text-[var(--text-tertiary)]">↔</span>
                  <span className="text-[var(--text-primary)]">{corr.factor2}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{corr.relationship}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 预测 */}
      {data.predictions && data.predictions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
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
                  <span className="text-sm font-medium text-[var(--text-primary)]">{pred.area}</span>
                  <span className={`text-xs ${confidenceColors[pred.confidence] || 'text-[var(--text-tertiary)]'}`}>
                    {confidenceLabels[pred.confidence] || pred.confidence}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{pred.prediction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行动建议 */}
      {data.action_items && data.action_items.length > 0 && (
        <div className="pt-4 border-t border-[var(--border)]">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">建议行动</h4>
          <ul className="space-y-1">
            {data.action_items.map((item, idx) => (
              <li key={idx} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                <span className="text-cyan-500 dark:text-cyan-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
