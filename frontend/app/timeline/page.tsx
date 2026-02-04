'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Moon, Utensils, Smartphone, Activity, Smile, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/components/LoginScreen';

interface DayData {
  date: string;
  vibe_score: number | null;
  records: {
    id: string;
    category: string;
    ai_insight: string | null;
    created_at: string;
  }[];
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  SLEEP: { icon: <Moon className="w-3 h-3" />, color: 'text-indigo-400' },
  DIET: { icon: <Utensils className="w-3 h-3" />, color: 'text-orange-400' },
  SCREEN: { icon: <Smartphone className="w-3 h-3" />, color: 'text-blue-400' },
  ACTIVITY: { icon: <Activity className="w-3 h-3" />, color: 'text-green-400' },
  MOOD: { icon: <Smile className="w-3 h-3" />, color: 'text-pink-400' },
};

export default function TimelinePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchMonthData();
  }, [currentMonth, isAuthenticated]);

  const fetchMonthData = async () => {
    setIsLoading(true);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    try {
      // 获取这个月的所有记录
      const res = await fetch(`/api/feed/history?limit=500`);
      if (res.ok) {
        const records = await res.json();
        
        // 按日期分组
        const dayMap: Record<string, DayData> = {};
        
        for (const record of records) {
          const dateStr = record.created_at.split('T')[0];
          const recordDate = new Date(dateStr);
          
          if (recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month) {
            if (!dayMap[dateStr]) {
              dayMap[dateStr] = { date: dateStr, vibe_score: null, records: [] };
            }
            dayMap[dateStr].records.push(record);
          }
        }
        
        // 获取每天的 vibe 分数
        for (const dateStr of Object.keys(dayMap)) {
          try {
            const vibeRes = await fetch(`/api/analytics/vibe/${dateStr}`);
            if (vibeRes.ok) {
              const vibeData = await vibeRes.json();
              dayMap[dateStr].vibe_score = vibeData.vibe_score;
            }
          } catch {}
        }
        
        setDays(Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date)));
      }
    } catch (e) {
      console.error('Failed to fetch timeline:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    if (next <= new Date()) {
      setCurrentMonth(next);
    }
  };

  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-white/30';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-white/30 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="p-2 text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 text-white/40 hover:text-white/70 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-light text-white/80">
              {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
            </h1>
            <button 
              onClick={nextMonth} 
              className="p-2 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
              disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="w-9" />
        </header>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
          </div>
        ) : days.length > 0 ? (
          <div className="space-y-4">
            {days.map((day, index) => (
              <div 
                key={day.date} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <DayCard day={day} getScoreClass={getScoreClass} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/40">这个月还没有记录</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({ day, getScoreClass }: { day: DayData; getScoreClass: (score: number | null) => string }) {
  const date = new Date(day.date);
  const isToday = day.date === new Date().toISOString().split('T')[0];

  return (
    <div className={`glass rounded-2xl p-4 ${isToday ? 'glow-border' : ''}`}>
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-2xl font-light text-white/80">{date.getDate()}</p>
            <p className="text-[10px] text-white/40 uppercase">
              {date.toLocaleDateString('zh-CN', { weekday: 'short' })}
            </p>
          </div>
          {isToday && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6366f1]/20 text-[#6366f1]">
              今天
            </span>
          )}
        </div>
        <div className="text-right">
          <p className={`text-2xl font-light number-display ${getScoreClass(day.vibe_score)}`}>
            {day.vibe_score ?? '—'}
          </p>
          <p className="text-[10px] text-white/30">{day.records.length} 条记录</p>
        </div>
      </div>

      {/* Records */}
      <div className="space-y-2">
        {day.records.slice(0, 5).map(record => {
          const config = categoryConfig[record.category] || categoryConfig.MOOD;
          return (
            <div key={record.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 ${config.color}`}>{config.icon}</span>
              <p className="text-white/60 flex-1 line-clamp-1">
                {record.ai_insight || '—'}
              </p>
              <span className="text-[10px] text-white/30">
                {new Date(record.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        {day.records.length > 5 && (
          <p className="text-xs text-white/30 text-center">+{day.records.length - 5} 更多</p>
        )}
      </div>
    </div>
  );
}
