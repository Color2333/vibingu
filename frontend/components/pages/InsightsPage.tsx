'use client';

import AISmartSuggestions from '@/components/AISmartSuggestions';
import HealthAlerts from '@/components/HealthAlerts';
import PredictionCard from '@/components/PredictionCard';
import AnomalyDetector from '@/components/AnomalyDetector';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import KnowledgeSearch from '@/components/KnowledgeSearch';

interface InsightsPageProps {
  refreshKey: number;
}

export default function InsightsPage({ refreshKey }: InsightsPageProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">AI 洞察</h1>
        <p className="text-sm text-white/40 mt-1">AI 驱动的个性化分析与建议</p>
      </div>

      {/* AI 智能建议 - 优先展示 */}
      <section className="animate-fade-in">
        <AISmartSuggestions key={`ai-suggestions-${refreshKey}`} />
      </section>

      {/* 健康提醒 */}
      <section className="animate-fade-in delay-1">
        <HealthAlerts key={`alerts-${refreshKey}`} />
      </section>

      {/* 预测与分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="animate-fade-in delay-2">
          <PredictionCard key={`prediction-${refreshKey}`} />
        </section>
        <section className="animate-fade-in delay-2">
          <AnomalyDetector key={`anomaly-${refreshKey}`} />
        </section>
      </div>

      {/* What-If 模拟器 */}
      <section className="animate-fade-in delay-3">
        <WhatIfSimulator key={`whatif-${refreshKey}`} />
      </section>

      {/* 知识库搜索 - AI 问答 */}
      <section className="animate-fade-in delay-4 pt-4 border-t border-white/[0.06]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white/80">AI 知识库</h2>
          <p className="text-xs text-white/40 mt-1">向 AI 提问，基于你的历史数据获取洞察</p>
        </div>
        <KnowledgeSearch key={`knowledge-${refreshKey}`} />
      </section>
    </div>
  );
}
