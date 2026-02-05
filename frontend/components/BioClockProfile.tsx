'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Dumbbell, Users, Coffee, Clock } from 'lucide-react';

interface OptimalTime {
  best_hour: number;
  label: string;
  duration?: string;
}

interface SleepTime {
  bedtime: string;
  waketime: string;
}

interface BioClockData {
  chronotype: {
    type: string;
    name: string;
    description: string;
  };
  optimal_times: {
    focus_work: OptimalTime;
    exercise: OptimalTime;
    sleep: SleepTime;
    social: OptimalTime;
    meals: {
      breakfast: OptimalTime;
      lunch: OptimalTime;
      dinner: OptimalTime;
    };
  };
  weekly_pattern: {
    best_day: { day: string; score: number };
    worst_day: { day: string; score: number };
    weekend_boost: number;
  };
  peak_hours: number[];
  recommendations: string[];
}

interface Props {
  className?: string;
}

const chronotypeIcons: Record<string, string> = {
  lion: '🦁',
  bear: '🐻',
  wolf: '🐺',
  dolphin: '🐬',
};

const chronotypeColors: Record<string, string> = {
  lion: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
  bear: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
  wolf: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30',
  dolphin: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
};

export default function BioClockProfile({ className = '' }: Props) {
  const [data, setData] = useState<BioClockData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/time/bio-clock');
      if (res.ok) {
        const bioData = await res.json();
        setData(bioData);
      }
    } catch (error) {
      console.error('Failed to fetch bio clock data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-white/90 mb-4">生物钟画像</h3>
        <p className="text-white/50 text-center py-8">暂无足够数据生成画像</p>
      </div>
    );
  }

  const { chronotype, optimal_times, weekly_pattern, recommendations } = data;

  return (
    <div className={`glass-card p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white/90 mb-4">我的生物钟画像</h3>

      {/* Chronotype Card */}
      <div
        className={`p-4 rounded-xl bg-gradient-to-r ${
          chronotypeColors[chronotype.type] || chronotypeColors.bear
        } border mb-6`}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">
            {chronotypeIcons[chronotype.type] || '🐻'}
          </span>
          <div>
            <h4 className="text-lg font-semibold text-white">{chronotype.name}</h4>
            <p className="text-sm text-white/70">{chronotype.description}</p>
          </div>
        </div>
      </div>

      {/* Optimal Times Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Focus Work */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-white/50">最佳专注时间</span>
          </div>
          <div className="text-lg font-semibold text-white/90">
            {optimal_times.focus_work.label}
          </div>
          {optimal_times.focus_work.duration && (
            <div className="text-xs text-white/40">
              建议持续 {optimal_times.focus_work.duration}
            </div>
          )}
        </div>

        {/* Exercise */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/50">最佳运动时间</span>
          </div>
          <div className="text-lg font-semibold text-white/90">
            {optimal_times.exercise.label}
          </div>
        </div>

        {/* Sleep */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-white/50">理想睡眠窗口</span>
          </div>
          <div className="text-sm text-white/90">
            <span className="font-semibold">{optimal_times.sleep.bedtime}</span>
            <span className="text-white/40 mx-1">→</span>
            <span className="font-semibold">{optimal_times.sleep.waketime}</span>
          </div>
        </div>

        {/* Social */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/50">社交高峰期</span>
          </div>
          <div className="text-lg font-semibold text-white/90">
            {optimal_times.social.label}
          </div>
        </div>
      </div>

      {/* Meals Timeline */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Coffee className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-white/70">理想用餐时间</span>
        </div>
        <div className="flex justify-between px-2">
          <div className="text-center">
            <div className="text-xs text-white/40">早餐</div>
            <div className="text-sm font-medium text-white/80">
              {optimal_times.meals.breakfast.label}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-px bg-white/10 w-full mx-4"></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">午餐</div>
            <div className="text-sm font-medium text-white/80">
              {optimal_times.meals.lunch.label}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-px bg-white/10 w-full mx-4"></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">晚餐</div>
            <div className="text-sm font-medium text-white/80">
              {optimal_times.meals.dinner.label}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Pattern */}
      <div className="p-4 rounded-lg bg-white/5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-white/40">最佳日</span>
            <div className="text-sm">
              <span className="text-emerald-400 font-medium">
                {weekly_pattern.best_day.day}
              </span>
              <span className="text-white/50 ml-2">
                {weekly_pattern.best_day.score}分
              </span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs text-white/40">周末提升</span>
            <div
              className={`text-sm font-medium ${
                weekly_pattern.weekend_boost > 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {weekly_pattern.weekend_boost > 0 ? '+' : ''}
              {weekly_pattern.weekend_boost}分
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-white/40">需关注日</span>
            <div className="text-sm">
              <span className="text-red-400 font-medium">
                {weekly_pattern.worst_day.day}
              </span>
              <span className="text-white/50 ml-2">
                {weekly_pattern.worst_day.score}分
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm text-white/70 mb-2">个性化建议</h4>
          <ul className="space-y-2">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-white/60"
              >
                <span className="text-amber-400 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
