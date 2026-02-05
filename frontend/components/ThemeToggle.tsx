'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useState, useRef, useEffect } from 'react';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // 简单切换按钮
  if (!showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-xl transition-all hover:bg-[var(--glass-bg)] ${className}`}
        title={resolvedTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-500" />
        )}
      </button>
    );
  }

  // 带菜单的切换按钮
  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-[var(--glass-bg)] text-[var(--text-secondary)]"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        )}
        <span className="text-sm">
          {theme === 'system' ? '跟随系统' : resolvedTheme === 'dark' ? '深色' : '浅色'}
        </span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]">
          <button
            onClick={() => { setTheme('light'); setShowMenu(false); }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--glass-bg)] ${
              theme === 'light' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Sun className="w-4 h-4" />
            浅色
          </button>
          <button
            onClick={() => { setTheme('dark'); setShowMenu(false); }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--glass-bg)] ${
              theme === 'dark' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Moon className="w-4 h-4" />
            深色
          </button>
          <button
            onClick={() => { setTheme('system'); setShowMenu(false); }}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--glass-bg)] ${
              theme === 'system' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            跟随系统
          </button>
        </div>
      )}
    </div>
  );
}
