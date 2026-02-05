'use client';

import { useEffect, useState } from 'react';
import { Award, Lock } from 'lucide-react';

interface Badge {
  badge_type: string;
  title: string;
  description: string;
  icon: string;
  rarity: string;
  earned: boolean;
  earned_at?: string;
}

interface Props {
  className?: string;
  showAll?: boolean;
}

const rarityColors: Record<string, string> = {
  common: 'border-slate-500/30 bg-slate-500/10',
  rare: 'border-blue-500/30 bg-blue-500/10',
  epic: 'border-purple-500/30 bg-purple-500/10',
  legendary: 'border-amber-500/30 bg-amber-500/10',
};

const rarityGlow: Record<string, string> = {
  common: '',
  rare: 'shadow-blue-500/20',
  epic: 'shadow-purple-500/20',
  legendary: 'shadow-amber-500/30 shadow-lg',
};

export default function BadgeCollection({ className = '', showAll = false }: Props) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(showAll);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/gamification/badges');
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
        setEarnedCount(data.earned_count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayBadges = expanded ? badges : badges.slice(0, 8);

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white/90">成就徽章</h3>
        </div>
        <span className="text-xs text-white/40">
          {earnedCount} / {badges.length}
        </span>
      </div>

      {/* Badges grid */}
      <div className="grid grid-cols-4 gap-3">
        {displayBadges.map((badge, idx) => (
          <div
            key={badge.badge_type}
            className={`relative p-3 rounded-xl border transition-all ${
              badge.earned
                ? `${rarityColors[badge.rarity]} ${rarityGlow[badge.rarity]}`
                : 'border-white/5 bg-white/5 opacity-40'
            }`}
            title={badge.description}
          >
            <div className="text-center">
              <div className="text-2xl mb-1">
                {badge.earned ? badge.icon : <Lock className="w-5 h-5 mx-auto text-white/30" />}
              </div>
              <div className="text-xs text-white/70 truncate">{badge.title}</div>
            </div>
            
            {/* Rarity indicator */}
            {badge.earned && badge.rarity !== 'common' && (
              <div
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                  badge.rarity === 'legendary'
                    ? 'bg-amber-400'
                    : badge.rarity === 'epic'
                    ? 'bg-purple-400'
                    : 'bg-blue-400'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Expand/collapse */}
      {badges.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          {expanded ? '收起' : `查看全部 ${badges.length} 个徽章`}
        </button>
      )}

      {/* Badge descriptions on hover - could be a tooltip in future */}
      {earnedCount === 0 && (
        <p className="text-center text-white/40 text-sm mt-4">
          开始记录生活，解锁你的第一个徽章！
        </p>
      )}
    </div>
  );
}
