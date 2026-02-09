'use client';

import DailyDigest from '@/components/DailyDigest';
import AIWeeklyAnalysis from '@/components/AIWeeklyAnalysis';
import AITrends from '@/components/AITrends';
import OutlookSimulator from '@/components/OutlookSimulator';
import AITimeInsights from '@/components/AITimeInsights';

interface InsightsPageProps {
  refreshKey: number;
}

export default function InsightsPage({ refreshKey }: InsightsPageProps) {
  return (
    <div className="space-y-8 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI 洞察</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          AI 帮你看 — 个性化分析、预测与建议
        </p>
      </div>

      {/* ===== Section 1: 今日 AI 报告 ===== */}
      <section className="animate-fade-in">
        <DailyDigest key={`digest-${refreshKey}`} />
      </section>

      {/* ===== Section 2: 周度复盘 ===== */}
      <section className="animate-fade-in delay-1">
        <div className="flex items-center gap-2 px-1 mb-4">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-blue-400 to-indigo-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">周度复盘</h2>
        </div>
        <AIWeeklyAnalysis key={`weekly-${refreshKey}`} />
      </section>

      {/* ===== Section 3: 趋势解读 ===== */}
      <section className="animate-fade-in delay-2">
        <div className="flex items-center gap-2 px-1 mb-4">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-rose-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">趋势解读</h2>
        </div>
        <AITrends key={`trends-${refreshKey}`} />
      </section>

      {/* ===== Section 4: 明日展望与时间建议 ===== */}
      <section className="animate-fade-in delay-3">
        <div className="flex items-center gap-2 px-1 mb-4">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">明日展望与时间建议</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OutlookSimulator key={`outlook-${refreshKey}`} />
          <AITimeInsights key={`aitime-${refreshKey}`} />
        </div>
      </section>

    </div>
  );
}
