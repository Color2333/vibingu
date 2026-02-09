'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Calendar, Activity, Brain } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/components/LoginScreen';
import CircadianChart from '@/components/CircadianChart';
import YearHeatmap from '@/components/YearHeatmap';
import TodaySnapshot from '@/components/TodaySnapshot';
import WeeklyPattern from '@/components/WeeklyPattern';
import DimensionRadar from '@/components/DimensionRadar';
import TagCloud from '@/components/TagCloud';
import EmotionTrend from '@/components/EmotionTrend';
import PredictionCard from '@/components/PredictionCard';
import AnomalyDetector from '@/components/AnomalyDetector';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import KnowledgeSearch from '@/components/KnowledgeSearch';

export default function InsightsPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-[var(--text-tertiary)] animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] transition-colors"
            aria-label="返回首页"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">时间智能洞察</h1>
            <p className="text-sm text-[var(--text-tertiary)]">
              深入了解你的生活节律与模式
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4 text-center">
            <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-xs text-[var(--text-tertiary)]">昼夜节律</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Calendar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-xs text-[var(--text-tertiary)]">周期分析</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Activity className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-xs text-[var(--text-tertiary)]">活动热力</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Brain className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <div className="text-xs text-[var(--text-tertiary)]">AI 洞察</div>
          </div>
        </div>

        {/* Today Snapshot - Full width */}
        <section className="mb-6 animate-fade-in">
          <TodaySnapshot />
        </section>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <section className="animate-fade-in delay-1">
              <CircadianChart />
            </section>
            
            <section className="animate-fade-in delay-3">
              <WeeklyPattern />
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <section className="animate-fade-in delay-2">
              <DimensionRadar />
            </section>
            
            <section className="animate-fade-in delay-4">
              <TagCloud days={60} />
            </section>
          </div>
        </div>

        {/* Emotion Trend - Full width */}
        <section className="mt-6 animate-fade-in delay-5">
          <EmotionTrend days={30} />
        </section>

        {/* Year Heatmap - Full width */}
        <section className="mt-6 animate-fade-in delay-5">
          <YearHeatmap />
        </section>

        {/* AI 预测与分析 */}
        <section className="mt-8 pt-8 border-t border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            AI 预测与分析
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PredictionCard />
            <AnomalyDetector />
            <WhatIfSimulator />
          </div>
        </section>

        {/* 个人知识库 RAG */}
        <section className="mt-8 pt-8 border-t border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            个人知识库
          </h2>
          <KnowledgeSearch />
        </section>
      </div>
    </div>
  );
}
