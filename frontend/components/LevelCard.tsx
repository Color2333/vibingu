'use client';

import { useEffect, useState } from 'react';
import { Star, Flame, Trophy } from 'lucide-react';

interface LevelInfo {
  current_level: number;
  level_title: string;
  total_xp: number;
  xp_to_next_level: number;
  progress_percent: number;
  total_records: number;
  current_streak: number;
  longest_streak: number;
  max_level: number;
}

interface Props {
  className?: string;
}

export default function LevelCard({ className = '' }: Props) {
  const [data, setData] = useState<LevelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLevel();
  }, []);

  const fetchLevel = async () => {
    try {
      const res = await fetch('/api/gamification/level');
      if (res.ok) {
        const levelData = await res.json();
        setData(levelData);
      }
    } catch (error) {
      console.error('Failed to fetch level:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">等级</h3>
        </div>
        <span className="text-xs text-white/40">
          {data.total_records} 条记录
        </span>
      </div>

      {/* Level display */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-2">
          <span className="text-3xl font-bold text-amber-400">
            {data.current_level}
          </span>
        </div>
        <div className="text-white/70 font-medium">{data.level_title}</div>
      </div>

      {/* XP Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span>经验值</span>
          <span>{data.total_xp} XP</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${data.progress_percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>Lv.{data.current_level}</span>
          <span>
            {data.current_level < data.max_level
              ? `还需 ${data.xp_to_next_level} XP`
              : '已满级'}
          </span>
          <span>Lv.{Math.min(data.current_level + 1, data.max_level)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xl font-bold text-white/90">
              {data.current_streak}
            </span>
          </div>
          <div className="text-xs text-white/50">连续记录</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xl font-bold text-white/90">
              {data.longest_streak}
            </span>
          </div>
          <div className="text-xs text-white/50">最长连续</div>
        </div>
      </div>
    </div>
  );
}
