'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar, { PageId } from '@/components/Sidebar';
import RecordPage from '@/components/pages/RecordPage';
import LoginScreen from '@/components/LoginScreen';
import PublicFeedPage from '@/components/pages/PublicFeedPage';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';

// 懒加载非首屏页面 — 减少初始 JS bundle 体积（recharts 等重依赖延迟加载）
const AnalyticsPage = dynamic(() => import('@/components/pages/AnalyticsPage'), {
  loading: () => <PageSkeleton />,
});
const InsightsPage = dynamic(() => import('@/components/pages/InsightsPage'), {
  loading: () => <PageSkeleton />,
});
const AchievementsPage = dynamic(() => import('@/components/pages/AchievementsPage'), {
  loading: () => <PageSkeleton />,
});
const SettingsPage = dynamic(() => import('@/components/pages/SettingsPage'), {
  loading: () => <PageSkeleton />,
});
const ChatPage = dynamic(() => import('@/components/pages/ChatPage'), {
  loading: () => <PageSkeleton />,
});

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-[var(--glass-bg)] rounded-xl" />
      <div className="h-4 w-32 bg-[var(--glass-bg)] rounded-lg" />
      <div className="h-64 bg-[var(--glass-bg)] rounded-2xl mt-6" />
      <div className="h-48 bg-[var(--glass-bg)] rounded-2xl" />
    </div>
  );
}

// 需要保持状态的页面（切换后不卸载）
const KEEP_ALIVE_PAGES: PageId[] = ['record', 'chat'];

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageId>('record');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const { showToast } = useToast();
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();

  // 记录已经挂载过的页面（keep-alive 用）
  const mountedPages = useRef<Set<PageId>>(new Set<PageId>(['record']));

  const handlePageChange = useCallback((page: PageId) => {
    setCurrentPage(page);
    mountedPages.current.add(page);
    // 非 keep-alive 页面切换时刷新数据
    if (!KEEP_ALIVE_PAGES.includes(page)) {
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

  // 判断一个页面是否应该保持在 DOM 中
  const shouldMount = (page: PageId) => {
    if (page === currentPage) return true;
    // keep-alive 页面：只要曾经挂载过就保留
    return KEEP_ALIVE_PAGES.includes(page) && mountedPages.current.has(page);
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
          {/* Keep-alive 页面：用 display 控制显隐，不卸载 */}
          <div style={{ display: currentPage === 'record' ? 'block' : 'none' }}>
            {shouldMount('record') && <RecordPage refreshKey={refreshKey} />}
          </div>

          <div style={{ display: currentPage === 'chat' ? 'block' : 'none' }}>
            {shouldMount('chat') && <ChatPage />}
          </div>

          {/* 非 keep-alive 页面：正常 switch 渲染 */}
          {currentPage === 'analytics' && <AnalyticsPage refreshKey={refreshKey} />}
          {currentPage === 'insights' && <InsightsPage refreshKey={refreshKey} />}
          {currentPage === 'achievements' && <AchievementsPage refreshKey={refreshKey} />}
          {currentPage === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
