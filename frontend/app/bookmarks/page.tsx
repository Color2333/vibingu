'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Clock, Star } from 'lucide-react';

interface BookmarkedRecord {
  id: string;
  input_type: string;
  category: string | null;
  raw_content: string | null;
  ai_insight: string | null;
  created_at: string | null;
  record_time: string | null;
  tags?: string[];
  is_bookmarked?: boolean;
}

const categoryLabels: Record<string, string> = {
  SLEEP: '睡眠', DIET: '饮食', SCREEN: '屏幕', ACTIVITY: '运动',
  MOOD: '心情', SOCIAL: '社交', WORK: '工作', GROWTH: '成长', LEISURE: '休闲',
};

export default function BookmarksPage() {
  const router = useRouter();
  const [records, setRecords] = useState<BookmarkedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/history?bookmarked=true&limit=100');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const toggleBookmark = async (id: string) => {
    try {
      const token = localStorage.getItem('vibingu_token');
      const res = await fetch(`/api/feed/${id}/bookmark`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_bookmarked: false }),
      });
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-amber-400 fill-amber-400" />
              我的收藏
            </h1>
            <span className="text-sm text-[var(--text-tertiary)]">{records.length} 条</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4 opacity-30" />
            <p className="text-[var(--text-tertiary)]">暂无收藏记录</p>
            <p className="text-[var(--text-tertiary)] opacity-60 text-sm mt-1">点击记录卡片上的书签图标添加收藏</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="glass-card p-4 hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
                onClick={() => router.push(`/record/${record.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {record.category && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
                          {categoryLabels[record.category] || record.category}
                        </span>
                      )}
                      {record.record_time && (
                        <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(record.record_time).toLocaleDateString('zh-CN', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                      {record.raw_content || record.ai_insight || '无文本内容'}
                    </p>
                    {record.tags && record.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {record.tags.slice(0, 4).map((tag, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(record.id); }}
                    className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
                    title="取消收藏"
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
