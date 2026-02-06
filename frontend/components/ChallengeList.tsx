'use client';

import { useEffect, useState } from 'react';
import { Target, CheckCircle, Clock, Zap } from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  target_count: number;
  current_progress: number;
  progress_percent: number;
  is_completed: boolean;
  xp_reward: number;
  end_date: string;
  days_left: number;
}

interface Props {
  className?: string;
}

export default function ChallengeList({ className = '' }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/gamification/challenges');
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[var(--glass-bg)] rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completedCount = challenges.filter((c) => c.is_completed).length;

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">本周挑战</h3>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          {completedCount} / {challenges.length} 完成
        </span>
      </div>

      {/* Challenge list */}
      {challenges.length === 0 ? (
        <p className="text-center text-[var(--text-tertiary)] py-8">暂无挑战</p>
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              className={`p-4 rounded-xl border transition-all ${
                challenge.is_completed
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-[var(--border)] bg-[var(--glass-bg)]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {challenge.is_completed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--text-tertiary)]" />
                  )}
                  <span
                    className={`font-medium ${
                      challenge.is_completed ? 'text-emerald-400' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {challenge.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs">+{challenge.xp_reward}</span>
                </div>
              </div>

              <p className="text-xs text-[var(--text-tertiary)] mb-3 ml-7">
                {challenge.description}
              </p>

              {/* Progress bar */}
              <div className="ml-7">
                <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                  <span>
                    {challenge.current_progress} / {challenge.target_count}
                  </span>
                  {!challenge.is_completed && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      剩余 {challenge.days_left} 天
                    </span>
                  )}
                </div>
                <div className="h-1.5 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      challenge.is_completed
                        ? 'bg-emerald-400'
                        : 'bg-gradient-to-r from-cyan-500 to-purple-500'
                    }`}
                    style={{ width: `${challenge.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
