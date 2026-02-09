'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileText, Menu, X, RefreshCw, Eye, LogOut, Calendar, Brain, Search, Clock, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  input_type: string;
  category: string | null;
  raw_content: string | null;
  ai_insight: string | null;
  created_at: string | null;
  record_time: string | null;
  sub_categories?: string[];
  tags?: string[];
  is_bookmarked?: boolean;
}

interface HeaderProps {
  onRefresh?: () => void;
  onLogout?: () => void;
}

export default function Header({ onRefresh, onLogout }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearch]);

  // Focus input when search opens
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Use RAG semantic search for best results
      const res = await fetch(`/api/rag/search?q=${encodeURIComponent(q)}&n=8`);
      if (res.ok) {
        const data = await res.json();
        // Map RAG results to our SearchResult format
        setSearchResults((data.results || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          input_type: 'TEXT',
          category: ((r.metadata as Record<string, unknown>)?.category as string) || null,
          raw_content: (r.document as string) || null,
          ai_insight: null,
          created_at: ((r.metadata as Record<string, unknown>)?.created_at as string) || null,
          record_time: ((r.metadata as Record<string, unknown>)?.record_time as string) || null,
        })));
      }
    } catch {
      // fallback to history search
      try {
        const res = await fetch(`/api/feed/history?search=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        setSearchResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(value), 300);
  };

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

      {/* Search + Menu */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) { setSearchQuery(''); setSearchResults([]); } }}
            className={`p-2.5 rounded-xl btn transition-all ${
              showSearch
                ? 'glass-subtle text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>

          {showSearch && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass rounded-2xl z-50 animate-scale-in overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
                  <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="搜索记录..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-white/40 hover:text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {isSearching ? (
                  <div className="p-6 text-center text-white/40 text-sm">搜索中...</div>
                ) : searchResults.length > 0 ? (
                  <div className="py-1">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          router.push(`/record/${result.id}`);
                          setShowSearch(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {result.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                              {result.category}
                            </span>
                          )}
                          {result.record_time && (
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(result.record_time).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/70 line-clamp-2">
                          {result.raw_content || result.ai_insight || '无文本内容'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="p-6 text-center text-white/40 text-sm">无匹配结果</div>
                ) : (
                  <div className="p-6 text-center text-white/40 text-sm">输入关键词搜索记录</div>
                )}
              </div>
            </div>
          )}
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

              <Link
                href="/bookmarks"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                我的收藏
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
      </div>
    </header>
  );
}
