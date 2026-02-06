'use client';

import { useState, useEffect } from 'react';
import { Moon, Coffee, Smartphone, Zap, Heart, Users, Briefcase, BookOpen, Target, Gamepad2, Brain } from 'lucide-react';
import ShareCard from './ShareCard';

interface VibeScore {
  date: string;
  vibe_score: number | null;
  dimension_averages: Record<string, number> | null; // LLM 模式
  sleep_score: number | null;  // 规则模式 fallback
  diet_score: number | null;
  screen_score: number | null;
  activity_score: number | null;
  insights: string[];
  record_count: number;
  scoring_mode: string; // "llm" / "rules" / "none"
}

// 八维度配置
const DIMENSION_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  body:    { icon: <Heart className="w-3.5 h-3.5" />,      label: '身体', color: 'text-rose-400' },
  mood:    { icon: <Brain className="w-3.5 h-3.5" />,      label: '心情', color: 'text-amber-400' },
  social:  { icon: <Users className="w-3.5 h-3.5" />,      label: '社交', color: 'text-blue-400' },
  work:    { icon: <Briefcase className="w-3.5 h-3.5" />,  label: '工作', color: 'text-indigo-400' },
  growth:  { icon: <BookOpen className="w-3.5 h-3.5" />,   label: '成长', color: 'text-emerald-400' },
  meaning: { icon: <Target className="w-3.5 h-3.5" />,     label: '意义', color: 'text-purple-400' },
  digital: { icon: <Smartphone className="w-3.5 h-3.5" />, label: '数字', color: 'text-cyan-400' },
  leisure: { icon: <Gamepad2 className="w-3.5 h-3.5" />,   label: '休闲', color: 'text-pink-400' },
};

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
    if (score === null) return 'text-[var(--text-tertiary)]';
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
  const isLLMMode = vibeData?.scoring_mode === 'llm' && vibeData.dimension_averages;

  return (
    <div className="glass rounded-3xl p-6 md:p-8">
      {/* Header with Share */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            Today&apos;s Vibe
          </p>
          {isLLMMode && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
              AI
            </span>
          )}
        </div>
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

      {/* Dimension Grid - 根据模式展示不同内容 */}
      {isLLMMode ? (
        /* LLM 模式: 八维度 */
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(DIMENSION_CONFIG).map(([key, config]) => {
            const score = vibeData?.dimension_averages?.[key] ?? null;
            return (
              <DimensionItem
                key={key}
                icon={config.icon}
                label={config.label}
                score={score}
                accentColor={config.color}
              />
            );
          })}
        </div>
      ) : (
        /* 规则模式 Fallback: 四维度 */
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
      )}

      {/* Insights */}
      {vibeData?.insights && vibeData.insights.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[var(--border)]">
          {vibeData.insights.map((insight, i) => (
            <p key={i} className="text-sm text-[var(--text-secondary)] leading-relaxed mb-1 last:mb-0">
              {insight}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function DimensionItem({ 
  icon, 
  label, 
  score,
  accentColor,
}: { 
  icon: React.ReactNode; 
  label: string; 
  score: number | null;
  accentColor?: string;
}) {
  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-[var(--text-tertiary)]';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-low';
  };

  return (
    <div className="glass-subtle rounded-2xl p-3 text-center">
      <div className={`${accentColor || 'text-[var(--text-tertiary)]'} flex justify-center mb-2`}>
        {icon}
      </div>
      <p className={`text-lg font-medium number-display ${getScoreClass(score)}`}>
        {score !== null ? Math.round(score) : '—'}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mt-1">
        {label}
      </p>
    </div>
  );
}
