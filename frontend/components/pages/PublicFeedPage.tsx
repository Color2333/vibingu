'use client';

import { useState, useEffect } from 'react';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Users, Briefcase, BookOpen, Gamepad2, Lock
} from 'lucide-react';

interface PublicRecord {
  id: string;
  input_type: string;
  category: string;
  raw_content: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string | null;
  created_at: string;
  record_time: string | null;
  image_saved: boolean;
  image_path: string | null;
  tags: string[] | null;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  SLEEP: { icon: <Moon className="w-4 h-4" />, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', label: '睡眠' },
  DIET: { icon: <Utensils className="w-4 h-4" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: '饮食' },
  SCREEN: { icon: <Smartphone className="w-4 h-4" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10', label: '屏幕' },
  ACTIVITY: { icon: <Activity className="w-4 h-4" />, color: 'text-green-400', bgColor: 'bg-green-500/10', label: '运动' },
  MOOD: { icon: <Smile className="w-4 h-4" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10', label: '心情' },
  SOCIAL: { icon: <Users className="w-4 h-4" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10', label: '社交' },
  WORK: { icon: <Briefcase className="w-4 h-4" />, color: 'text-slate-400', bgColor: 'bg-slate-500/10', label: '工作' },
  GROWTH: { icon: <BookOpen className="w-4 h-4" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: '成长' },
  LEISURE: { icon: <Gamepad2 className="w-4 h-4" />, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: '休闲' },
};

interface PublicFeedPageProps {
  onEnterPrivate: () => void;
}

export default function PublicFeedPage({ onEnterPrivate }: PublicFeedPageProps) {
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicRecords = async () => {
      try {
        const res = await fetch('/api/feed/public?limit=30');
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
        }
      } catch (error) {
        console.error('Failed to fetch public records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicRecords();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Vibing u</h1>
              <p className="text-xs text-[var(--text-tertiary)]">公开动态</p>
            </div>
          </div>
          <button
            onClick={onEnterPrivate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Lock className="w-4 h-4" />
            私密空间
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-[var(--glass-bg)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🌟</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">暂无公开内容</h2>
            <p className="text-[var(--text-tertiary)]">还没有分享的生活记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(record => {
              const config = categoryConfig[record.category] || categoryConfig.MOOD;
              const meta = record.meta_data || {};
              const analysis = meta.analysis as string | undefined;
              
              return (
                <div 
                  key={record.id}
                  className="p-5 rounded-2xl glass-card hover:bg-[var(--glass-bg)] transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${config.bgColor}`}>
                      <span className={config.color}>{config.icon}</span>
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                      <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                        <Clock className="w-3 h-3" />
                        {formatTime(record.record_time || record.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  {record.raw_content && !record.raw_content.startsWith('/') && (
                    <p className="text-[var(--text-primary)] mb-3 leading-relaxed">
                      {record.raw_content.length > 200 
                        ? record.raw_content.slice(0, 200) + '...' 
                        : record.raw_content}
                    </p>
                  )}
                  
                  {/* AI Insight */}
                  {record.ai_insight && record.ai_insight !== '已记录' && (
                    <p className="text-sm text-indigo-400 mb-3">
                      💬 {record.ai_insight}
                    </p>
                  )}
                  
                  {/* Analysis */}
                  {analysis && (
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                      {analysis}
                    </p>
                  )}
                  
                  {/* Tags */}
                  {record.tags && record.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {record.tags.slice(0, 5).map((tag, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 mt-12">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <p className="text-[var(--text-tertiary)] text-sm">
            Vibing u - Digitize Your Vibe ✨
          </p>
        </div>
      </footer>
    </div>
  );
}
