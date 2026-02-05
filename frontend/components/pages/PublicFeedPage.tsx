'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Users, Briefcase, BookOpen, Gamepad2, Lock, Sparkles,
  TrendingUp, Calendar, Heart, Zap, Star, ArrowRight,
  BarChart3, Image as ImageIcon
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
  thumbnail_path: string | null;
  tags: string[] | null;
}

interface PublicStats {
  total_records: number;
  total_days: number;
  category_distribution: Record<string, number>;
  avg_score: number | null;
  recent_streak: number;
  top_tags: string[];
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string; gradient: string }> = {
  SLEEP: { icon: <Moon className="w-4 h-4" />, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', label: '睡眠', gradient: 'from-indigo-500 to-violet-500' },
  DIET: { icon: <Utensils className="w-4 h-4" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: '饮食', gradient: 'from-orange-500 to-amber-500' },
  SCREEN: { icon: <Smartphone className="w-4 h-4" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10', label: '屏幕', gradient: 'from-blue-500 to-cyan-500' },
  ACTIVITY: { icon: <Activity className="w-4 h-4" />, color: 'text-green-400', bgColor: 'bg-green-500/10', label: '运动', gradient: 'from-green-500 to-emerald-500' },
  MOOD: { icon: <Smile className="w-4 h-4" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10', label: '心情', gradient: 'from-pink-500 to-rose-500' },
  SOCIAL: { icon: <Users className="w-4 h-4" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10', label: '社交', gradient: 'from-purple-500 to-fuchsia-500' },
  WORK: { icon: <Briefcase className="w-4 h-4" />, color: 'text-slate-400', bgColor: 'bg-slate-500/10', label: '工作', gradient: 'from-slate-500 to-gray-500' },
  GROWTH: { icon: <BookOpen className="w-4 h-4" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: '成长', gradient: 'from-cyan-500 to-teal-500' },
  LEISURE: { icon: <Gamepad2 className="w-4 h-4" />, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: '休闲', gradient: 'from-amber-500 to-yellow-500' },
};

interface PublicFeedPageProps {
  onEnterPrivate: () => void;
}

export default function PublicFeedPage({ onEnterPrivate }: PublicFeedPageProps) {
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recordsRes, statsRes] = await Promise.all([
          fetch('/api/feed/public?limit=50'),
          fetch('/api/feed/public/stats'),
        ]);
        
        if (recordsRes.ok) {
          const data = await recordsRes.json();
          setRecords(data);
        }
        
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch public data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 筛选记录
  const filteredRecords = useMemo(() => {
    if (!selectedCategory) return records;
    return records.filter(r => r.category === selectedCategory);
  }, [records, selectedCategory]);

  // 计算统计数据
  const computedStats = useMemo(() => {
    if (stats) return stats;
    
    // 从记录中计算基本统计
    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    const dates = new Set<string>();
    
    records.forEach(r => {
      categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
      const dateKey = new Date(r.record_time || r.created_at).toISOString().split('T')[0];
      dates.add(dateKey);
      r.tags?.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
    
    return {
      total_records: records.length,
      total_days: dates.size,
      category_distribution: categoryCount,
      avg_score: null,
      recent_streak: 0,
      top_tags: topTags,
    };
  }, [records, stats]);

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

  // 获取分类分布（用于展示）
  const categoryDistribution = useMemo(() => {
    const dist = computedStats.category_distribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    return Object.entries(dist)
      .map(([cat, count]) => ({
        category: cat,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [computedStats]);

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-4 max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Vibing u</h1>
              <p className="text-xs text-[var(--text-tertiary)]">公开生活广场</p>
            </div>
          </div>
          <button
            onClick={onEnterPrivate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl text-sm text-white font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            <Lock className="w-4 h-4" />
            进入私密空间
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-12 max-w-5xl relative">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Digitize Your Vibe
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
              记录生活的每一个瞬间，用 AI 发现「最佳状态」的秘密
            </p>
          </div>

          {/* Stats Cards */}
          {!loading && computedStats.total_records > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{computedStats.total_records}</div>
                <div className="text-xs text-[var(--text-tertiary)]">公开记录</div>
              </div>
              
              <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{computedStats.total_days}</div>
                <div className="text-xs text-[var(--text-tertiary)]">活跃天数</div>
              </div>
              
              <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{categoryDistribution.length}</div>
                <div className="text-xs text-[var(--text-tertiary)]">生活维度</div>
              </div>
              
              <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{computedStats.top_tags.length}</div>
                <div className="text-xs text-[var(--text-tertiary)]">热门话题</div>
              </div>
            </div>
          )}

          {/* Category Distribution */}
          {!loading && categoryDistribution.length > 0 && (
            <div className="glass-card p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">生活分布</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedCategory === null
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                      : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  全部 ({records.length})
                </button>
                {categoryDistribution.map(({ category, count, percentage }) => {
                  const config = categoryConfig[category];
                  if (!config) return null;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                        selectedCategory === category
                          ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                          : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {config.icon}
                      <span>{config.label}</span>
                      <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Tags */}
          {!loading && computedStats.top_tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {computedStats.top_tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-full text-sm bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-indigo-500/50 hover:text-indigo-400 transition-colors cursor-default"
                >
                  <Star className="w-3 h-3 inline mr-1 opacity-60" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 pb-12 max-w-5xl">
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-[var(--glass-bg)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl">
            <div className="text-6xl mb-4">🌟</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {selectedCategory ? '该分类暂无公开内容' : '暂无公开内容'}
            </h2>
            <p className="text-[var(--text-tertiary)] mb-6">还没有分享的生活记录</p>
            <button
              onClick={onEnterPrivate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white font-medium hover:shadow-lg transition-all"
            >
              开始记录你的生活
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredRecords.map(record => {
              const config = categoryConfig[record.category] || categoryConfig.MOOD;
              const meta = record.meta_data || {};
              const analysis = meta.analysis as string | undefined;
              const score = (meta.health_score || meta.score) as number | undefined;
              const durationHours = meta.duration_hours as number | undefined;
              
              return (
                <div 
                  key={record.id}
                  className="group p-5 rounded-2xl glass-card hover:bg-[var(--glass-bg)] transition-all hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${config.gradient} shadow-lg`}>
                      <span className="text-white">{config.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{config.label}</span>
                        {score !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                            score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {score}分
                          </span>
                        )}
                        {durationHours && record.category === 'SLEEP' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                            {durationHours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                        <Clock className="w-3 h-3" />
                        {formatTime(record.record_time || record.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  {(() => {
                    const content = record.raw_content;
                    if (content && !content.startsWith('/') && !content.includes('/Users/')) {
                      return (
                        <p className="text-[var(--text-primary)] mb-3 leading-relaxed">
                          {content.length > 150 ? content.slice(0, 150) + '...' : content}
                        </p>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Image */}
                  {record.image_saved && record.thumbnail_path && (
                    <button
                      onClick={() => setShowImageModal(record.image_path || record.thumbnail_path)}
                      className="relative w-full h-32 mb-3 rounded-xl overflow-hidden group/img"
                    >
                      <img 
                        src={record.thumbnail_path} 
                        alt="" 
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-white" />
                      </div>
                    </button>
                  )}
                  
                  {/* AI Insight */}
                  {record.ai_insight && record.ai_insight !== '已记录' && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {record.ai_insight}
                      </p>
                    </div>
                  )}
                  
                  {/* Analysis Summary */}
                  {analysis && !record.ai_insight && (
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
                      {analysis}
                    </p>
                  )}
                  
                  {/* Tags */}
                  {record.tags && record.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {record.tags.slice(0, 4).map((tag, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)] border border-[var(--border)]"
                        >
                          #{tag}
                        </span>
                      ))}
                      {record.tags.length > 4 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
                          +{record.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CTA Section */}
      {!loading && (
        <section className="container mx-auto px-4 pb-12 max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 md:p-12">
            {/* Pattern overlay */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.15) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />
            <div className="relative text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                开始你的 Vibing 之旅
              </h3>
              <p className="text-white/80 mb-6 max-w-xl mx-auto">
                记录睡眠、饮食、运动、心情... 让 AI 帮你发现生活中的规律，找到最佳状态的密码
              </p>
              <button
                onClick={onEnterPrivate}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white rounded-xl text-indigo-600 font-semibold hover:shadow-2xl hover:scale-105 transition-all"
              >
                立即开始
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm">✨</span>
              </div>
              <span className="text-[var(--text-secondary)] font-medium">Vibing u</span>
            </div>
            <p className="text-[var(--text-tertiary)] text-sm text-center">
              Digitize Your Vibe. Optimize Your Life.
            </p>
            <p className="text-[var(--text-tertiary)] text-xs">
              v0.3.0 · 2025
            </p>
          </div>
        </div>
      </footer>

      {/* Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setShowImageModal(null)}
        >
          <button
            onClick={() => setShowImageModal(null)}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
          <img 
            src={showImageModal} 
            alt="" 
            className="max-w-full max-h-full rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
