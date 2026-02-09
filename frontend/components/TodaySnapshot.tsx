'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, Brain, Users, Briefcase, BookOpen, Target, Smartphone, Gamepad2, TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from 'lucide-react';

interface VibeData {
  date: string;
  vibe_score: number | null;
  dimension_averages: Record<string, number> | null;
  sleep_score: number | null;
  diet_score: number | null;
  screen_score: number | null;
  activity_score: number | null;
  insights: string[];
  record_count: number;
  scoring_mode: string;
}

interface DimensionInfo {
  name: string;
  icon: string;
  score: number;
  record_count: number;
}

interface DimensionData {
  date: string;
  vibe_score: number;
  dimensions: Record<string, DimensionInfo>;
  record_count: number;
}

const DIM_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; barColor: string }> = {
  body:    { icon: <Heart className="w-3.5 h-3.5" />,      label: '身体', color: 'text-rose-400',    barColor: 'bg-rose-400' },
  mood:    { icon: <Brain className="w-3.5 h-3.5" />,      label: '心情', color: 'text-amber-400',   barColor: 'bg-amber-400' },
  social:  { icon: <Users className="w-3.5 h-3.5" />,      label: '社交', color: 'text-blue-400',    barColor: 'bg-blue-400' },
  work:    { icon: <Briefcase className="w-3.5 h-3.5" />,  label: '工作', color: 'text-indigo-400',  barColor: 'bg-indigo-400' },
  growth:  { icon: <BookOpen className="w-3.5 h-3.5" />,   label: '成长', color: 'text-emerald-400', barColor: 'bg-emerald-400' },
  meaning: { icon: <Target className="w-3.5 h-3.5" />,     label: '意义', color: 'text-purple-400',  barColor: 'bg-purple-400' },
  digital: { icon: <Smartphone className="w-3.5 h-3.5" />, label: '数字', color: 'text-cyan-400',    barColor: 'bg-cyan-400' },
  leisure: { icon: <Gamepad2 className="w-3.5 h-3.5" />,   label: '休闲', color: 'text-pink-400',    barColor: 'bg-pink-400' },
};

export default function TodaySnapshot({ date }: { date?: string }) {
  const [vibeData, setVibeData] = useState<VibeData | null>(null);
  const [dimData, setDimData] = useState<DimensionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const dateParam = date ? `?date=${date}` : '';
    try {
      const [vibeRes, dimRes] = await Promise.all([
        fetch(`/api/analytics/vibe/today${dateParam}`),
        fetch(`/api/analytics/dimensions/today${dateParam}`),
      ]);
      if (vibeRes.ok) setVibeData(await vibeRes.json());
      if (dimRes.ok) setDimData(await dimRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse flex gap-6">
          <div className="w-32 h-32 bg-[var(--glass-bg)] rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-6 bg-[var(--glass-bg)] rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const vibeScore = vibeData?.vibe_score ?? null;
  const recordCount = vibeData?.record_count ?? dimData?.record_count ?? 0;

  // Sorted dimensions from dimData
  const sortedDims = dimData?.dimensions
    ? Object.entries(dimData.dimensions).sort(([, a], [, b]) => b.score - a.score)
    : [];
  const strongest = sortedDims[0];
  const weakest = sortedDims.length > 1 ? sortedDims[sortedDims.length - 1] : null;

  const getScoreColor = (s: number | null) => {
    if (s === null) return 'text-[var(--text-tertiary)]';
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-blue-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreLabel = (s: number | null) => {
    if (s === null) return '无数据';
    if (s >= 80) return '极佳';
    if (s >= 60) return '良好';
    if (s >= 40) return '一般';
    return '偏低';
  };

  // SVG circle props
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = vibeScore !== null ? (vibeScore / 100) * circumference : 0;

  const getStrokeColor = (s: number | null) => {
    if (s === null) return '#6b7280';
    if (s >= 80) return '#34d399';
    if (s >= 60) return '#60a5fa';
    if (s >= 40) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">今日快照</h3>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Left: Vibe Score Ring */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--glass-bg)" strokeWidth="8" />
              {vibeScore !== null && (
                <circle
                  cx="60" cy="60" r={radius}
                  fill="none"
                  stroke={getStrokeColor(vibeScore)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  className="transition-all duration-1000"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(vibeScore)}`}>
                {vibeScore !== null ? Math.round(vibeScore) : '—'}
              </span>
              <span className={`text-xs ${getScoreColor(vibeScore)}`}>{getScoreLabel(vibeScore)}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-2 uppercase tracking-wider">Vibe Score</span>
        </div>

        {/* Right: 8 Dimension Bars */}
        <div className="flex-1 min-w-0 space-y-2">
          {sortedDims.length > 0 ? sortedDims.map(([key, dim]) => {
            const cfg = DIM_CONFIG[key];
            if (!cfg) return null;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={`${cfg.color} flex-shrink-0 w-5 flex justify-center`}>{cfg.icon}</span>
                <span className="text-xs text-[var(--text-secondary)] w-8 flex-shrink-0">{cfg.label}</span>
                <div className="flex-1 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cfg.barColor} transition-all duration-700`}
                    style={{ width: `${Math.min(100, Math.max(0, dim.score))}%`, opacity: 0.8 }}
                  />
                </div>
                <span className={`text-xs font-medium w-7 text-right ${cfg.color}`}>
                  {Math.round(dim.score)}
                </span>
              </div>
            );
          }) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
              暂无维度数据
            </div>
          )}
        </div>
      </div>

      {/* Bottom Summary Badges */}
      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[var(--border)]">
        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)] flex items-center gap-1">
          {recordCount} 条记录
        </span>
        {strongest && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            最佳: {strongest[1].name} {Math.round(strongest[1].score)}
          </span>
        )}
        {weakest && weakest[1].score < (strongest?.[1].score ?? 100) && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            关注: {weakest[1].name} {Math.round(weakest[1].score)}
          </span>
        )}
        {vibeData?.insights && vibeData.insights.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center gap-1">
            <Minus className="w-3 h-3" />
            {vibeData.insights[0]}
          </span>
        )}
      </div>
    </div>
  );
}
