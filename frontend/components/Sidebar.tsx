'use client';

import { useState, useEffect } from 'react';
import { 
  PenLine, 
  BarChart3, 
  Sparkles, 
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export type PageId = 'record' | 'analytics' | 'insights' | 'achievements' | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onLogout: () => void;
}

const navItems: { id: PageId; icon: React.ReactNode; label: string; description: string }[] = [
  { 
    id: 'record', 
    icon: <PenLine className="w-5 h-5" />, 
    label: '记录',
    description: '记录生活点滴'
  },
  { 
    id: 'analytics', 
    icon: <BarChart3 className="w-5 h-5" />, 
    label: '分析',
    description: '数据可视化'
  },
  { 
    id: 'insights', 
    icon: <Sparkles className="w-5 h-5" />, 
    label: '洞察',
    description: 'AI 智能建议'
  },
  { 
    id: 'achievements', 
    icon: <Trophy className="w-5 h-5" />, 
    label: '成就',
    description: '目标与徽章'
  },
  { 
    id: 'settings', 
    icon: <Settings className="w-5 h-5" />, 
    label: '设置',
    description: '偏好设置'
  },
];

export default function Sidebar({ currentPage, onPageChange, onLogout }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 点击导航项时，在移动端自动关闭侧栏
  const handleNavClick = (pageId: PageId) => {
    onPageChange(pageId);
    setIsMobileOpen(false);
  };

  // 监听 ESC 键关闭移动端侧栏
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 
                   text-white/60 hover:text-white hover:bg-white/10 transition-all md:hidden"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 侧栏 */}
      <aside 
        className={`
          fixed top-0 left-0 h-full z-50
          flex flex-col
          bg-[#0c0c12]/95 backdrop-blur-xl
          border-r border-white/[0.06]
          transition-all duration-300 ease-out
          ${isExpanded ? 'w-56' : 'w-[72px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo 区域 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06]">
          {isExpanded ? (
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Vibing u
            </span>
          ) : (
            <span className="text-xl">✨</span>
          )}
          
          {/* 移动端关闭按钮 */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 导航项 */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl
                  transition-all duration-200
                  group relative
                  ${isActive 
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white border border-indigo-500/30' 
                    : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`}>
                  {item.icon}
                </span>
                
                {isExpanded && (
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[10px] text-white/30">{item.description}</div>
                  </div>
                )}

                {/* 未展开时的 Tooltip */}
                {!isExpanded && (
                  <div className="
                    absolute left-full ml-2 px-3 py-2 
                    bg-[#1a1a24] rounded-lg border border-white/10
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                    transition-all duration-200 whitespace-nowrap z-50
                    pointer-events-none
                  ">
                    <div className="text-sm text-white">{item.label}</div>
                    <div className="text-[10px] text-white/40">{item.description}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* 底部操作区 */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {/* 展开/收起按钮 - 仅桌面端 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                       text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            {isExpanded ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">收起</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* 退出按钮 */}
          <button
            onClick={onLogout}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all
              ${isExpanded ? '' : 'justify-center'}
            `}
          >
            <LogOut className="w-4 h-4" />
            {isExpanded && <span className="text-sm">退出登录</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
