'use client';

import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Image as ImageIcon, X, Users, Briefcase, BookOpen, 
  Gamepad2, Sparkles, Lightbulb, ChevronRight, MessageCircle,
  MoreVertical, Trash2, Globe, Lock, Calendar, XCircle,
  Brain, Tag, Check, RefreshCw, Loader2, Bookmark, Pencil
} from 'lucide-react';
import type { FeedItem } from '@/components/pages/RecordPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface FeedHistoryProps {
  items: FeedItem[];
  onDelete?: (id: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onToggleBookmark?: (id: string, isBookmarked: boolean) => void;
  onDismissFailed?: (id: string) => void;
  onRetryFailed?: (id: string) => void;
  onRegenerate?: (id: string, phases: string[]) => void;
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

/** 将日期时间字符串转为本地日期 key（YYYY-MM-DD），避免 UTC 偏移 */
function toLocalDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string): { title: string; subtitle: string } {
  // dateStr 是 "YYYY-MM-DD" 格式，用 split 解析避免 UTC 偏移
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // 本地时间构造
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.getTime() === today.getTime();
  const isYesterday = date.getTime() === yesterday.getTime();
  
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
  onToggleBookmark?: (id: string, isBookmarked: boolean) => void;
  onDismissFailed?: (id: string) => void;
  onRetryFailed?: (id: string) => void;
  onRegenerate?: (id: string, phases: string[]) => void;
  showManagement?: boolean;
}

const TimelineCard = memo(function TimelineCard({ 
  item, 
  isLast, 
  onDelete, 
  onTogglePublic,
  onToggleBookmark,
  onDismissFailed,
  onRetryFailed,
  onRegenerate,
  showManagement = false 
}: TimelineCardProps) {
  const [showImage, setShowImage] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLockedRef = useRef<'h' | 'v' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);
  const router = useRouter();

  // Swipe handlers for mobile
  const handleSwipeStart = (e: React.TouchEvent) => {
    if (item._pending || item._failed) return;
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipeLockedRef.current = null;
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;

    // Lock direction after 10px of movement
    if (!swipeLockedRef.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeLockedRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      return;
    }
    if (swipeLockedRef.current === 'v') return;

    // Only allow left swipe (negative dx)
    if (dx < 0) {
      setSwipeX(Math.max(dx, -120));
    } else if (swipeX < 0) {
      // Allow swiping back right
      setSwipeX(Math.min(0, dx + swipeX));
    }
  };

  const handleSwipeEnd = () => {
    swipeStartRef.current = null;
    swipeLockedRef.current = null;
    // Snap to open or closed
    if (swipeX < -60) {
      setSwipeX(-100); // Show action buttons
    } else {
      setSwipeX(0);
    }
  };

  // Close swipe when menu/image opens
  useEffect(() => {
    if (showMenu || showImage || showDeleteConfirm) setSwipeX(0);
  }, [showMenu, showImage, showDeleteConfirm]);
  
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
  const isFailed = item._failed;
  const isRegenerating = !!(item._regenerating && item._regenerating.length > 0);
  const meta = item.meta_data || {};

  // ===== 分析阶段（后端 SSE 事件映射为 3 个用户可见步骤） =====
  // 后端 6 阶段 → 前端 3 步：分析 / 标签 / 保存
  const displaySteps: { key: string; icon: React.ReactNode; label: string; serverPhases: string[] }[] = [
    { key: 'analyze', icon: <Brain className="w-3.5 h-3.5" />, label: 'AI 分析', serverPhases: ['classify', 'extract'] },
    { key: 'tags',    icon: <Tag className="w-3.5 h-3.5" />,   label: '生成标签', serverPhases: ['tags'] },
    { key: 'save',    icon: <Check className="w-3.5 h-3.5" />, label: '保存',     serverPhases: ['save_image', 'score', 'save'] },
  ];

  const serverPhase = item._serverPhase;
  const completedPhases = item._completedPhases || [];
  const hasServerPhases = isPending && (!!serverPhase || completedPhases.length > 0);

  // 计算每个 displayStep 的状态
  const stepStatus = displaySteps.map(step => {
    const allDone = step.serverPhases.every(p => completedPhases.includes(p));
    const anyActive = step.serverPhases.includes(serverPhase || '');
    return { ...step, done: allDone, active: anyActive && !allDone };
  });
  const doneCount = stepStatus.filter(s => s.done).length;
  const progressPercent = hasServerPhases ? (doneCount / displaySteps.length) * 100 : 0;
  // 当前显示阶段
  const currentStep = stepStatus.find(s => s.active) || stepStatus.find(s => !s.done);

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

  // 副分类
  const subCategories = (meta.sub_categories as string[] | undefined)?.filter(
    sc => sc !== category && categoryConfig[sc]
  ) || [];

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
          isFailed ? 'bg-red-500/20' : isPending ? 'bg-indigo-500/20' : config.bgColor
        } border-2 ${isFailed ? 'border-red-500/40' : isPending ? 'border-indigo-500/40' : 'border-[var(--border)]'}`}>
          {isFailed ? (
            <X className="w-4 h-4 text-red-400" />
          ) : isPending ? (
            <span className="text-indigo-400 animate-pulse">
              {hasServerPhases
                ? (currentStep?.icon || <Sparkles className="w-4 h-4" />)
                : <Loader2 className="w-4 h-4 animate-spin" />
              }
            </span>
          ) : (
            <span className={config.color}>{config.icon}</span>
          )}
        </div>
        {/* 连接线 */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[20px] bg-gradient-to-b from-[var(--border)] to-transparent" />
        )}
      </div>
      
      {/* 右侧内容：可滑动容器 */}
      <div className="flex-1 pb-4 relative overflow-hidden swipeable-card">
        {/* 滑动后露出的操作按钮 */}
        {swipeX < -10 && (
          <div className="absolute right-0 top-0 bottom-4 flex items-stretch z-10" style={{ width: 100 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark?.(item.id, !item.is_bookmarked);
                setSwipeX(0);
              }}
              className="flex-1 flex items-center justify-center bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors rounded-l-xl"
            >
              <Bookmark className={`w-5 h-5 ${item.is_bookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSwipeX(0);
                setShowDeleteConfirm(true);
              }}
              className="flex-1 flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors rounded-r-xl"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}

      <div 
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined }}
        className={`rounded-2xl overflow-hidden transition-transform duration-200 ${
        isFailed
          ? 'bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-500/20 opacity-80'
          : isPending 
            ? 'bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20' 
            : isRegenerating
              ? 'glass-card border border-amber-500/30 animate-pulse-subtle'
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
              <span className={`text-xs font-medium ${isFailed ? 'text-red-400' : isPending ? 'text-indigo-400' : config.color}`}>
                {isFailed ? '发送失败' : isPending ? (
                  hasServerPhases
                    ? `${currentStep?.label || '处理中'}...`
                    : '连接服务器...'
                ) : config.label}
              </span>
              {/* 副分类标签 */}
              {!isPending && subCategories.length > 0 && subCategories.map(sc => {
                const scCfg = categoryConfig[sc];
                return (
                  <span key={sc} className={`text-[10px] px-1.5 py-0.5 rounded ${scCfg.bgColor} ${scCfg.color} opacity-70`}>
                    {scCfg.label}
                  </span>
                );
              })}
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
              {/* 收藏按钮 */}
              {!isPending && !isFailed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark?.(item.id, !item.is_bookmarked);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    item.is_bookmarked 
                      ? 'text-amber-400 hover:text-amber-300' 
                      : 'text-[var(--text-tertiary)] hover:text-amber-400 hover:bg-[var(--glass-bg)]'
                  }`}
                  aria-label={item.is_bookmarked ? '取消收藏' : '收藏'}
                  title={item.is_bookmarked ? '取消收藏' : '收藏'}
                >
                  <Bookmark className={`w-4 h-4 ${item.is_bookmarked ? 'fill-current' : ''}`} />
                </button>
              )}
              {/* 管理菜单 */}
              {showManagement && !isPending && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
                    aria-label="更多操作"
                    title="更多操作"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[140px] backdrop-blur-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          router.push(`/record/${item.id}?edit=1`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        编辑
                      </button>
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
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
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
            {(() => {
              const content = item.raw_content;
              if (content && !content.startsWith('/') && !content.includes('/Users/')) {
                return (
                  <p className="text-[15px] text-[var(--text-primary)] leading-relaxed mb-2">
                    {content.length > 150 ? content.slice(0, 150) + '...' : content}
                  </p>
                );
              }
              return null;
            })()}
            {/* 如果没有原始内容但有分析，显示摘要 */}
            {(() => {
              const content = item.raw_content;
              if ((!content || content.includes('/Users/')) && analysis) {
                return (
                  <p className="text-[15px] text-[var(--text-primary)] leading-relaxed mb-2">
                    {analysis.slice(0, 120)}...
                  </p>
                );
              }
              return null;
            })()}
            
            {/* Pending 状态 — 3 步进度 */}
            {isPending && (
              <div className="space-y-2">
                {/* 步骤条：3 步横排 */}
                <div className="flex items-center gap-1.5">
                  {stepStatus.map((step, idx) => (
                    <div key={step.key} className="flex items-center gap-1.5 flex-1">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-500 whitespace-nowrap ${
                        step.done
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : step.active
                            ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30'
                            : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)]'
                      }`}>
                        {step.done ? (
                          <Check className="w-3 h-3" />
                        ) : step.active ? (
                          <span className="animate-pulse">{step.icon}</span>
                        ) : (
                          <span className="opacity-40">{step.icon}</span>
                        )}
                        {step.label}
                      </div>
                      {idx < stepStatus.length - 1 && (
                        <div className={`w-3 h-0.5 rounded-full flex-shrink-0 transition-colors duration-500 ${
                          step.done ? 'bg-indigo-400/40' : 'bg-[var(--glass-bg)]'
                        }`} />
                      )}
                    </div>
                  ))}
                  {!hasServerPhases && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[var(--text-tertiary)] bg-[var(--glass-bg)]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      连接中
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 失败状态 — 保留记录，提供重试和取消 */}
            {isFailed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-red-400/80">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{item._errorMsg || '发送失败'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryFailed?.(item.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新发送
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissFailed?.(item.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    取消
                  </button>
                </div>
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

          {/* 临时图片（pending 和 failed 状态都显示） */}
          {(isPending || isFailed) && item._tempImagePreview && (
            <div className="mt-2">
              <img src={item._tempImagePreview} alt="上传预览" loading="lazy" className={`h-20 w-auto rounded-lg ${isFailed ? 'opacity-40' : 'opacity-60'}`} />
            </div>
          )}

          {/* 保存的图片 */}
          {!isPending && item.image_saved && item.thumbnail_path && (
            <button onClick={(e) => { e.stopPropagation(); setShowImage(true); }} className="mt-2 relative group">
              <img src={item.thumbnail_path} alt="记录图片" loading="lazy" className="h-20 w-auto rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
            </button>
          )}

          {/* 部分失败提示 / 重新生成动画 */}
          {!isPending && !isFailed && item.failed_phases && item.failed_phases.length > 0 && (
            <div className={`mt-2 p-2.5 rounded-lg transition-all duration-300 ${
              isRegenerating 
                ? 'bg-indigo-500/5 border border-indigo-500/20' 
                : 'bg-amber-500/5 border border-amber-500/15'
            }`}>
              {isRegenerating ? (
                /* 重新生成中 — 显示分阶段进度动画 */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
                    <span className="text-xs font-medium text-indigo-400">正在重新生成...</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(item._regenerating || []).map(phase => {
                      const phaseLabels: Record<string, { label: string; icon: React.ReactNode }> = {
                        tags: { label: '标签', icon: <Tag className="w-3 h-3" /> },
                        dimension_scores: { label: '评分', icon: <Sparkles className="w-3 h-3" /> },
                        ai_insight: { label: 'AI洞察', icon: <Brain className="w-3 h-3" /> },
                      };
                      const info = phaseLabels[phase] || { label: phase, icon: <Sparkles className="w-3 h-3" /> };
                      return (
                        <span key={phase} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-indigo-500/10 text-indigo-400 animate-pulse">
                          {info.icon}
                          {info.label}
                        </span>
                      );
                    })}
                  </div>
                  {/* 进度条动画 */}
                  <div className="h-1 rounded-full bg-indigo-500/10 overflow-hidden">
                    <div className="h-full bg-indigo-400/60 rounded-full animate-progress-indeterminate" />
                  </div>
                </div>
              ) : (
                /* 失败状态 — 显示失败项和重试按钮 */
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-400/80 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {item.failed_phases.map(p => 
                        ({ tags: '标签', dimension_scores: '评分', ai_insight: 'AI洞察', image_save: '图片', rag_index: '索引' }[p] || p)
                      ).join('、')}未生成
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerate?.(item.id, item.failed_phases!);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              )}
            </div>
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
      </div>

      {/* 图片模态框 */}
      {showImage && item.image_path && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowImage(false)}>
          <button onClick={() => setShowImage(false)} aria-label="关闭图片" className="absolute top-4 right-4 p-2 text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={item.image_path} alt="记录图片详情" loading="lazy" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">删除后无法恢复，确定要删除这条记录吗？</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onDelete?.(item.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  const p = prevProps.item;
  const n = nextProps.item;
  return p.id === n.id && p._pending === n._pending && p._failed === n._failed 
    && p.ai_insight === n.ai_insight && p.is_public === n.is_public
    && p.is_bookmarked === n.is_bookmarked
    && p.failed_phases?.length === n.failed_phases?.length
    && p._regenerating?.length === n._regenerating?.length
    && p.tags?.length === n.tags?.length
    && p._serverPhase === n._serverPhase
    && p._completedPhases?.length === n._completedPhases?.length;
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
  onToggleBookmark,
  onDismissFailed,
  onRetryFailed,
  onRegenerate,
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
      const key = toLocalDateKey(timeToUse);
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
                  <ErrorBoundary key={item.id}>
                    <TimelineCard 
                      item={item} 
                      isLast={idx === dayItems.length - 1}
                      onDelete={onDelete}
                      onTogglePublic={onTogglePublic}
                      onToggleBookmark={onToggleBookmark}
                      onDismissFailed={onDismissFailed}
                      onRetryFailed={onRetryFailed}
                      onRegenerate={onRegenerate}
                      showManagement={showManagement}
                    />
                  </ErrorBoundary>
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
