'use client';

import { useState } from 'react';
import { Download, FileText, Menu, X, RefreshCw, Eye, LogOut, Calendar, Brain } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  onRefresh?: () => void;
  onLogout?: () => void;
}

export default function Header({ onRefresh, onLogout }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export?format=${format}`);
      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vibingu_export_${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vibingu_export_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  return (
    <header className="flex items-center justify-between mb-10">
      {/* Logo */}
      <div>
        <h1 className="text-2xl font-light tracking-tight gradient-text">
          vibing u
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-0.5">
          Life Dashboard
        </p>
      </div>

      {/* Menu */}
      <div className="relative z-50">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`p-2.5 rounded-xl btn transition-all ${
            showMenu
              ? 'glass-subtle text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-48 glass rounded-2xl py-2 z-50 animate-scale-in">
              <Link
                href="/public"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Eye className="w-4 h-4" />
                公开页面
              </Link>

              <Link
                href="/timeline"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                时间线
              </Link>

              <Link
                href="/insights"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Brain className="w-4 h-4" />
                时间智能
              </Link>

              <div className="divider my-2" />

              {onRefresh && (
                <button
                  onClick={() => { onRefresh(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新数据
                </button>
              )}

              <button
                onClick={() => { window.open('/api/reports/weekly', '_blank'); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
              >
                <FileText className="w-4 h-4" />
                查看周报
              </button>

              <div className="divider my-2" />

              <button
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                导出 JSON
              </button>

              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                导出 CSV
              </button>

              {onLogout && (
                <>
                  <div className="divider my-2" />
                  <button
                    onClick={() => { onLogout(); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    登出
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
