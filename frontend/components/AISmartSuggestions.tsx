'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Lightbulb, Target, RefreshCw, Zap, Heart } from 'lucide-react';

interface Suggestion {
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'high' | 'medium' | 'low';
  emoji: string;
}

interface SuggestionsData {
  focus_area: string | null;
  focus_reason: string | null;
  suggestions: Suggestion[];
  encouragement: string;
}

interface Props {
  className?: string;
}

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '挑战',
};

const impactColors = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
};

const categoryIcons: Record<string, React.ReactNode> = {
  sleep: <span>😴</span>,
  activity: <span>🏃</span>,
  screen: <span>📱</span>,
  mood: <span>😊</span>,
  diet: <span>🍎</span>,
  social: <span>👥</span>,
};

export default function AISmartSuggestions({ className = '' }: Props) {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/ai/suggestions');
      if (res.ok) {
        const suggestions = await res.json();
        setData(suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSuggestions();
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-white/5 rounded"></div>
            <div className="h-20 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <p className="text-white/50 text-center py-4">暂无建议</p>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">AI 智能建议</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 聚焦区域 */}
      {data.focus_area && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">当前聚焦</span>
          </div>
          <p className="text-white/80 font-medium">{data.focus_area}</p>
          {data.focus_reason && (
            <p className="text-xs text-white/50 mt-1">{data.focus_reason}</p>
          )}
        </div>
      )}

      {/* 建议列表 */}
      <div className="space-y-3">
        {data.suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {suggestion.emoji || categoryIcons[suggestion.category] || '💡'}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-white/90">
                    {suggestion.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${impactColors[suggestion.impact]}`}>
                      <Zap className="w-3 h-3 inline mr-0.5" />
                      {suggestion.impact === 'high' ? '高影响' : 
                       suggestion.impact === 'medium' ? '中影响' : '低影响'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  {suggestion.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                    {difficultyLabels[suggestion.difficulty]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 鼓励语 */}
      {data.encouragement && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Heart className="w-4 h-4 text-pink-400" />
            <p>{data.encouragement}</p>
          </div>
        </div>
      )}
    </div>
  );
}
