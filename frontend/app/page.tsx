'use client';

import { useState, useCallback } from 'react';
import Sidebar, { PageId } from '@/components/Sidebar';
import RecordPage from '@/components/pages/RecordPage';
import AnalyticsPage from '@/components/pages/AnalyticsPage';
import InsightsPage from '@/components/pages/InsightsPage';
import AchievementsPage from '@/components/pages/AchievementsPage';
import SettingsPage from '@/components/pages/SettingsPage';
import LoginScreen from '@/components/LoginScreen';
import PublicFeedPage from '@/components/pages/PublicFeedPage';
import ChatAssistant from '@/components/ChatAssistant';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageId>('record');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const { showToast } = useToast();
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();

  const handlePageChange = useCallback((page: PageId) => {
    setCurrentPage(page);
    // 只在切换到非 record 页面时刷新该页面数据
    // record 页面保持状态，不刷新（避免丢失正在分析的临时记录）
    if (page !== 'record') {
      setRefreshKey(k => k + 1);
    }
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setShowLogin(false);
    showToast('info', '已退出登录');
  }, [logout, showToast]);

  const handleLogin = useCallback(async (password: string) => {
    const success = await login(password);
    if (success) {
      setShowLogin(false);
    }
    return success;
  }, [login]);

  // 认证检查
  if (authLoading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <div className="text-[var(--text-tertiary)] text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  // 未登录：显示公开页面或登录界面
  if (!isAuthenticated) {
    if (showLogin) {
      return <LoginScreen onLogin={handleLogin} onBack={() => setShowLogin(false)} />;
    }
    return <PublicFeedPage onEnterPrivate={() => setShowLogin(true)} />;
  }

  // 渲染当前页面
  const renderPage = () => {
    switch (currentPage) {
      case 'record':
        return <RecordPage refreshKey={refreshKey} />;
      case 'analytics':
        return <AnalyticsPage refreshKey={refreshKey} />;
      case 'insights':
        return <InsightsPage refreshKey={refreshKey} />;
      case 'achievements':
        return <AchievementsPage refreshKey={refreshKey} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <RecordPage refreshKey={refreshKey} />;
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* 侧栏导航 */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={handlePageChange} 
        onLogout={handleLogout}
      />

      {/* 主内容区域 */}
      <main className="md:ml-[72px] min-h-screen">
        <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl pt-16 md:pt-8">
          {renderPage()}
        </div>
      </main>

      {/* AI 对话助手 - 浮动按钮 */}
      <ChatAssistant />
    </div>
  );
}
