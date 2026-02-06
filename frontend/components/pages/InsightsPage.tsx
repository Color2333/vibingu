'use client';

import DailyDigest from '@/components/DailyDigest';
import DimensionDeepDive from '@/components/DimensionDeepDive';
import OutlookSimulator from '@/components/OutlookSimulator';

interface InsightsPageProps {
  refreshKey: number;
}

export default function InsightsPage({ refreshKey }: InsightsPageProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI 洞察</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          AI 驱动的个性化分析与建议
        </p>
      </div>

      {/* 模块一：今日 AI 洞察 */}
      <section className="animate-fade-in">
        <DailyDigest key={`digest-${refreshKey}`} />
      </section>

      {/* 模块二：八维度深度分析 */}
      <section className="animate-fade-in delay-1">
        <DimensionDeepDive key={`dimensions-${refreshKey}`} />
      </section>

      {/* 模块三：明日展望 + What-If 模拟 */}
      <section className="animate-fade-in delay-2">
        <OutlookSimulator key={`outlook-${refreshKey}`} />
      </section>
    </div>
  );
}
