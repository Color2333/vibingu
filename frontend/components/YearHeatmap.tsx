'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface DayData {
  date: string;
  count: number;
  avg_score: number | null;
  weekday: number;
  week: number;
}

interface HeatmapData {
  year: number;
  data: DayData[];
  total_days: number;
  total_records: number;
}

interface Props {
  className?: string;
}

const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const weekdayLabels = ['', '一', '', '三', '', '五', ''];

export default function YearHeatmap({ className = '' }: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time/heatmap?year=${year}`);
      if (res.ok) {
        const heatmapData = await res.json();
        setData(heatmapData);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (count: number, score: number | null) => {
    if (count === 0) return isDark ? 'bg-white/5' : 'bg-black/[0.04]';
    
    const intensity = score !== null ? score / 100 : Math.min(count / 10, 1);
    
    if (intensity >= 0.8) return 'bg-emerald-500';
    if (intensity >= 0.6) return 'bg-emerald-500/80';
    if (intensity >= 0.4) return 'bg-emerald-500/55';
    if (intensity >= 0.2) return 'bg-emerald-500/35';
    return 'bg-emerald-500/20';
  };

  // Group data by weeks
  const getWeeksData = () => {
    if (!data) return [];
    
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    let lastWeek = 0;
    
    for (const day of data.data) {
      if (day.week !== lastWeek && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
      lastWeek = day.week;
    }
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-[var(--glass-bg)] rounded"></div>
        </div>
      </div>
    );
  }

  const weeks = getWeeksData();

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">年度活动热力图</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="p-1 rounded hover:bg-[var(--glass-bg)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <span className="text-[var(--text-primary)] font-medium min-w-[60px] text-center">
            {year}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            disabled={year >= new Date().getFullYear()}
            className="p-1 rounded hover:bg-[var(--glass-bg)] transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <span className="text-[var(--text-tertiary)]">活跃天数</span>
          <span className="text-[var(--text-primary)] ml-2 font-medium">{data?.total_days || 0}</span>
        </div>
        <div>
          <span className="text-[var(--text-tertiary)]">总记录</span>
          <span className="text-[var(--text-primary)] ml-2 font-medium">{data?.total_records || 0}</span>
        </div>
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-6">
        {monthLabels.map((month) => (
          <div
            key={month}
            className="text-[10px] text-[var(--text-tertiary)]"
            style={{ width: `${100 / 12}%` }}
          >
            {month}
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="flex">
        {/* Weekday labels */}
        <div className="flex flex-col mr-1">
          {weekdayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 text-[10px] text-[var(--text-tertiary)] flex items-center"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-[2px]" style={{ minWidth: 'fit-content' }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[2px]">
                {/* Pad the first week */}
                {weekIdx === 0 &&
                  Array.from({ length: week[0]?.weekday || 0 }).map((_, i) => (
                    <div key={`pad-${i}`} className="w-3 h-3" />
                  ))}
                
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-[var(--text-tertiary)] ${getColor(
                      day.count,
                      day.avg_score
                    )}`}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    title={`${day.date}: ${day.count}条记录`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-4 text-xs text-[var(--text-tertiary)]">
        <span>少</span>
        <div className={`w-3 h-3 rounded-sm ${isDark ? 'bg-white/5' : 'bg-black/[0.04]'}`}></div>
        <div className="w-3 h-3 rounded-sm bg-emerald-500/20"></div>
        <div className="w-3 h-3 rounded-sm bg-emerald-500/55"></div>
        <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
        <span>多</span>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div className="mt-4 p-3 rounded-lg bg-[var(--glass-bg)] text-sm">
          <div className="text-[var(--text-primary)] font-medium">{hoveredDay.date}</div>
          <div className="text-[var(--text-secondary)] mt-1">
            {hoveredDay.count > 0 ? (
              <>
                <span>{hoveredDay.count} 条记录</span>
                {hoveredDay.avg_score !== null && (
                  <span className="ml-2">· 平均分 {hoveredDay.avg_score}</span>
                )}
              </>
            ) : (
              '暂无记录'
            )}
          </div>
        </div>
      )}
    </div>
  );
}
