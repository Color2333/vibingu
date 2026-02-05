'use client';

import VibingCard from '@/components/VibingCard';
import VibeTrendChart from '@/components/VibeTrendChart';
import DimensionRadar from '@/components/DimensionRadar';
import TagCloud from '@/components/TagCloud';
import CircadianChart from '@/components/CircadianChart';
import YearHeatmap from '@/components/YearHeatmap';
import WeeklyPattern from '@/components/WeeklyPattern';
import BioClockProfile from '@/components/BioClockProfile';
import AIWeeklyAnalysis from '@/components/AIWeeklyAnalysis';
import AITrends from '@/components/AITrends';
import AITimeInsights from '@/components/AITimeInsights';

interface AnalyticsPageProps {
  refreshKey: number;
}

export default function AnalyticsPage({ refreshKey }: AnalyticsPageProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">数据分析</h1>
        <p className="text-sm text-white/40 mt-1">AI 驱动的数据可视化与洞察</p>
      </div>

      {/* AI 周度分析 - 优先展示 */}
      <section className="animate-fade-in">
        <AIWeeklyAnalysis key={`ai-weekly-${refreshKey}`} />
      </section>

      {/* 今日状态卡片 */}
      <section className="animate-fade-in delay-1">
        <VibingCard key={`vibe-${refreshKey}`} />
      </section>

      {/* 趋势图表 */}
      <section className="animate-fade-in delay-2">
        <VibeTrendChart key={`trend-${refreshKey}`} />
      </section>

      {/* 两列布局：雷达图 + 标签云 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="animate-fade-in delay-3">
          <DimensionRadar key={`radar-${refreshKey}`} />
        </section>
        <section className="animate-fade-in delay-3">
          <TagCloud key={`tags-${refreshKey}`} />
        </section>
      </div>

      {/* AI 趋势分析 */}
      <section className="animate-fade-in delay-4">
        <AITrends key={`ai-trends-${refreshKey}`} />
      </section>

      {/* 时间智能分析 */}
      <div className="pt-4 border-t border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white/80 mb-4">时间节律分析</h2>
        
        {/* AI 时间洞察 - 新增 */}
        <section className="animate-fade-in delay-5 mb-6">
          <AITimeInsights key={`ai-time-${refreshKey}`} />
        </section>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="animate-fade-in delay-6">
            <CircadianChart key={`circadian-${refreshKey}`} />
          </section>
          <section className="animate-fade-in delay-6">
            <WeeklyPattern key={`weekly-${refreshKey}`} />
          </section>
        </div>
      </div>

      {/* 年度热力图 */}
      <section className="animate-fade-in delay-7">
        <YearHeatmap key={`heatmap-${refreshKey}`} />
      </section>

      {/* 生物钟档案 */}
      <section className="animate-fade-in delay-8">
        <BioClockProfile key={`bioclock-${refreshKey}`} />
      </section>
    </div>
  );
}
