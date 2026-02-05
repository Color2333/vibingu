'use client';

import { useState, useEffect } from 'react';
import { Moon, Coffee, Smartphone, Zap } from 'lucide-react';
import ShareCard from './ShareCard';

interface VibeScore {
  date: string;
  vibe_score: number | null;
  sleep_score: number | null;
  diet_score: number | null;
  screen_score: number | null;
  activity_score: number | null;
  insights: string[];
  record_count: number;
}

export default function VibingCard() {
  const [vibeData, setVibeData] = useState<VibeScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVibeScore = async () => {
      try {
        const response = await fetch('/api/analytics/vibe/today');
        if (response.ok) {
          const data = await response.json();
          setVibeData(data);
        }
      } catch (error) {
        console.error('获取 Vibe 数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVibeScore();
    const interval = setInterval(fetchVibeScore, 60000);
    return () => clearInterval(interval);
  }, []);

  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-white/30';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-low';
  };

  const getVibeLabel = (score: number | null) => {
    if (score === null) return 'No Data';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
  };

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-8">
        <div className="h-32 skeleton rounded-2xl" />
      </div>
    );
  }

  const vibeScore = vibeData?.vibe_score ?? null;

  return (
    <div className="glass rounded-3xl p-6 md:p-8">
      {/* Header with Share */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          Today&apos;s Vibe
        </p>
<ShareCard />
      </div>
      
      {/* Main Score */}
      <div className="text-center mb-8">
        <div className="relative inline-block">
          <span className={`text-7xl md:text-8xl font-light number-display ${getScoreClass(vibeScore)}`}>
            {vibeScore !== null ? vibeScore : '—'}
          </span>
          {vibeScore !== null && vibeScore >= 70 && (
            <div className="absolute -inset-4 bg-current opacity-20 blur-3xl rounded-full -z-10" />
          )}
        </div>
        <p className={`mt-2 text-sm ${getScoreClass(vibeScore)}`}>
          {getVibeLabel(vibeScore)}
        </p>
      </div>

      {/* Dimension Grid */}
      <div className="grid grid-cols-4 gap-3">
        <DimensionItem
          icon={<Moon className="w-4 h-4" />}
          label="睡眠"
          score={vibeData?.sleep_score ?? null}
        />
        <DimensionItem
          icon={<Coffee className="w-4 h-4" />}
          label="饮食"
          score={vibeData?.diet_score ?? null}
        />
        <DimensionItem
          icon={<Smartphone className="w-4 h-4" />}
          label="屏幕"
          score={vibeData?.screen_score ?? null}
        />
        <DimensionItem
          icon={<Zap className="w-4 h-4" />}
          label="活动"
          score={vibeData?.activity_score ?? null}
        />
      </div>

      {/* Insight */}
      {vibeData?.insights && vibeData.insights.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <p className="text-sm text-white/50 leading-relaxed">
            {vibeData.insights[0]}
          </p>
        </div>
      )}
    </div>
  );
}

function DimensionItem({ 
  icon, 
  label, 
  score 
}: { 
  icon: React.ReactNode; 
  label: string; 
  score: number | null;
}) {
  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-white/30';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-low';
  };

  return (
    <div className="glass-subtle rounded-2xl p-3 text-center">
      <div className="text-white/40 flex justify-center mb-2">
        {icon}
      </div>
      <p className={`text-lg font-medium number-display ${getScoreClass(score)}`}>
        {score !== null ? score : '—'}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-white/30 mt-1">
        {label}
      </p>
    </div>
  );
}
