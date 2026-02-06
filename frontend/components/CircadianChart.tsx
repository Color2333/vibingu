'use client';

import { useEffect, useState } from 'react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
  Tooltip,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';

interface HourlyData {
  hour: number;
  label: string;
  count: number;
  activity_level: number;
  avg_score: number;
  top_category: string | null;
}

interface CircadianData {
  period_days: number;
  total_records: number;
  peak_hours: number[];
  valley_hours: number[];
  chronotype: string;
}

interface Props {
  className?: string;
}

const chronotypeInfo: Record<string, { name: string; icon: string; color: string }> = {
  lion: { name: '狮子型', icon: '🦁', color: 'text-amber-400' },
  bear: { name: '熊型', icon: '🐻', color: 'text-orange-400' },
  wolf: { name: '狼型', icon: '🐺', color: 'text-purple-400' },
  dolphin: { name: '海豚型', icon: '🐬', color: 'text-cyan-400' },
};

export default function CircadianChart({ className = '' }: Props) {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [circadianData, setCircadianData] = useState<CircadianData | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [hourlyRes, circadianRes] = await Promise.all([
        fetch('/api/time/hourly?days=30'),
        fetch('/api/time/circadian?days=30'),
      ]);

      if (hourlyRes.ok) {
        const data = await hourlyRes.json();
        setHourlyData(data);
      }

      if (circadianRes.ok) {
        const data = await circadianRes.json();
        setCircadianData(data);
      }
    } catch (error) {
      console.error('Failed to fetch circadian data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-[var(--glass-bg)] rounded-full mx-auto w-64"></div>
        </div>
      </div>
    );
  }

  // Prepare data for the circular chart
  const bgBarFill = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const tooltipBg = isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const tooltipText = isDark ? '#fff' : '#1a1a2e';

  const chartData = hourlyData.map((h) => ({
    name: h.label,
    value: h.activity_level,
    count: h.count,
    score: h.avg_score,
    fill: h.activity_level > 70 ? '#22c55e' : h.activity_level > 40 ? '#eab308' : '#64748b',
  }));

  const chronotype = circadianData?.chronotype || 'bear';
  const typeInfo = chronotypeInfo[chronotype];

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">24小时活动节律</h3>
        {typeInfo && (
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeInfo.icon}</span>
            <span className={`text-sm font-medium ${typeInfo.color}`}>
              {typeInfo.name}
            </span>
          </div>
        )}
      </div>

      {/* Circular Hour Display */}
      <div className="relative">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: bgBarFill }}
                dataKey="value"
                cornerRadius={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '10px',
                  color: tooltipText,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
                formatter={(value, name, props) => {
                  const item = props.payload;
                  return [
                    <div key="content" className="text-xs">
                      <div>活跃度: {Number(value).toFixed(0)}%</div>
                      <div>记录数: {item.count}</div>
                      <div>平均分: {item.score}</div>
                    </div>,
                    item.name,
                  ];
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Center info */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--text-primary)]">
              {circadianData?.total_records || 0}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">总记录</div>
          </div>
        </div>
      </div>

      {/* Peak hours */}
      {circadianData && circadianData.peak_hours.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">活跃高峰</span>
            <div className="flex gap-2">
              {circadianData.peak_hours.slice(0, 4).map((hour) => (
                <span
                  key={hour}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-xs"
                >
                  {hour}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hour grid */}
      <div className="mt-4 grid grid-cols-12 gap-1">
        {hourlyData.slice(0, 24).map((h) => (
          <div
            key={h.hour}
            className="aspect-square rounded flex items-center justify-center text-[10px] text-[var(--text-secondary)] transition-colors"
            style={{
              backgroundColor: isDark
                ? `rgba(139, 92, 246, ${h.activity_level / 200 + 0.1})`
                : `rgba(139, 92, 246, ${h.activity_level / 250 + 0.08})`,
            }}
            title={`${h.label}: ${h.count}条记录`}
          >
            {h.hour}
          </div>
        ))}
      </div>
    </div>
  );
}
