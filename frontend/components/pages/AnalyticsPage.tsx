'use client';

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

export default function AnalyticsPage({ refreshKey }: AnalyticsPageProps) {
  return (
    <div className="space-y-8 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">数据分析</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">用数据说话 — 你的生活全景仪表盘</p>
      </div>

      {/* ===== Section 1: 今日快照 ===== */}
      <section className="animate-fade-in">
        <TodaySnapshot key={`snapshot-${refreshKey}`} />
      </section>

      {/* ===== Section 2: 趋势与情绪 ===== */}
      <section className="space-y-4 animate-fade-in delay-1">
        <div className="flex items-center gap-2 px-1">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">趋势与情绪</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <VibeTrendChart key={`trend-${refreshKey}`} />
          </div>
          <div className="lg:col-span-2">
            <MoodDistribution key={`mood-${refreshKey}`} />
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
          <DimensionRadar key={`radar-${refreshKey}`} />
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
