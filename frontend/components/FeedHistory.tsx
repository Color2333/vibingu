'use client';

import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { 
  Moon, Utensils, Smartphone, Activity, Smile, Clock, 
  Image as ImageIcon, X, Users, Briefcase, BookOpen, 
  Gamepad2, Sparkles, TrendingUp, TrendingDown, Lightbulb, 
  BarChart3, Heart, Zap
} from 'lucide-react';
import type { FeedItem } from '@/components/pages/RecordPage';

interface FeedHistoryProps {
  items: FeedItem[];
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

// ======== 关键改动2: FeedCard 动画优化 ========
// 每个卡片自己管理动画状态 (hasAnimated)
// 只在首次挂载时触发一次动画
// 动画结束后移除 class，不会重复触发
const FeedCard = memo(function FeedCard({ item }: { item: FeedItem }) {
  const [showImage, setShowImage] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);
  
  const category = item.category || 'MOOD';
  const config = categoryConfig[category] || categoryConfig.MOOD;
  const isPending = item._pending;
  const meta = item.meta_data || {};

  // 动画效果：只在首次挂载时触发
  useEffect(() => {
    const el = cardRef.current;
    if (!el || hasAnimatedRef.current) return;
    
    // 标记已经执行过动画
    hasAnimatedRef.current = true;
    
    // 添加动画 class
    el.classList.add('animate-slide-in');
    
    // 动画结束后移除 class
    const handleEnd = () => {
      el.classList.remove('animate-slide-in');
    };
    
    el.addEventListener('animationend', handleEnd, { once: true });
    
    return () => {
      el.removeEventListener('animationend', handleEnd);
    };
  }, []); // 空依赖，只在挂载时执行一次

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 解析数据
  const analysis = meta.analysis as string | undefined;
  const suggestions = meta.suggestions as string[] | undefined;
  const trend = meta.trend as string | undefined;
  const healthScore = meta.health_score as number | undefined;
  const topApps = meta.top_apps as Array<{name: string; time: string; minutes: number}> | undefined;
  const totalScreenTime = meta.total_screen_time as string | undefined;
  const totalMinutes = meta.total_minutes as number | undefined;
  
  const sleepTime = meta.sleep_time as string | undefined;
  const wakeTime = meta.wake_time as string | undefined;
  const durationHours = meta.duration_hours as number | undefined;
  const sleepScore = meta.score as number | undefined;
  
  const foodItems = meta.food_items as Array<{name: string; calories?: number}> | undefined;
  const totalCalories = meta.total_calories as number | undefined;
  const isHealthy = meta.is_healthy as boolean | undefined;

  return (
    <div 
      ref={cardRef}
      className={`rounded-2xl overflow-hidden transition-colors ${
        isPending 
          ? 'bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20' 
          : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="p-4">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isPending ? 'bg-indigo-500/20' : config.bgColor
          }`}>
            {isPending ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className={config.color}>{config.icon}</span>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isPending ? 'text-indigo-400' : config.color}`}>
                {isPending ? '分析中...' : config.label}
              </span>
              {trend && !isPending && (
                <span className={`flex items-center text-xs ${
                  trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white/30'
                }`}>
                  {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                  {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                </span>
              )}
              {healthScore !== undefined && !isPending && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  healthScore >= 70 ? 'bg-green-500/10 text-green-400' : 
                  healthScore >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 
                  'bg-red-500/10 text-red-400'
                }`}>
                  {healthScore}分
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/30 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{formatTime(item.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Pending 显示原始输入 */}
        {isPending && item.raw_content && (
          <p className="text-sm text-white/70 mb-3">{item.raw_content}</p>
        )}
        
        {isPending && (
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-sm text-indigo-400/80">AI 正在分析...</span>
          </div>
        )}

        {/* AI 洞察 */}
        {!isPending && item.ai_insight && (
          <p className="text-[15px] text-white/80 leading-relaxed mb-3">{item.ai_insight}</p>
        )}

        {/* 屏幕时间 */}
        {!isPending && category === 'SCREEN' && (
          <div className="space-y-3">
            {(totalScreenTime || totalMinutes) && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <span className="text-sm text-white/50">总屏幕时间</span>
                <span className="text-lg font-semibold text-blue-400">
                  {totalScreenTime || `${Math.floor((totalMinutes || 0) / 60)}h${(totalMinutes || 0) % 60}m`}
                </span>
              </div>
            )}
            
            {topApps && topApps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>App 使用排行</span>
                </div>
                <div className="space-y-1.5">
                  {topApps.slice(0, 5).map((app, idx) => (
                    <div key={`${app.name}-${idx}`} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                        idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                        idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm text-white/70">{app.name}</span>
                      <span className="text-sm text-white/40">{app.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 睡眠数据 */}
        {!isPending && category === 'SLEEP' && (sleepTime || durationHours) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {sleepTime && (
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs text-white/40 mb-1">入睡</p>
                <p className="text-base font-medium text-indigo-300">{sleepTime}</p>
              </div>
            )}
            {wakeTime && (
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs text-white/40 mb-1">起床</p>
                <p className="text-base font-medium text-indigo-300">{wakeTime}</p>
              </div>
            )}
            {durationHours && (
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs text-white/40 mb-1">时长</p>
                <p className="text-base font-medium text-indigo-300">{durationHours.toFixed(1)}h</p>
              </div>
            )}
            {sleepScore && (
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs text-white/40 mb-1">质量</p>
                <p className={`text-base font-medium ${
                  sleepScore >= 80 ? 'text-green-400' : sleepScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>{sleepScore}分</p>
              </div>
            )}
          </div>
        )}

        {/* 食物数据 */}
        {!isPending && category === 'DIET' && (foodItems || totalCalories) && (
          <div className="space-y-2 mb-3">
            {foodItems && foodItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {foodItems.map((food, idx) => (
                  <span key={`${food.name}-${idx}`} className="px-2.5 py-1 text-xs rounded-lg bg-orange-500/10 text-orange-300 border border-orange-500/10">
                    {food.name}
                    {food.calories && <span className="ml-1 text-orange-400/60">{food.calories}卡</span>}
                  </span>
                ))}
              </div>
            )}
            {(totalCalories || isHealthy !== undefined) && (
              <div className="flex items-center gap-3 text-sm">
                {totalCalories && (
                  <span className="text-white/50">
                    <Zap className="w-3.5 h-3.5 inline mr-1 text-orange-400" />
                    约 {totalCalories} 卡
                  </span>
                )}
                {isHealthy !== undefined && (
                  <span className={isHealthy ? 'text-green-400' : 'text-orange-400'}>
                    <Heart className={`w-3.5 h-3.5 inline mr-1 ${isHealthy ? 'fill-green-400' : ''}`} />
                    {isHealthy ? '健康' : '需注意'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 临时图片 */}
        {isPending && item._tempImagePreview && (
          <div className="mt-3">
            <img src={item._tempImagePreview} alt="" className="h-24 w-auto rounded-xl opacity-60" />
          </div>
        )}

        {/* 保存的图片 */}
        {!isPending && item.image_saved && item.thumbnail_path && (
          <button onClick={() => setShowImage(true)} className="mt-3 relative group">
            <img src={item.thumbnail_path} alt="" className="h-24 w-auto rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {/* AI 分析 */}
        {!isPending && analysis && (
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-violet-500/5 to-indigo-500/5 border border-violet-500/10">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-white/60 leading-relaxed">{analysis}</p>
            </div>
          </div>
        )}

        {/* AI 建议 */}
        {!isPending && suggestions && suggestions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {suggestions.slice(0, 2).map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-amber-400/70 mt-0.5 flex-shrink-0" />
                <span className="text-white/50">{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* 标签 */}
        {!isPending && item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
            {item.tags.slice(0, 4).map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 text-[11px] rounded-full bg-white/[0.04] text-white/40">
                {tag}
              </span>
            ))}
          </div>
        )}
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
  // memo 比较：只有关键字段变化才重新渲染
  const p = prevProps.item;
  const n = nextProps.item;
  return p.id === n.id && 
         p._pending === n._pending && 
         p.ai_insight === n.ai_insight &&
         p.category === n.category;
});

// ========== 主组件 ==========
export default function FeedHistory({ items }: FeedHistoryProps) {
  const [filter, setFilter] = useState<string | null>(null);
  
  // 过滤
  const filtered = useMemo(() => {
    return filter ? items.filter(i => i.category === filter) : items;
  }, [items, filter]);
  
  // 分组
  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    filtered.forEach(item => {
      const key = new Date(item.created_at).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries());
  }, [filtered]);
  
  const categories = ['SLEEP', 'DIET', 'ACTIVITY', 'MOOD', 'SCREEN'];

  return (
    <div>
      {/* 过滤器 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-4 py-2 text-sm rounded-xl transition-all whitespace-nowrap ${
            filter === null ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
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
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                filter === cat ? `${cfg.bgColor} ${cfg.color}` : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
              <span className="text-xs opacity-50">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* 关键改动3: 移除"详情"按钮 - 所有数据直接展示 */}
      {grouped.length > 0 ? (
        grouped.map(([dateKey, dayItems]) => {
          const { title, subtitle } = formatDateHeader(dateKey);
          return (
            <div key={dateKey} className="mb-8">
              <div className="flex items-baseline gap-2 mb-3 px-1">
                <h3 className="text-lg font-semibold text-white/90">{title}</h3>
                <span className="text-xs text-white/30">{subtitle}</span>
                <span className="text-xs text-white/20 ml-auto">{dayItems.filter(i => !i._pending).length} 条</span>
              </div>
              <div className="space-y-3">
                {dayItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-16">
          <p className="text-white/30">暂无记录</p>
          <p className="text-white/20 text-sm mt-1">开始记录你的生活</p>
        </div>
      )}
    </div>
  );
}
