'use client';

import { useEffect, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';

interface DimensionData {
  dimension: string;
  score: number;
  fullMark: number;
}

interface DimensionSummary {
  date: string;
  vibe_score: number;
  dimensions: {
    [key: string]: {
      name: string;
      icon: string;
      score: number;
      record_count: number;
    };
  };
  record_count: number;
}

interface Props {
  className?: string;
}

export default function DimensionRadar({ className = '' }: Props) {
  const [data, setData] = useState<DimensionData[]>([]);
  const [summary, setSummary] = useState<DimensionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    fetchDimensions();
  }, []);

  const fetchDimensions = async () => {
    try {
      const [radarRes, summaryRes] = await Promise.all([
        fetch('/api/analytics/dimensions/radar/today'),
        fetch('/api/analytics/dimensions/today'),
      ]);

      if (radarRes.ok) {
        const radarData = await radarRes.json();
        setData(radarData);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (error) {
      console.error('Failed to fetch dimensions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-[var(--glass-bg)] rounded"></div>
        </div>
      </div>
    );
  }

  // Theme-aware colors
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const tickColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
  const tickColorFaint = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const tooltipBg = isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const tooltipText = isDark ? '#fff' : '#1a1a2e';

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">八维度生活平衡</h3>
        {summary && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-tertiary)]">Vibe</span>
            <span
              className={`text-2xl font-bold ${
                summary.vibe_score >= 70
                  ? 'text-emerald-400'
                  : summary.vibe_score >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {summary.vibe_score.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: tickColor, fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: tickColorFaint, fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '10px',
                color: tooltipText,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}`, '分数']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Dimension Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {Object.entries(summary.dimensions).map(([key, dim]) => (
            <div
              key={key}
              className="flex flex-col items-center p-2 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <span className="text-lg">{dim.icon}</span>
              <span className="text-xs text-[var(--text-secondary)] mt-1">{dim.name}</span>
              <span
                className={`text-sm font-semibold ${
                  dim.score >= 70
                    ? 'text-emerald-400'
                    : dim.score >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {dim.score.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
