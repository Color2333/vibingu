'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendData {
  date: string;
  vibe_score: number | null;
}

export default function VibeTrendChart() {
  const [data, setData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const fetchTrend = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/analytics/trend?days=${days}`);
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
  }, [days]);

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-[var(--glass-bg)] rounded w-1/4 mb-4" />
          <div className="h-28 bg-[var(--glass-bg)] rounded-xl" />
        </div>
      </div>
    );
  }

  const validData = data.filter(d => d.vibe_score !== null);
  
  if (validData.length === 0) {
    return (
      <div className="glass rounded-3xl p-6">
        <p className="text-center text-[var(--text-tertiary)] text-sm py-8">暂无趋势数据</p>
      </div>
    );
  }

  const maxScore = Math.max(...validData.map(d => d.vibe_score!));
  const minScore = Math.min(...validData.map(d => d.vibe_score!));
  const range = Math.max(maxScore - minScore, 20);

  const hoveredData = hoveredIdx !== null && data[hoveredIdx]?.vibe_score !== null 
    ? data[hoveredIdx] : null;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
            Vibe Trend
          </p>
          <TrendIndicator data={validData} />
        </div>
        {/* 天数切换 */}
        <div className="flex gap-1 text-xs">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded-md transition-colors ${
                days === d
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg)]'
              }`}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      {/* Hover info */}
      {hoveredData && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-[var(--text-tertiary)]">{formatDate(hoveredData.date)}</span>
          <span className={`font-medium ${
            hoveredData.vibe_score! >= 70 ? 'text-emerald-400' :
            hoveredData.vibe_score! >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>{hoveredData.vibe_score}</span>
        </div>
      )}

      {/* Chart */}
      <div className="relative h-28">
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

          {/* Interactive hit areas + Points */}
          {data.map((d, i) => {
            if (d.vibe_score === null) return null;
            const x = (i / (data.length - 1)) * 100;
            const y = 38 - ((d.vibe_score - minScore + 10) / (range + 20)) * 36;
            const isHovered = hoveredIdx === i;
            return (
              <g key={i}>
                {/* Invisible hit area */}
                <rect
                  x={x - 100 / data.length / 2}
                  y={0}
                  width={100 / data.length}
                  height={40}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 2.5 : 1.5}
                  fill={isHovered ? '#8b5cf6' : 'var(--text-primary)'}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Date Labels */}
      <div className="flex justify-between mt-2 text-[10px] text-[var(--text-tertiary)]">
        <span>{formatDate(data[0]?.date)}</span>
        {data.length > 2 && <span>{formatDate(data[Math.floor(data.length / 2)]?.date)}</span>}
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
    return (
      <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
        <Minus className="w-3 h-3" /> 稳定
      </span>
    );
  }

  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const color = diff > 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <span className={`text-xs ${color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {diff > 0 ? '+' : ''}{diff}
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
