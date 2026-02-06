'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3 } from 'lucide-react';

interface DimensionInfo {
  name: string;
  icon: string;
  score: number;
  record_count: number;
}

interface DimensionData {
  date: string;
  vibe_score: number;
  dimensions: Record<string, DimensionInfo>;
  record_count: number;
}

const DIMENSION_DETAILS: Record<string, { color: string; gradient: string; description: string }> = {
  body:    { color: 'text-rose-400',    gradient: 'from-rose-500/20 to-rose-500/5',    description: '睡眠、饮食、运动对身体健康的综合影响' },
  mood:    { color: 'text-amber-400',   gradient: 'from-amber-500/20 to-amber-500/5',  description: '情绪状态、心理健康与幸福感' },
  social:  { color: 'text-blue-400',    gradient: 'from-blue-500/20 to-blue-500/5',    description: '人际互动、社会连接质量' },
  work:    { color: 'text-indigo-400',  gradient: 'from-indigo-500/20 to-indigo-500/5', description: '工作效率、职业成就感' },
  growth:  { color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-emerald-500/5', description: '学习进步、技能提升、个人发展' },
  meaning: { color: 'text-purple-400',  gradient: 'from-purple-500/20 to-purple-500/5', description: '价值感、目标感、生活充实度' },
  digital: { color: 'text-cyan-400',    gradient: 'from-cyan-500/20 to-cyan-500/5',    description: '数字健康程度，屏幕时间管理' },
  leisure: { color: 'text-pink-400',    gradient: 'from-pink-500/20 to-pink-500/5',    description: '放松恢复、心流体验与兴趣爱好' },
};

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '优秀', color: 'text-emerald-400' };
  if (score >= 60) return { label: '良好', color: 'text-blue-400' };
  if (score >= 40) return { label: '一般', color: 'text-amber-400' };
  if (score >= 20) return { label: '偏低', color: 'text-orange-400' };
  return { label: '较差', color: 'text-rose-400' };
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-1.5 bg-[var(--glass-bg)] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function TrendIcon({ score }: { score: number }) {
  if (score >= 70) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (score <= 30) return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
  return <Minus className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />;
}

export default function DimensionDeepDive({ className = '' }: { className?: string }) {
  const [data, setData] = useState<DimensionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/dimensions/today');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-[var(--glass-bg)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <Header />
        <div className="text-center py-8">
          <p className="text-[var(--text-tertiary)]">暂无维度数据</p>
        </div>
      </div>
    );
  }

  // Sort dimensions by score descending
  const sortedDims = Object.entries(data.dimensions).sort(
    ([, a], [, b]) => b.score - a.score
  );

  // Find strongest and weakest
  const strongest = sortedDims[0];
  const weakest = sortedDims[sortedDims.length - 1];

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header with Vibe Score */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">维度分析</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(data.vibe_score)}</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">综合评分</div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
            aria-label="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Summary */}
      {data.record_count > 0 && strongest && weakest && (
        <div className="flex gap-2 mb-4 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            最佳: {strongest[1].icon} {strongest[1].name} {Math.round(strongest[1].score)}
          </span>
          <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            关注: {weakest[1].icon} {weakest[1].name} {Math.round(weakest[1].score)}
          </span>
          <span className="ml-auto px-2 py-1 rounded-full bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
            {data.record_count} 条记录
          </span>
        </div>
      )}

      {/* Dimension List */}
      <div className="space-y-2">
        {sortedDims.map(([key, dim]) => {
          const detail = DIMENSION_DETAILS[key];
          const isExpanded = expandedDim === key;
          const level = getScoreLevel(dim.score);

          return (
            <div key={key} className="rounded-xl border border-[var(--border)] overflow-hidden">
              {/* Dimension Row */}
              <button
                onClick={() => setExpandedDim(isExpanded ? null : key)}
                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--glass-bg)] transition-colors"
              >
                <span className="text-xl w-7 text-center">{dim.icon}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{dim.name}</span>
                    <TrendIcon score={dim.score} />
                  </div>
                  <ScoreBar
                    score={dim.score}
                    color={detail?.gradient || 'from-gray-500/20 to-gray-500/5'}
                  />
                </div>
                <div className="text-right mr-1">
                  <span className={`text-lg font-bold ${detail?.color || 'text-[var(--text-primary)]'}`}>
                    {Math.round(dim.score)}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className={`px-4 pb-3 border-t border-[var(--border)] bg-gradient-to-b ${detail?.gradient || ''}`}>
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-tertiary)]">评级</span>
                      <span className={`font-medium ${level.color}`}>{level.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-tertiary)]">相关记录</span>
                      <span className="text-[var(--text-secondary)]">{dim.record_count} 条</span>
                    </div>
                    {detail?.description && (
                      <p className="text-xs text-[var(--text-tertiary)] pt-1 leading-relaxed">
                        {detail.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">维度分析</h3>
    </div>
  );
}
