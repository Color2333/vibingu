'use client';

import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Image as ImageIcon, X, Users, Briefcase, BookOpen, 
  Gamepad2, Sparkles, Lightbulb, ChevronRight, MessageCircle,
  MoreVertical, Trash2, Globe, Lock, Calendar
} from 'lucide-react';
import type { FeedItem } from '@/components/pages/RecordPage';

interface FeedHistoryProps {
  items: FeedItem[];
  onDelete?: (id: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  showManagement?: boolean;
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

function formatDateHeader(dateStr: string): { title: string; subtitle: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  
  if (isToday) return { title: '今天', subtitle: `${monthDay} ${weekday}` };
  if (isYesterday) return { title: '昨天', subtitle: `${monthDay} ${weekday}` };
  return { title: monthDay, subtitle: weekday };
}

// ========== 时间轴卡片组件 ==========
interface TimelineCardProps {
  item: FeedItem;
  isLast: boolean;
  onDelete?: (id: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  showManagement?: boolean;
}

const TimelineCard = memo(function TimelineCard({ 
  item, 
  isLast, 
  onDelete, 
  onTogglePublic,
  showManagement = false 
}: TimelineCardProps) {
  const [showImage, setShowImage] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);
  const router = useRouter();
  
  // 点击外部关闭菜单
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
  
  const category = item.category || 'MOOD';
  const config = categoryConfig[category] || categoryConfig.MOOD;
  const isPending = item._pending;
  const meta = item.meta_data || {};

  // 动画效果
  useEffect(() => {
    const el = cardRef.current;
    if (!el || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;
    el.classList.add('animate-slide-in');
    const handleEnd = () => el.classList.remove('animate-slide-in');
    el.addEventListener('animationend', handleEnd, { once: true });
    return () => el.removeEventListener('animationend', handleEnd);
  }, []);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 解析数据
  const analysis = meta.analysis as string | undefined;
  const suggestions = meta.suggestions as string[] | undefined;
  const healthScore = meta.health_score as number | undefined;
  const sleepScore = meta.score as number | undefined;
  const durationHours = meta.duration_hours as number | undefined;
  const totalScreenTime = meta.total_screen_time as string | undefined;
  const totalMinutes = meta.total_minutes as number | undefined;
  // 睡眠时间
  const sleepTime = meta.sleep_time as string | undefined;
  const wakeTime = meta.wake_time as string | undefined;
  const deepSleepHours = meta.deep_sleep_hours as number | undefined;
  const remHours = meta.rem_hours as number | undefined;

  // 导航到详情页
  const goToDetail = () => {
    if (!isPending) {
      router.push(`/record/${item.id}`);
    }
  };

  return (
    <div ref={cardRef} className="flex gap-4">
      {/* 左侧时间轴 */}
      <div className="flex flex-col items-center">
        {/* 时间轴节点 */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPending ? 'bg-indigo-500/20' : config.bgColor
        } border-2 ${isPending ? 'border-indigo-500/40' : 'border-[var(--border)]'}`}>
          {isPending ? (
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className={config.color}>{config.icon}</span>
          )}
        </div>
        {/* 连接线 */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[20px] bg-gradient-to-b from-[var(--border)] to-transparent" />
        )}
      </div>
      
      {/* 右侧内容 */}
      <div className={`flex-1 pb-4 rounded-2xl overflow-hidden transition-colors ${
        isPending 
          ? 'bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20' 
          : 'glass-card hover:bg-[var(--glass-bg)] cursor-pointer'
      }`}>
        <div className="p-4">
          {/* 头部：时间 + 分类 + 分数 + 操作 */}
          <div className="flex items-center gap-2 mb-2">
            {/* 左侧信息 */}
            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(item.record_time || item.created_at)}
              </span>
              <span className={`text-xs font-medium ${isPending ? 'text-indigo-400' : config.color}`}>
                {isPending ? '分析中...' : config.label}
              </span>
              {/* 公开标签 */}
              {!isPending && item.is_public && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  公开
                </span>
              )}
              {/* 分数标签 */}
              {!isPending && (healthScore !== undefined || sleepScore !== undefined) && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  (healthScore || sleepScore || 0) >= 70 ? 'bg-green-500/10 text-green-400' : 
                  (healthScore || sleepScore || 0) >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 
                  'bg-red-500/10 text-red-400'
                }`}>
                  {healthScore || sleepScore}分
                </span>
              )}
              {/* 睡眠时长 */}
              {!isPending && category === 'SLEEP' && durationHours && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                  {durationHours.toFixed(1)}h
                </span>
              )}
              {/* 屏幕时间 */}
              {!isPending && category === 'SCREEN' && (totalScreenTime || totalMinutes) && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
                  {totalScreenTime || `${Math.floor((totalMinutes || 0) / 60)}h${(totalMinutes || 0) % 60}m`}
                </span>
              )}
            </div>
            
            {/* 右侧操作按钮 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 管理菜单 */}
              {showManagement && !isPending && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
                    title="更多操作"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[140px] backdrop-blur-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePublic?.(item.id, !item.is_public);
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] flex items-center gap-2"
                      >
                        {item.is_public ? (
                          <>
                            <Lock className="w-4 h-4" />
                            设为私密
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4" />
                            设为公开
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('确定要删除这条记录吗？')) {
                            onDelete?.(item.id);
                          }
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[var(--glass-bg)] flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* 查看详情箭头 */}
              {!isPending && (
                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
              )}
            </div>
          </div>

          {/* 睡眠详细信息 */}
          {!isPending && category === 'SLEEP' && (sleepTime || wakeTime || deepSleepHours) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-[var(--text-secondary)]">
              {sleepTime && (
                <span className="flex items-center gap-1">
                  <Moon className="w-3 h-3 text-indigo-400" />
                  入睡 {sleepTime}
                </span>
              )}
              {wakeTime && (
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">☀️</span>
                  苏醒 {wakeTime}
                </span>
              )}
              {deepSleepHours && (
                <span>深睡 {deepSleepHours.toFixed(1)}h</span>
              )}
              {remHours && (
                <span>REM {remHours.toFixed(1)}h</span>
              )}
            </div>
          )}

          {/* 可点击区域 */}
          <div onClick={goToDetail}>
            {/* 原始内容 - 显示更多内容 */}
            {item.raw_content && !item.raw_content.startsWith('/') && !item.raw_content.includes('/Users/') && (
              <p className="text-[15px] text-[var(--text-primary)] leading-relaxed mb-2">
                {item.raw_content.length > 150 ? item.raw_content.slice(0, 150) + '...' : item.raw_content}
              </p>
            )}
            {/* 如果没有原始内容但有分析，显示摘要 */}
            {(!item.raw_content || item.raw_content.includes('/Users/')) && meta.analysis && (
              <p className="text-[15px] text-[var(--text-primary)] leading-relaxed mb-2">
                {(meta.analysis as string).slice(0, 120)}...
              </p>
            )}
            
            {/* Pending 状态 */}
            {isPending && (
              <div className="flex items-center gap-2 text-sm text-indigo-400/80">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>AI 正在分析...</span>
              </div>
            )}

            {/* AI 洞察 - 完整显示 */}
            {!isPending && item.ai_insight && item.ai_insight !== '已记录' && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.ai_insight}</p>
              </div>
            )}

            {/* AI 深度分析 - 显示摘要，点击查看完整 */}
            {!isPending && analysis && (
              <div className="mt-2 p-2.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--border)]">
                <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mb-1">
                  <Lightbulb className="w-3 h-3" />
                  <span>AI 分析</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  {analysis.length > 200 ? analysis.slice(0, 200) + '...' : analysis}
                </p>
                {suggestions && suggestions.length > 0 && (
                  <p className="text-xs text-amber-400/60 mt-1.5">
                    💡 {suggestions[0].slice(0, 50)}{suggestions[0].length > 50 ? '...' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 临时图片 */}
          {isPending && item._tempImagePreview && (
            <div className="mt-2">
              <img src={item._tempImagePreview} alt="" className="h-20 w-auto rounded-lg opacity-60" />
            </div>
          )}

          {/* 保存的图片 */}
          {!isPending && item.image_saved && item.thumbnail_path && (
            <button onClick={(e) => { e.stopPropagation(); setShowImage(true); }} className="mt-2 relative group">
              <img src={item.thumbnail_path} alt="" className="h-20 w-auto rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
            </button>
          )}

          {/* 底部操作栏 */}
          {!isPending && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
              {/* 标签 */}
              <div className="flex flex-wrap gap-1 flex-1">
                {item.tags && item.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
                    {tag}
                  </span>
                ))}
              </div>
              {/* 查看详情 & 对话按钮 */}
              <button
                onClick={goToDetail}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-400/70 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                <span>详情 & 对话</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 图片模态框 */}
      {showImage && item.image_path && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowImage(false)}>
          <button onClick={() => setShowImage(false)} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={item.image_path} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  const p = prevProps.item;
  const n = nextProps.item;
  return p.id === n.id && p._pending === n._pending && p.ai_insight === n.ai_insight && p.is_public === n.is_public;
});

// ========== 主组件 ==========
type TimeFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';

const timeFilterOptions: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

function getTimeFilterRange(filter: TimeFilter): { start: Date; end: Date } | null {
  if (filter === 'all') return null;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 本周日开始
      return { start: weekStart, end: now };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: now };
    }
    default:
      return null;
  }
}

export default function FeedHistory({ 
  items, 
  onDelete, 
  onTogglePublic,
  showManagement = false 
}: FeedHistoryProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  const categories = ['SLEEP', 'DIET', 'ACTIVITY', 'MOOD', 'SCREEN'];

  // 点击外部关闭日期选择器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  // 应用自定义日期范围
  const applyDateRange = () => {
    if (dateRange.start && dateRange.end) {
      setTimeFilter('all'); // 清除预设时间筛选
      setShowDatePicker(false);
    }
  };

  // 清除日期范围
  const clearDateRange = () => {
    setDateRange({ start: '', end: '' });
    setTimeFilter('all');
  };

  // 格式化日期显示
  const formatDateDisplay = () => {
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
    }
    return timeFilterOptions.find(o => o.value === timeFilter)?.label || '全部时间';
  };
  
  // 按分类和时间过滤
  const filtered = useMemo(() => {
    let result = items;
    
    // 分类过滤
    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }
    
    // 时间过滤（预设 + 自定义日期范围）
    let range: { start: Date; end: Date } | null = null;
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      range = { start, end };
    } else {
      range = getTimeFilterRange(timeFilter);
    }
    
    if (range) {
      result = result.filter(item => {
        const itemTime = new Date(item.record_time || item.created_at);
        return itemTime >= range!.start && itemTime <= range!.end;
      });
    }
    
    return result;
  }, [items, categoryFilter, timeFilter, dateRange]);
  
  // 分组并按实际发生时间排序
  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    filtered.forEach(item => {
      const timeToUse = item.record_time || item.created_at;
      const key = new Date(timeToUse).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    
    // 每组内按实际发生时间降序排序
    map.forEach((items, key) => {
      items.sort((a, b) => {
        const timeA = new Date(a.record_time || a.created_at).getTime();
        const timeB = new Date(b.record_time || b.created_at).getTime();
        return timeB - timeA;
      });
      map.set(key, items);
    });
    
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div>
      {/* 筛选器 */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {/* 分类筛选 */}
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 text-sm rounded-xl transition-all whitespace-nowrap ${
            categoryFilter === null ? 'bg-[var(--glass-bg)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
          }`}
        >
          全部
        </button>
        {categories.map(cat => {
          const cfg = categoryConfig[cat];
          const cnt = items.filter(i => i.category === cat).length;
          if (cnt === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoryFilter === cat ? `${cfg.bgColor} ${cfg.color}` : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
              }`}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
              <span className="text-xs opacity-50">{cnt}</span>
            </button>
          );
        })}

        {/* 分隔线 */}
        <div className="w-px h-6 bg-[var(--border)] mx-1 flex-shrink-0" />

        {/* 时间筛选下拉 */}
        <div className="relative" ref={datePickerRef}>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-3 py-1.5 text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              (timeFilter !== 'all' || (dateRange.start && dateRange.end))
                ? 'bg-[var(--accent)] text-white' 
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{formatDateDisplay()}</span>
          </button>

          {/* 日期选择面板 */}
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-50 min-w-[280px]">
              {/* 快捷选项 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {timeFilterOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTimeFilter(opt.value);
                      setDateRange({ start: '', end: '' });
                      if (opt.value !== 'all') setShowDatePicker(false);
                    }}
                    className={`px-2 py-1.5 text-xs rounded-lg transition-all ${
                      timeFilter === opt.value && !dateRange.start
                        ? 'bg-[var(--accent)] text-white' 
                        : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 分隔线 */}
              <div className="h-px bg-[var(--border)] my-3" />

              {/* 自定义日期范围 */}
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-tertiary)]">自定义日期范围</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[var(--text-tertiary)]">-</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearDateRange}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    清除
                  </button>
                  <button
                    onClick={applyDateRange}
                    disabled={!dateRange.start || !dateRange.end}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    应用
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 时间轴列表 */}
      {grouped.length > 0 ? (
        grouped.map(([dateKey, dayItems]) => {
          const { title, subtitle } = formatDateHeader(dateKey);
          return (
            <div key={dateKey} className="mb-8">
              <div className="flex items-baseline gap-2 mb-4 px-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
                <span className="text-xs text-[var(--text-tertiary)]">{subtitle}</span>
                <span className="text-xs text-[var(--text-tertiary)] opacity-60 ml-auto">{dayItems.filter(i => !i._pending).length} 条</span>
              </div>
              <div className="pl-1 space-y-4">
                {dayItems.map((item, idx) => (
                  <TimelineCard 
                    key={item.id} 
                    item={item} 
                    isLast={idx === dayItems.length - 1}
                    onDelete={onDelete}
                    onTogglePublic={onTogglePublic}
                    showManagement={showManagement}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--text-tertiary)]">暂无记录</p>
          <p className="text-[var(--text-tertiary)] opacity-60 text-sm mt-1">开始记录你的生活</p>
        </div>
      )}
    </div>
  );
}
