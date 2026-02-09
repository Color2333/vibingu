'use client';

import { useState, useEffect, useCallback } from 'react';
import { SmilePlus, RefreshCw } from 'lucide-react';

interface MoodItem {
  mood: string;
  count: number;
  percentage: number;
}

const MOOD_CONFIG: Record<string, { label: string; emoji: string; color: string; barColor: string }> = {
  happy:    { label: '开心',  emoji: '😊', color: 'text-emerald-400', barColor: 'bg-emerald-400' },
  excited:  { label: '兴奋',  emoji: '🤩', color: 'text-amber-400',   barColor: 'bg-amber-400' },
  calm:     { label: '平静',  emoji: '😌', color: 'text-blue-400',    barColor: 'bg-blue-400' },
  neutral:  { label: '平常',  emoji: '😐', color: 'text-gray-400',    barColor: 'bg-gray-400' },
  tired:    { label: '疲惫',  emoji: '😩', color: 'text-orange-400',  barColor: 'bg-orange-400' },
  sad:      { label: '低落',  emoji: '😢', color: 'text-indigo-400',  barColor: 'bg-indigo-400' },
  anxious:  { label: '焦虑',  emoji: '😰', color: 'text-rose-400',    barColor: 'bg-rose-400' },
  stressed: { label: '压力',  emoji: '😤', color: 'text-red-400',     barColor: 'bg-red-400' },
  grateful: { label: '感恩',  emoji: '🙏', color: 'text-purple-400',  barColor: 'bg-purple-400' },
  motivated:{ label: '上进',  emoji: '💪', color: 'text-cyan-400',    barColor: 'bg-cyan-400' },
};

export default function MoodDistribution({ days = 30 }: { days?: number }) {
  const [moods, setMoods] = useState<MoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(days);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time/mood-distribution?days=${period}`);
      if (res.ok) {
        const data = await res.json();
        // API may return { moods: [...] } or array directly
        const items: MoodItem[] = Array.isArray(data) ? data : (data.moods || data.distribution || []);
        setMoods(items.sort((a, b) => b.count - a.count));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCount = moods.length > 0 ? moods[0].count : 1;

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-[var(--glass-bg)] rounded w-1/3 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-7 bg-[var(--glass-bg)] rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
            <SmilePlus className="w-4 h-4 text-pink-400" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">情绪分布</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex text-xs bg-[var(--glass-bg)] rounded-lg overflow-hidden">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-2.5 py-1 transition-colors ${
                  period === d
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {moods.length === 0 ? (
        <div className="text-center py-6 text-sm text-[var(--text-tertiary)]">
          暂无情绪数据
        </div>
      ) : (
        <div className="space-y-2">
          {moods.slice(0, 8).map(item => {
            const cfg = MOOD_CONFIG[item.mood] || {
              label: item.mood,
              emoji: '🫥',
              color: 'text-gray-400',
              barColor: 'bg-gray-400',
            };
            const barWidth = (item.count / maxCount) * 100;
            return (
              <div key={item.mood} className="flex items-center gap-2">
                <span className="text-base w-6 text-center flex-shrink-0">{cfg.emoji}</span>
                <span className="text-xs w-8 flex-shrink-0 text-[var(--text-secondary)]">{cfg.label}</span>
                <div className="flex-1 h-5 bg-[var(--glass-bg)] rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md ${cfg.barColor} transition-all duration-700`}
                    style={{ width: `${barWidth}%`, opacity: 0.7 }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-secondary)]">
                    {item.count}次 ({Math.round(item.percentage)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
