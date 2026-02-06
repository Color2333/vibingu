'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Sparkles } from 'lucide-react';

interface PredictionData {
  predicted_date: string;
  predicted_score: number;
  confidence: string;
  base_score: number;
  adjustments: {
    trend: number;
    today_factors: number;
  };
  factors: Array<{ type: string; status: string; impact: string }>;
  historical_reference: {
    weekday: string;
    avg_score: number;
    sample_size: number;
  };
  recent_trend: {
    direction: string;
    strength: number;
  };
}

interface Props {
  className?: string;
}

const confidenceColors = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
};

const confidenceLabels = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
};

export default function PredictionCard({ className = '' }: Props) {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrediction();
  }, []);

  const fetchPrediction = async () => {
    try {
      const res = await fetch('/api/predict/tomorrow');
      if (res.ok) {
        const predictionData = await res.json();
        setData(predictionData);
      }
    } catch (error) {
      console.error('Failed to fetch prediction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-[var(--glass-bg)] rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">明日预测</h3>
        <p className="text-[var(--text-tertiary)] text-center py-4">暂无足够数据进行预测</p>
      </div>
    );
  }

  const TrendIcon =
    data.recent_trend.direction === 'up'
      ? TrendingUp
      : data.recent_trend.direction === 'down'
      ? TrendingDown
      : Minus;

  const trendColor =
    data.recent_trend.direction === 'up'
      ? 'text-emerald-400'
      : data.recent_trend.direction === 'down'
      ? 'text-red-400'
      : 'text-[var(--text-tertiary)]';

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">明日 Vibe 预测</h3>
        </div>
        <span
          className={`text-xs ${
            confidenceColors[data.confidence as keyof typeof confidenceColors]
          }`}
        >
          {confidenceLabels[data.confidence as keyof typeof confidenceLabels]}
        </span>
      </div>

      {/* Main prediction */}
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <div className="text-xs text-[var(--text-tertiary)] mb-1">
            {data.historical_reference.weekday}
          </div>
          <div
            className={`text-5xl font-bold ${
              data.predicted_score >= 70
                ? 'text-emerald-400'
                : data.predicted_score >= 50
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {data.predicted_score}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">预测分数</div>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <TrendIcon className={`w-4 h-4 ${trendColor}`} />
        <span className={`text-sm ${trendColor}`}>
          {data.recent_trend.direction === 'up'
            ? '上升趋势'
            : data.recent_trend.direction === 'down'
            ? '下降趋势'
            : '稳定'}
        </span>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 pt-4 border-t border-[var(--border)]">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">历史基准</span>
          <span className="text-[var(--text-secondary)]">{data.base_score}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">趋势调整</span>
          <span
            className={
              data.adjustments.trend > 0 ? 'text-emerald-400' : 'text-red-400'
            }
          >
            {data.adjustments.trend > 0 ? '+' : ''}
            {data.adjustments.trend}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">今日因素</span>
          <span
            className={
              data.adjustments.today_factors > 0
                ? 'text-emerald-400'
                : data.adjustments.today_factors < 0
                ? 'text-red-400'
                : 'text-[var(--text-tertiary)]'
            }
          >
            {data.adjustments.today_factors > 0 ? '+' : ''}
            {data.adjustments.today_factors}
          </span>
        </div>
      </div>

      {/* Factors */}
      {data.factors && data.factors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-tertiary)] mb-2">影响因素</div>
          <div className="flex flex-wrap gap-2">
            {data.factors.map((f, idx) => (
              <span
                key={idx}
                className={`px-2 py-1 rounded-full text-xs ${
                  f.impact === 'positive'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : f.impact === 'negative'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)]'
                }`}
              >
                {f.type === 'sleep'
                  ? '睡眠'
                  : f.type === 'exercise'
                  ? '运动'
                  : f.type === 'caffeine'
                  ? '咖啡因'
                  : f.type}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
