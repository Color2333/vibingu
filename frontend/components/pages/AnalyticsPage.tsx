'use client';

import VibingCard from '@/components/VibingCard';
import VibeTrendChart from '@/components/VibeTrendChart';
import DimensionRadar from '@/components/DimensionRadar';
import TagCloud from '@/components/TagCloud';
import CircadianChart from '@/components/CircadianChart';
import YearHeatmap from '@/components/YearHeatmap';
import WeeklyPattern from '@/components/WeeklyPattern';
import BioClockProfile from '@/components/BioClockProfile';

interface AnalyticsPageProps {
  refreshKey: number;
}

export default function AnalyticsPage({ refreshKey }: AnalyticsPageProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">数据分析</h1>
        <p className="text-sm text-white/40 mt-1">可视化你的生活数据</p>
      </div>

      {/* 今日状态卡片 */}
      <section className="animate-fade-in">
        <VibingCard key={`vibe-${refreshKey}`} />
      </section>

      {/* 趋势图表 */}
      <section className="animate-fade-in delay-1">
        <VibeTrendChart key={`trend-${refreshKey}`} />
      </section>

      {/* 两列布局：雷达图 + 标签云 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="animate-fade-in delay-2">
          <DimensionRadar key={`radar-${refreshKey}`} />
        </section>
        <section className="animate-fade-in delay-2">
          <TagCloud key={`tags-${refreshKey}`} />
        </section>
      </div>

      {/* 时间智能分析 */}
      <div className="pt-4 border-t border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white/80 mb-4">时间节律分析</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="animate-fade-in delay-3">
            <CircadianChart key={`circadian-${refreshKey}`} />
          </section>
          <section className="animate-fade-in delay-3">
            <WeeklyPattern key={`weekly-${refreshKey}`} />
          </section>
        </div>
      </div>

      {/* 年度热力图 */}
      <section className="animate-fade-in delay-4">
        <YearHeatmap key={`heatmap-${refreshKey}`} />
      </section>

      {/* 生物钟档案 */}
      <section className="animate-fade-in delay-5">
        <BioClockProfile key={`bioclock-${refreshKey}`} />
      </section>
    </div>
  );
}
