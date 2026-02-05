'use client';

import { useEffect, useState } from 'react';
import { Zap, DollarSign, BarChart3 } from 'lucide-react';

interface UsageSummary {
  today: { tokens: number; cost: number; requests: number };
  week: { tokens: number; cost: number; requests: number };
  month: { tokens: number; cost: number; requests: number };
}

interface Props {
  className?: string;
}

export default function TokenUsage({ className = '' }: Props) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/tokens/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch token usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className={`glass-card p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 bg-white/10 rounded w-1/3 mb-3"></div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const periods = [
    { label: '今日', data: summary.today, icon: '📅' },
    { label: '本周', data: summary.week, icon: '📊' },
    { label: '本月', data: summary.month, icon: '📈' },
  ];

  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-medium text-white/80">AI 用量统计</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {periods.map(({ label, data, icon }) => (
          <div
            key={label}
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm">{icon}</span>
              <span className="text-xs text-white/50">{label}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Tokens</span>
                <span className="text-sm font-medium text-white/80">
                  {formatTokens(data.tokens)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Cost</span>
                <span className="text-sm font-medium text-emerald-400">
                  {formatCost(data.cost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Requests</span>
                <span className="text-sm font-medium text-white/80">
                  {data.requests}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {summary.month.cost > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">本月预估成本</span>
            <span className="text-amber-400 font-medium">
              {formatCost(summary.month.cost)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
