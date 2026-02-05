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
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white/90">八维度生活平衡</h3>
        {summary && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50">Vibe Score</span>
            <span
              className={`text-2xl font-bold ${
                summary.vibe_score >= 70
                  ? 'text-emerald-400'
                  : summary.vibe_score >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
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
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}`, 'Score']}
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
              className="flex flex-col items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-lg">{dim.icon}</span>
              <span className="text-xs text-white/70 mt-1">{dim.name}</span>
              <span
                className={`text-sm font-semibold ${
                  dim.score >= 70
                    ? 'text-emerald-400'
                    : dim.score >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
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
