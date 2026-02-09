'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import TodaySnapshot from '@/components/TodaySnapshot';
import VibeTrendChart from '@/components/VibeTrendChart';
import MoodDistribution from '@/components/MoodDistribution';
import DimensionRadar from '@/components/DimensionRadar';
import CircadianChart from '@/components/CircadianChart';
import WeeklyPattern from '@/components/WeeklyPattern';
import YearHeatmap from '@/components/YearHeatmap';
import TagCloud from '@/components/TagCloud';

interface AnalyticsPageProps {
  refreshKey: number;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AnalyticsPage({ refreshKey }: AnalyticsPageProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customDate, setCustomDate] = useState(formatDate(new Date()));

  // Calculate the selected date string (YYYY-MM-DD)
  const getSelectedDate = (): string => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return formatDate(now);
      case 'yesterday': {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return formatDate(d);
      }
      case 'custom':
        return customDate;
      default:
        return formatDate(now);
    }
  };

  // Calculate the days span for trend charts
  const getDays = (): number => {
    switch (datePreset) {
      case 'week': return 7;
      case 'month': return 30;
      default: return 7;
    }
  };

  const selectedDate = getSelectedDate();
  const trendDays = getDays();
  const isToday = selectedDate === formatDate(new Date());

  // For the snapshot title
  const snapshotTitle = datePreset === 'today' ? '今日快照' 
    : datePreset === 'yesterday' ? '昨日快照' 
    : `${selectedDate} 快照`;

  const presets: { value: DatePreset; label: string }[] = [
    { value: 'today', label: '今日' },
    { value: 'yesterday', label: '昨日' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* 页面标题 + 日期选择器 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">数据分析</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">用数据说话 — 你的生活全景仪表盘</p>
        </div>

        {/* 日期选择器 */}
        <div className="flex items-center gap-2 flex-wrap">
          {presets.map(p => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                datePreset === p.value
                  ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setDatePreset('custom'); }}
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {/* ===== Section 1: 快照 ===== */}
      <section className="animate-fade-in">
        <TodaySnapshot key={`snapshot-${refreshKey}-${selectedDate}`} date={isToday ? undefined : selectedDate} />
      </section>

      {/* ===== Section 2: 趋势与情绪 ===== */}
      <section className="space-y-4 animate-fade-in delay-1">
        <div className="flex items-center gap-2 px-1">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">趋势与情绪</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <VibeTrendChart key={`trend-${refreshKey}-${selectedDate}`} endDate={isToday ? undefined : selectedDate} />
          </div>
          <div className="lg:col-span-2">
            <MoodDistribution key={`mood-${refreshKey}-${selectedDate}`} />
          </div>
        </div>
      </section>

      {/* ===== Section 3: 多维画像 ===== */}
      <section className="space-y-4 animate-fade-in delay-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-purple-400 to-pink-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">多维画像</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DimensionRadar key={`radar-${refreshKey}-${selectedDate}`} date={isToday ? undefined : selectedDate} />
          <TagCloud key={`tags-${refreshKey}`} />
        </div>
      </section>

      {/* ===== Section 4: 时间密码 ===== */}
      <section className="space-y-4 animate-fade-in delay-3">
        <div className="flex items-center gap-2 px-1">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">时间密码</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CircadianChart key={`circadian-${refreshKey}`} />
          <WeeklyPattern key={`weekly-${refreshKey}`} />
        </div>
      </section>

      {/* ===== Section 5: 年度纵览 ===== */}
      <section className="space-y-4 animate-fade-in delay-4">
        <div className="flex items-center gap-2 px-1">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">年度纵览</h2>
        </div>
        <YearHeatmap key={`heatmap-${refreshKey}`} />
      </section>
    </div>
  );
}
