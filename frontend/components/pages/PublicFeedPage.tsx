'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Users, Briefcase, BookOpen, Gamepad2, Lock, Sparkles,
  Calendar, Heart, Star, ArrowRight,
  BarChart3, Image as ImageIcon, X, Lightbulb, ChevronRight, Filter
} from 'lucide-react';

// ========== 类型 ==========

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
  dimension_scores: Record<string, number> | null;
}

interface PublicStats {
  total_records: number;
  total_days: number;
  category_distribution: Record<string, number>;
  avg_score: number | null;
  recent_streak: number;
  top_tags: string[];
}

// ========== 配置 ==========

const dimensionConfig: Record<string, { label: string; icon: string; color: string }> = {
  body:    { label: '身体', icon: '💪', color: 'from-green-400 to-emerald-500' },
  mood:    { label: '情绪', icon: '😊', color: 'from-pink-400 to-rose-500' },
  social:  { label: '社交', icon: '👥', color: 'from-purple-400 to-violet-500' },
  work:    { label: '工作', icon: '💼', color: 'from-slate-400 to-gray-500' },
  growth:  { label: '成长', icon: '📚', color: 'from-cyan-400 to-teal-500' },
  meaning: { label: '意义', icon: '✨', color: 'from-amber-400 to-yellow-500' },
  digital: { label: '数字', icon: '📱', color: 'from-blue-400 to-indigo-500' },
  leisure: { label: '休闲', icon: '🎮', color: 'from-orange-400 to-red-500' },
};

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string; gradient: string; dotColor: string }> = {
  SLEEP:    { icon: <Moon className="w-4 h-4" />,       color: 'text-indigo-400',  bgColor: 'bg-indigo-500/10',  label: '睡眠', gradient: 'from-indigo-500 to-violet-500',   dotColor: 'bg-indigo-400' },
  DIET:     { icon: <Utensils className="w-4 h-4" />,   color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  label: '饮食', gradient: 'from-orange-500 to-amber-500',    dotColor: 'bg-orange-400' },
  SCREEN:   { icon: <Smartphone className="w-4 h-4" />, color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    label: '屏幕', gradient: 'from-blue-500 to-cyan-500',       dotColor: 'bg-blue-400' },
  ACTIVITY: { icon: <Activity className="w-4 h-4" />,   color: 'text-green-400',   bgColor: 'bg-green-500/10',   label: '运动', gradient: 'from-green-500 to-emerald-500',   dotColor: 'bg-green-400' },
  MOOD:     { icon: <Smile className="w-4 h-4" />,      color: 'text-pink-400',    bgColor: 'bg-pink-500/10',    label: '心情', gradient: 'from-pink-500 to-rose-500',       dotColor: 'bg-pink-400' },
  SOCIAL:   { icon: <Users className="w-4 h-4" />,      color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  label: '社交', gradient: 'from-purple-500 to-fuchsia-500',  dotColor: 'bg-purple-400' },
  WORK:     { icon: <Briefcase className="w-4 h-4" />,  color: 'text-slate-400',   bgColor: 'bg-slate-500/10',   label: '工作', gradient: 'from-slate-500 to-gray-500',      dotColor: 'bg-slate-400' },
  GROWTH:   { icon: <BookOpen className="w-4 h-4" />,   color: 'text-cyan-400',    bgColor: 'bg-cyan-500/10',    label: '成长', gradient: 'from-cyan-500 to-teal-500',       dotColor: 'bg-cyan-400' },
  LEISURE:  { icon: <Gamepad2 className="w-4 h-4" />,   color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   label: '休闲', gradient: 'from-amber-500 to-yellow-500',    dotColor: 'bg-amber-400' },
};

// ========== 详情弹窗 ==========

function RecordDetailModal({ record, config, onClose }: {
  record: PublicRecord;
  config: typeof categoryConfig[string];
  onClose: () => void;
}) {
  const meta = record.meta_data || {};
  const analysis = meta.analysis as string | undefined;
  const suggestions = meta.suggestions as string[] | undefined;
  const score = (meta.health_score || meta.score) as number | undefined;
  const mood = meta.mood as string | undefined;
  const durationHours = meta.duration_hours as number | undefined;
  const note = meta.note as string | undefined;
  const scores = record.dimension_scores;
  const activeScores = scores
    ? Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    : [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
      + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--text-tertiary)]/30" />
        </div>

        {/* Header */}
        <div className="relative overflow-hidden px-6 pt-5 pb-4">
          <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-10`} />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${config.gradient} shadow-lg`}>
                <span className="text-white text-lg">{config.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg text-[var(--text-primary)]">{config.label}</span>
                  {score !== undefined && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      score >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                      score >= 50 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
                    }`}>{score}分</span>
                  )}
                  {mood && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--glass-bg)] text-[var(--text-secondary)]">{mood}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mt-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(record.record_time || record.created_at)}
                </div>
                {durationHours && record.category === 'SLEEP' && (
                  <span className="text-xs text-indigo-400 mt-0.5 block">睡眠时长 {durationHours.toFixed(1)} 小时</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {record.image_saved && record.image_path && (
            <div className="rounded-xl overflow-hidden">
              <img src={record.image_path} alt="" className="w-full max-h-64 object-cover" />
            </div>
          )}

          {(() => {
            const content = record.raw_content || note;
            if (content && !content.startsWith('/') && !content.includes('/Users/')) {
              return (
                <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{content}</p>
                </div>
              );
            }
            return null;
          })()}

          {record.ai_insight && record.ai_insight !== '已记录' && record.ai_insight.length > 4 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10">
              <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{record.ai_insight}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">AI 分析</h4>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{analysis}</p>
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> 建议
              </h4>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[var(--text-tertiary)] flex-shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeScores.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">维度评分</h4>
              <div className="grid grid-cols-2 gap-2">
                {activeScores.map(([key, value]) => {
                  const dim = dimensionConfig[key];
                  if (!dim) return null;
                  return (
                    <div key={key} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                      <span className="text-base flex-shrink-0">{dim.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[var(--text-secondary)]">{dim.label}</span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${dim.color} transition-all duration-500`} style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {record.tags && record.tags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">标签</h4>
              <div className="flex flex-wrap gap-2">
                {record.tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 text-xs rounded-full bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--border)]">#{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 日期分组工具 ==========

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateKey: string): { main: string; sub: string } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = toDateKey(now.toISOString());
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const yestKey = toDateKey(yesterday.toISOString());

  const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' });
  if (dateKey === today) return { main: '今天', sub: `${m}月${d}日 ${weekday}` };
  if (dateKey === yestKey) return { main: '昨天', sub: `${m}月${d}日 ${weekday}` };
  return { main: `${m}月${d}日`, sub: weekday };
}

// ========== 主组件 ==========

interface PublicFeedPageProps {
  onEnterPrivate: () => void;
}

export default function PublicFeedPage({ onEnterPrivate }: PublicFeedPageProps) {
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<PublicRecord | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const openDetail = useCallback((record: PublicRecord) => {
    setDetailRecord(record);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recordsRes, statsRes] = await Promise.all([
          fetch('/api/feed/public?limit=50'),
          fetch('/api/feed/public/stats'),
        ]);
        if (recordsRes.ok) setRecords(await recordsRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (error) {
        console.error('Failed to fetch public data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!selectedCategory) return records;
    return records.filter(r => r.category === selectedCategory);
  }, [records, selectedCategory]);

  // 按日期分组
  const groupedRecords = useMemo(() => {
    const groups: { dateKey: string; records: PublicRecord[] }[] = [];
    const map = new Map<string, PublicRecord[]>();
    filteredRecords.forEach(r => {
      const key = toDateKey(r.record_time || r.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    map.forEach((recs, key) => groups.push({ dateKey: key, records: recs }));
    groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return groups;
  }, [filteredRecords]);

  const computedStats = useMemo(() => {
    if (stats) return stats;
    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    const dates = new Set<string>();
    records.forEach(r => {
      categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
      dates.add(toDateKey(r.record_time || r.created_at));
      r.tags?.forEach(tag => { tagCount[tag] = (tagCount[tag] || 0) + 1; });
    });
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
    return { total_records: records.length, total_days: dates.size, category_distribution: categoryCount, avg_score: null, recent_streak: 0, top_tags: topTags };
  }, [records, stats]);

  const categoryDistribution = useMemo(() => {
    const dist = computedStats.category_distribution;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    return Object.entries(dist)
      .map(([cat, count]) => ({ category: cat, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [computedStats]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-3 max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-lg">✨</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Vibing u</h1>
              <p className="text-[10px] text-[var(--text-tertiary)]">生活时间轴</p>
            </div>
          </div>
          <button
            onClick={onEnterPrivate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl text-xs text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            <Lock className="w-3.5 h-3.5" />
            私密空间
          </button>
        </div>
      </header>

      {/* Hero — 更紧凑 */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 pt-10 pb-6 max-w-3xl relative">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Digitize Your Vibe
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-sm">
              记录每一个瞬间，用 AI 发现「最佳状态」的秘密
            </p>
          </div>

          {/* Stats — 紧凑横排 */}
          {!loading && computedStats.total_records > 0 && (
            <div className="flex justify-center gap-6 mb-6">
              {[
                { icon: <BarChart3 className="w-4 h-4 text-indigo-400" />, value: computedStats.total_records, label: '记录' },
                { icon: <Calendar className="w-4 h-4 text-emerald-400" />, value: computedStats.total_days, label: '天' },
                { icon: <Heart className="w-4 h-4 text-pink-400" />, value: categoryDistribution.length, label: '维度' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  {s.icon}
                  <span className="text-lg font-bold text-[var(--text-primary)]">{s.value}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* 标签云 */}
          {!loading && computedStats.top_tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-4">
              {computedStats.top_tags.map((tag, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-full text-xs bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--border)]">
                  <Star className="w-2.5 h-2.5 inline mr-0.5 opacity-50" />{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 分类筛选条 */}
      {!loading && categoryDistribution.length > 0 && (
        <div className="sticky top-[52px] z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex-shrink-0 p-2 rounded-lg transition-colors ${showFilter ? 'bg-indigo-500/15 text-indigo-400' : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg)]'}`}
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !selectedCategory ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
                }`}
              >全部</button>
              {categoryDistribution.map(({ category, count }) => {
                const cfg = categoryConfig[category];
                if (!cfg) return null;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === category
                        ? `${cfg.bgColor} ${cfg.color} ring-1 ring-current/20`
                        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
                    }`}
                  >
                    {cfg.icon}
                    <span>{cfg.label}</span>
                    <span className="opacity-50">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 时间轴主体 */}
      <main className="container mx-auto px-4 pb-12 max-w-3xl">
        {loading ? (
          <div className="space-y-6 pt-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="w-10 flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-[var(--glass-bg)] animate-pulse" />
                  <div className="flex-1 w-0.5 bg-[var(--glass-bg)]" />
                </div>
                <div className="flex-1 h-32 bg-[var(--glass-bg)] rounded-2xl animate-pulse mb-4" />
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🌟</div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {selectedCategory ? '该分类暂无公开内容' : '暂无公开内容'}
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-6">还没有分享的生活记录</p>
            <button onClick={onEnterPrivate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white text-sm font-medium hover:shadow-lg transition-all">
              开始记录 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="pt-4">
            {groupedRecords.map(({ dateKey, records: dayRecords }) => {
              const { main, sub } = formatDateHeader(dateKey);
              return (
                <div key={dateKey} className="relative">
                  {/* 日期标题 */}
                  <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] border border-[var(--border)]">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{main}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{sub}</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--border)] to-transparent" />
                  </div>

                  {/* 日期下的记录 — 时间轴布局 */}
                  <div className="relative ml-4 pl-6 border-l-2 border-[var(--border)]/50">
                    {dayRecords.map((record, idx) => {
                      const config = categoryConfig[record.category] || categoryConfig.MOOD;
                      const meta = record.meta_data || {};
                      const analysis = meta.analysis as string | undefined;
                      const score = (meta.health_score || meta.score) as number | undefined;
                      const durationHours = meta.duration_hours as number | undefined;

                      return (
                        <div
                          key={record.id}
                          className="relative pb-6 last:pb-2 group"
                        >
                          {/* 时间轴节点 */}
                          <div className="absolute -left-[33px] top-3 flex items-center justify-center">
                            <div className={`w-5 h-5 rounded-full ${config.dotColor} ring-4 ring-[var(--bg-primary)] flex items-center justify-center shadow-lg shadow-current/20 group-hover:scale-125 transition-transform`}>
                              <span className="text-white text-[8px] leading-none">{config.icon}</span>
                            </div>
                          </div>

                          {/* 卡片 */}
                          <div
                            onClick={() => openDetail(record)}
                            className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--border)] hover:border-[var(--glass-border)] hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer group/card"
                          >
                            {/* 头部：时间 + 分类 + 评分 */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-[var(--text-tertiary)]">
                                  {formatTime(record.record_time || record.created_at)}
                                </span>
                                <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                                {score !== undefined && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                    score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                                    score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                                  }`}>{score}分</span>
                                )}
                                {durationHours && record.category === 'SLEEP' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{durationHours.toFixed(1)}h</span>
                                )}
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            </div>

                            {/* 图片 */}
                            {record.image_saved && record.thumbnail_path && (
                              <div className="mb-2.5 rounded-xl overflow-hidden">
                                <img src={record.thumbnail_path} alt="" className="w-full h-36 object-cover group-hover/card:scale-[1.02] transition-transform duration-300" />
                              </div>
                            )}

                            {/* 文字内容 */}
                            {(() => {
                              const content = record.raw_content;
                              if (content && !content.startsWith('/') && !content.includes('/Users/')) {
                                return (
                                  <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-2">
                                    {content.length > 120 ? content.slice(0, 120) + '...' : content}
                                  </p>
                                );
                              }
                              return null;
                            })()}

                            {/* AI 洞察 */}
                            {record.ai_insight && record.ai_insight !== '已记录' && record.ai_insight.length > 4 && (
                              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">{record.ai_insight}</p>
                              </div>
                            )}

                            {/* 分析摘要 (没有 insight 时显示) */}
                            {analysis && (!record.ai_insight || record.ai_insight === '已记录') && (
                              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{analysis}</p>
                            )}

                            {/* 维度评分预览条 */}
                            {record.dimension_scores && (() => {
                              const active = Object.entries(record.dimension_scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
                              if (active.length === 0) return null;
                              return (
                                <div className="flex gap-1 mb-2">
                                  {active.map(([key, value]) => {
                                    const dim = dimensionConfig[key];
                                    if (!dim) return null;
                                    return (
                                      <div key={key} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]" title={`${dim.label} ${value}`}>
                                        <span>{dim.icon}</span>
                                        <div className="w-8 h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                                          <div className={`h-full rounded-full bg-gradient-to-r ${dim.color}`} style={{ width: `${value}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* 标签 */}
                            {record.tags && record.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {record.tags.slice(0, 4).map((tag, idx) => (
                                  <span key={idx} className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">#{tag}</span>
                                ))}
                                {record.tags.length > 4 && (
                                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">+{record.tags.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CTA */}
      {!loading && filteredRecords.length > 0 && (
        <section className="container mx-auto px-4 pb-12 max-w-3xl">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 md:p-8">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />
            <div className="relative text-center">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3">开始你的 Vibing 之旅</h3>
              <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
                记录睡眠、饮食、运动、心情... 让 AI 帮你找到最佳状态
              </p>
              <button onClick={onEnterPrivate} className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-xl text-indigo-600 font-semibold hover:shadow-2xl hover:scale-105 transition-all text-sm">
                立即开始 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-[10px]">✨</span>
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">Vibing u</span>
            </div>
            <p className="text-[var(--text-tertiary)] text-[10px]">
              Digitize Your Vibe · v0.3.0
            </p>
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      {detailRecord && (
        <RecordDetailModal
          record={detailRecord}
          config={categoryConfig[detailRecord.category] || categoryConfig.MOOD}
          onClose={() => setDetailRecord(null)}
        />
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowImageModal(null)}>
          <button onClick={() => setShowImageModal(null)} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors">✕</button>
          <img src={showImageModal} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
