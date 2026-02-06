'use client';

import { useState } from 'react';
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

type TabId = 'overview' | 'time' | 'ai';

export default function AnalyticsPage({ refreshKey }: AnalyticsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">数据分析</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">AI 驱动的数据可视化与洞察</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { id: 'overview', label: '综合概览', emoji: '📊' },
          { id: 'time', label: '时间节律', emoji: '⏰' },
          { id: 'ai', label: 'AI 分析', emoji: '🤖' },
        ] as { id: TabId; label: string; emoji: string }[]).map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] border border-transparent'
            }`}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
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

          {/* 年度热力图 */}
          <section className="animate-fade-in delay-3">
            <YearHeatmap key={`heatmap-${refreshKey}`} />
          </section>
        </div>
      )}

      {/* Time Tab */}
      {activeTab === 'time' && (
        <div className="space-y-6">
          {/* AI 时间洞察 */}
          <section className="animate-fade-in">
            <AITimeInsights key={`ai-time-${refreshKey}`} />
          </section>

          {/* 两列：节律图 + 周模式 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="animate-fade-in delay-1">
              <CircadianChart key={`circadian-${refreshKey}`} />
            </section>
            <section className="animate-fade-in delay-1">
              <WeeklyPattern key={`weekly-${refreshKey}`} />
            </section>
          </div>

          {/* 生物钟档案 */}
          <section className="animate-fade-in delay-2">
            <BioClockProfile key={`bioclock-${refreshKey}`} />
          </section>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* AI 周度分析 */}
          <section className="animate-fade-in">
            <AIWeeklyAnalysis key={`ai-weekly-${refreshKey}`} />
          </section>

          {/* AI 趋势分析 */}
          <section className="animate-fade-in delay-1">
            <AITrends key={`ai-trends-${refreshKey}`} />
          </section>
        </div>
      )}
    </div>
  );
}
