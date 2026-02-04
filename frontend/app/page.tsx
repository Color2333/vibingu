'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import MagicInputBar from '@/components/MagicInputBar';
import FeedHistory from '@/components/FeedHistory';
import VibingCard from '@/components/VibingCard';
import VibeTrendChart from '@/components/VibeTrendChart';
import SmartSuggestions from '@/components/SmartSuggestions';
import ReminderSettings from '@/components/ReminderSettings';
import EmptyState from '@/components/EmptyState';
import LoginScreen from '@/components/LoginScreen';
import Milestones from '@/components/Milestones';
import Goals from '@/components/Goals';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';

interface FeedItem {
  id: string;
  input_type: string;
  category: string | null;
  raw_content: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string | null;
  created_at: string;
  image_saved?: boolean;
  image_type?: string;
  image_path?: string;
  thumbnail_path?: string;
}

export default function Home() {
  const [feedHistory, setFeedHistory] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch('/api/feed/history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setFeedHistory(data);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setIsFirstLoad(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated, fetchHistory]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    fetchHistory();
    showToast('info', '数据已刷新');
  }, [fetchHistory, showToast]);

  const handleFeedSuccess = useCallback((response: {
    id: string;
    category: string | null;
    meta_data: Record<string, unknown> | null;
    ai_insight: string;
    created_at: string;
  }) => {
    showToast('success', response.ai_insight || '记录成功！');
    setRefreshKey((k) => k + 1);
    fetchHistory();
  }, [fetchHistory, showToast]);

  // 认证检查 - 放在所有 hooks 之后
  if (authLoading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-white/30 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  const hasData = feedHistory.length > 0;

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-36">
        {/* Header */}
        <Header onRefresh={handleRefresh} onLogout={logout} />

        {/* Main Vibe Score */}
        <section className="animate-fade-in delay-1">
          <VibingCard key={`vibe-${refreshKey}`} />
        </section>

        {/* Trend Chart */}
        <section className="mt-6 animate-fade-in delay-2">
          <VibeTrendChart key={`trend-${refreshKey}`} />
        </section>

        {/* Smart Suggestions */}
        <section className="mt-6 animate-fade-in delay-3">
          <SmartSuggestions key={`suggestions-${refreshKey}`} />
        </section>

        {/* Milestones */}
        <section className="mt-6 animate-fade-in delay-4">
          <Milestones />
        </section>

        {/* Goals */}
        <section className="mt-6 animate-fade-in delay-5">
          <Goals />
        </section>

        {/* Reminder Settings */}
        <section className="mt-6 animate-fade-in">
          <ReminderSettings />
        </section>

        {/* Feed History */}
        <section className="mt-8 animate-fade-in delay-5">
          {isFirstLoad ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 skeleton rounded-2xl" />
              ))}
            </div>
          ) : hasData ? (
            <FeedHistory items={feedHistory} isLoading={isLoading} />
          ) : (
            <EmptyState />
          )}
        </section>
      </div>

      {/* Fixed Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent">
        <div className="container mx-auto max-w-2xl">
          <MagicInputBar onSuccess={handleFeedSuccess} onLoading={setIsLoading} />
        </div>
      </div>
    </div>
  );
}
