'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TrendData {
  date: string;
  body: number | null;
  mood: number | null;
  social: number | null;
  work: number | null;
  growth: number | null;
  meaning: number | null;
  digital: number | null;
  leisure: number | null;
}

interface EmotionTrendData {
  period_days: number;
  dimensions: string[];
  data: TrendData[];
}

interface Props {
  className?: string;
  days?: number;
}

const dimensionConfig: Record<string, { name: string; color: string }> = {
  body: { name: '身体', color: '#22c55e' },
  mood: { name: '心情', color: '#f59e0b' },
  social: { name: '社交', color: '#8b5cf6' },
  work: { name: '工作', color: '#64748b' },
  growth: { name: '成长', color: '#06b6d4' },
  meaning: { name: '意义', color: '#ec4899' },
  digital: { name: '数字', color: '#3b82f6' },
  leisure: { name: '休闲', color: '#f97316' },
};

export default function EmotionTrend({ className = '', days = 30 }: Props) {
  const [data, setData] = useState<EmotionTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([
    'mood',
    'body',
    'social',
  ]);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/time/emotion-trend?days=${days}`);
      if (res.ok) {
        const trendData = await res.json();
        setData(trendData);
      }
    } catch (error) {
      console.error('Failed to fetch emotion trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDimension = (dim: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim]
    );
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-white/90 mb-4">
          维度趋势河流图
        </h3>
        <p className="text-white/50 text-center py-8">暂无足够数据</p>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Prepare chart data - fill in nulls with interpolation or 50
  const chartData = data.data.map((d) => ({
    ...d,
    date: formatDate(d.date),
    body: d.body ?? 50,
    mood: d.mood ?? 50,
    social: d.social ?? 50,
    work: d.work ?? 50,
    growth: d.growth ?? 50,
    meaning: d.meaning ?? 50,
    digital: d.digital ?? 50,
    leisure: d.leisure ?? 50,
  }));

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white/90">维度趋势河流图</h3>
        <span className="text-xs text-white/40">最近 {data.period_days} 天</span>
      </div>

      {/* Dimension toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(dimensionConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => toggleDimension(key)}
            className={`px-3 py-1 rounded-full text-xs transition-all border ${
              selectedDimensions.includes(key)
                ? 'border-white/30 bg-white/10'
                : 'border-white/10 bg-transparent text-white/40'
            }`}
            style={{
              color: selectedDimensions.includes(key) ? config.color : undefined,
            }}
          >
            {config.name}
          </button>
        ))}
      </div>

      {/* Area Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              {Object.entries(dimensionConfig).map(([key, config]) => (
                <linearGradient
                  key={key}
                  id={`gradient-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
              }}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}`,
                dimensionConfig[name as string]?.name || name,
              ]}
            />
            {selectedDimensions.map((dim) => (
              <Area
                key={dim}
                type="monotone"
                dataKey={dim}
                stroke={dimensionConfig[dim].color}
                fill={`url(#gradient-${dim})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 flex-wrap">
        {selectedDimensions.map((dim) => (
          <div key={dim} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: dimensionConfig[dim].color }}
            />
            <span className="text-white/60">{dimensionConfig[dim].name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
