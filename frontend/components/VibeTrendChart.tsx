'use client';

import { useState, useEffect } from 'react';

interface TrendData {
  date: string;
  vibe_score: number | null;
}

export default function VibeTrendChart() {
  const [data, setData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const response = await fetch('/api/analytics/trend?days=7');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('获取趋势数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrend();
  }, []);

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6">
        <div className="h-32 skeleton rounded-xl" />
      </div>
    );
  }

  const validData = data.filter(d => d.vibe_score !== null);
  
  if (validData.length === 0) {
    return (
      <div className="glass rounded-3xl p-6">
        <p className="text-center text-white/30 text-sm py-8">暂无趋势数据</p>
      </div>
    );
  }

  const maxScore = Math.max(...validData.map(d => d.vibe_score!));
  const minScore = Math.min(...validData.map(d => d.vibe_score!));
  const range = Math.max(maxScore - minScore, 20);

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.15em] text-white/40">
          7 Day Trend
        </p>
        <TrendIndicator data={validData} />
      </div>

      {/* Chart */}
      <div className="relative h-24">
        <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area */}
          <path
            d={generateAreaPath(data, minScore, range)}
            fill="url(#areaGradient)"
          />

          {/* Line */}
          <path
            d={generateLinePath(data, minScore, range)}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {data.map((d, i) => {
            if (d.vibe_score === null) return null;
            const x = (i / (data.length - 1)) * 100;
            const y = 38 - ((d.vibe_score - minScore + 10) / (range + 20)) * 36;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.5"
                fill="#fff"
                className="drop-shadow-lg"
              />
            );
          })}
        </svg>
      </div>

      {/* Date Labels */}
      <div className="flex justify-between mt-2 text-[10px] text-white/30">
        <span>{formatDate(data[0]?.date)}</span>
        <span>{formatDate(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function TrendIndicator({ data }: { data: TrendData[] }) {
  if (data.length < 2) return null;
  
  const recent = data.slice(-3).filter(d => d.vibe_score !== null);
  if (recent.length < 2) return null;

  const first = recent[0].vibe_score!;
  const last = recent[recent.length - 1].vibe_score!;
  const diff = last - first;

  if (Math.abs(diff) < 5) {
    return <span className="text-xs text-white/40">稳定</span>;
  }

  return (
    <span className={`text-xs ${diff > 0 ? 'score-high' : 'score-low'}`}>
      {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}
    </span>
  );
}

function generateLinePath(data: TrendData[], minScore: number, range: number): string {
  const points = data
    .map((d, i) => {
      if (d.vibe_score === null) return null;
      const x = (i / (data.length - 1)) * 100;
      const y = 38 - ((d.vibe_score - minScore + 10) / (range + 20)) * 36;
      return { x, y };
    })
    .filter(Boolean) as { x: number; y: number }[];

  if (points.length === 0) return '';

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function generateAreaPath(data: TrendData[], minScore: number, range: number): string {
  const linePath = generateLinePath(data, minScore, range);
  if (!linePath) return '';

  const points = data
    .map((d, i) => {
      if (d.vibe_score === null) return null;
      return (i / (data.length - 1)) * 100;
    })
    .filter(Boolean) as number[];

  if (points.length === 0) return '';

  return `${linePath} L ${points[points.length - 1]} 40 L ${points[0]} 40 Z`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
