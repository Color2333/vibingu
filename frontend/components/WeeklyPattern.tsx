'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';

interface DailyStats {
  name: string;
  count: number;
  avg_score: number;
  is_weekend: boolean;
}

interface WeeklyData {
  period_weeks: number;
  daily_stats: Record<string, DailyStats>;
  weekday_avg: number;
  weekend_avg: number;
  best_day: { day: string; score: number };
  worst_day: { day: string; score: number };
  weekend_boost: number;
}

interface Props {
  className?: string;
}

export default function WeeklyPattern({ className = '' }: Props) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/time/weekly?weeks=8');
      if (res.ok) {
        const weeklyData = await res.json();
        setData(weeklyData);
      }
    } catch (error) {
      console.error('Failed to fetch weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-[var(--glass-bg)] rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">周模式分析</h3>
        <p className="text-[var(--text-tertiary)] text-center py-8">暂无数据</p>
      </div>
    );
  }

  // Theme-aware chart colors
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const axisTickColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const axisLineColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const tooltipBg = isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const tooltipText = isDark ? '#fff' : '#1a1a2e';

  // Prepare chart data
  const chartData = Object.entries(data.daily_stats)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([_, stats]) => ({
      name: stats.name,
      score: stats.avg_score,
      count: stats.count,
      isWeekend: stats.is_weekend,
    }));

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">周模式分析</h3>
        <span className="text-xs text-[var(--text-tertiary)]">最近 {data.period_weeks} 周</span>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 p-3 rounded-lg bg-[var(--glass-bg)]">
          <div className="text-xs text-[var(--text-tertiary)]">工作日平均</div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">
            {data.weekday_avg}
          </div>
        </div>
        <div className="flex-1 p-3 rounded-lg bg-[var(--glass-bg)]">
          <div className="text-xs text-[var(--text-tertiary)]">周末平均</div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">
            {data.weekend_avg}
          </div>
        </div>
        <div className="flex-1 p-3 rounded-lg bg-[var(--glass-bg)]">
          <div className="text-xs text-[var(--text-tertiary)]">周末提升</div>
          <div
            className={`text-xl font-semibold ${
              data.weekend_boost > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {data.weekend_boost > 0 ? '+' : ''}
            {data.weekend_boost}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fill: axisTickColor, fontSize: 12 }}
              axisLine={{ stroke: axisLineColor }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: axisTickColor, fontSize: 10 }}
              axisLine={{ stroke: axisLineColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '10px',
                color: tooltipText,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              formatter={(value) => [
                `${Number(value).toFixed(1)}分`,
                '平均得分',
              ]}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isWeekend
                      ? 'rgba(139, 92, 246, 0.8)'
                      : 'rgba(99, 102, 241, 0.6)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Best/Worst day */}
      <div className="flex justify-between mt-4 pt-4 border-t border-[var(--border)] text-sm">
        <div>
          <span className="text-[var(--text-tertiary)]">最佳日:</span>
          <span className="text-emerald-500 dark:text-emerald-400 ml-2 font-medium">
            {data.best_day.day} ({data.best_day.score}分)
          </span>
        </div>
        <div>
          <span className="text-[var(--text-tertiary)]">关注日:</span>
          <span className="text-amber-500 dark:text-amber-400 ml-2 font-medium">
            {data.worst_day.day} ({data.worst_day.score}分)
          </span>
        </div>
      </div>
    </div>
  );
}
