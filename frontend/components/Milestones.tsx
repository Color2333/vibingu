'use client';

import { useState, useEffect } from 'react';
import { Flame, Trophy, Calendar, Target, ChevronDown } from 'lucide-react';

interface MilestoneData {
  streak: { current: number; longest: number };
  records: { total: number; by_category: Record<string, number>; first_record_date: string | null };
  best_days: { highest_vibe: { date: string; score: number } | null; most_active: { date: string; count: number } | null };
  totals: { days_recorded: number; avg_records_per_day: number };
  achievements: { id: string; name: string; description: string; icon: string; unlocked: boolean }[];
}

export default function Milestones() {
  const [data, setData] = useState<MilestoneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/reports/milestones');
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error('Failed to fetch milestones:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6">
        <div className="h-20 skeleton rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const unlockedCount = data.achievements.filter(a => a.unlocked).length;

  return (
    <div className="glass rounded-3xl overflow-hidden">
      {/* Summary Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--glass-bg)] transition-colors"
      >
        <div className="flex items-center gap-6">
          {/* Streak */}
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-lg font-light text-[var(--text-primary)]">{data.streak.current}</span>
            <span className="text-xs text-[var(--text-tertiary)]">天连续</span>
          </div>
          
          {/* Total Days */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-lg font-light text-[var(--text-primary)]">{data.totals.days_recorded}</span>
            <span className="text-xs text-[var(--text-tertiary)]">天记录</span>
          </div>
          
          {/* Achievements */}
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-lg font-light text-[var(--text-primary)]">{unlockedCount}</span>
            <span className="text-xs text-[var(--text-tertiary)]">成就</span>
          </div>
        </div>
        
        <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="最长连续"
              value={`${data.streak.longest} 天`}
              icon={<Flame className="w-4 h-4 text-orange-400" />}
            />
            <StatCard
              label="总记录数"
              value={`${data.records.total} 条`}
              icon={<Target className="w-4 h-4 text-green-400" />}
            />
            <StatCard
              label="最高 Vibe"
              value={data.best_days.highest_vibe ? `${data.best_days.highest_vibe.score}` : '—'}
              icon={<Trophy className="w-4 h-4 text-amber-400" />}
            />
            <StatCard
              label="日均记录"
              value={`${data.totals.avg_records_per_day} 条`}
              icon={<Calendar className="w-4 h-4 text-blue-400" />}
            />
          </div>

          {/* Achievements */}
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3">成就</p>
            <div className="grid grid-cols-3 gap-2">
              {data.achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={`p-3 rounded-xl text-center transition-all ${
                    achievement.unlocked
                      ? 'glass-subtle'
                      : 'bg-[var(--glass-bg)] opacity-40'
                  }`}
                  title={achievement.description}
                >
                  <span className="text-2xl">{achievement.icon}</span>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">{achievement.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-subtle rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-light text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
