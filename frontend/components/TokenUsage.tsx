'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, AlertTriangle, PieChart, RefreshCw } from 'lucide-react';

interface UsageSummary {
  today: { tokens: number; cost: number; requests: number };
  week: { tokens: number; cost: number; requests: number };
  month: { tokens: number; cost: number; requests: number };
}

interface TrendData {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface ModelUsage {
  [key: string]: {
    tokens: number;
    cost: number;
    count: number;
  };
}

interface Props {
  className?: string;
  expanded?: boolean;
}

export default function TokenUsage({ className = '', expanded = false }: Props) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage>({});
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(expanded);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const [summaryRes, trendRes, modelRes] = await Promise.all([
        fetch('/api/tokens/summary'),
        fetch('/api/tokens/trend?days=14'),
        fetch('/api/tokens/by-model?period=month'),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (trendRes.ok) {
        const data = await trendRes.json();
        setTrend(data.trend || []);
      }
      if (modelRes.ok) {
        const data = await modelRes.json();
        setModelUsage(data.by_model || {});
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
    if (cost >= 1) {
      return `¥${cost.toFixed(2)}`;
    }
    return `¥${cost.toFixed(4)}`;
  };

  // 计算趋势方向
  const getTrendDirection = () => {
    if (trend.length < 7) return 'stable';
    const firstHalf = trend.slice(0, 7).reduce((s, d) => s + d.tokens, 0);
    const secondHalf = trend.slice(7).reduce((s, d) => s + d.tokens, 0);
    if (secondHalf > firstHalf * 1.2) return 'up';
    if (secondHalf < firstHalf * 0.8) return 'down';
    return 'stable';
  };

  // 获取最大值用于归一化
  const maxTokens = Math.max(...trend.map((d) => d.tokens), 1);

  // 模型类型映射
  const modelTypeLabels: Record<string, string> = {
    vision: '视觉模型',
    text: '文本模型',
    smart: '高级模型',
    embedding: '嵌入模型',
    other: '其他',
  };

  // 计算模型使用比例
  const totalModelTokens = Object.values(modelUsage).reduce((s, m) => s + m.tokens, 0);

  if (loading) {
    return (
      <div className={`glass-card p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 bg-white/10 rounded w-1/3 mb-3"></div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-lg"></div>
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

  const trendDirection = getTrendDirection();

  // 成本预警阈值 (可配置)
  const costWarningThreshold = 10; // ¥10
  const isOverBudget = summary.month.cost > costWarningThreshold;

  return (
    <div className={`glass-card p-4 ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-white/80">AI 用量统计</h3>
          {trendDirection === 'up' && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
              ↑ 上升
            </span>
          )}
        </div>
        <button
          onClick={fetchUsage}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>

      {/* 成本预警 */}
      {isOverBudget && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">
            本月成本已超过 {formatCost(costWarningThreshold)}，请注意控制用量
          </span>
        </div>
      )}

      {/* 三列统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {periods.map(({ label, data, icon }) => (
          <div
            key={label}
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm">{icon}</span>
              <span className="text-xs text-white/50">{label}</span>
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="text-lg font-semibold text-white/90">
                  {formatTokens(data.tokens)}
                </div>
                <div className="text-[10px] text-white/40">tokens</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400">{formatCost(data.cost)}</span>
                <span className="text-xs text-white/40">{data.requests} 次</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 14天趋势迷你图 */}
      {trend.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/50">近14天用量趋势</span>
          </div>
          <div className="flex items-end gap-1 h-12">
            {trend.slice(-14).map((d, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-violet-500/60 to-violet-400/30 rounded-t"
                style={{
                  height: `${Math.max((d.tokens / maxTokens) * 100, 4)}%`,
                }}
                title={`${d.date}: ${formatTokens(d.tokens)}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/30">
              {trend[0]?.date?.slice(5)}
            </span>
            <span className="text-[10px] text-white/30">
              {trend[trend.length - 1]?.date?.slice(5)}
            </span>
          </div>
        </div>
      )}

      {/* 展开详情按钮 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
      >
        {showDetails ? '收起详情 ▲' : '查看详情 ▼'}
      </button>

      {/* 详情面板 */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-4">
          {/* 模型使用分布 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs text-white/50">模型使用分布</span>
            </div>
            <div className="space-y-2">
              {Object.entries(modelUsage).map(([type, data]) => {
                const percentage = totalModelTokens > 0 
                  ? (data.tokens / totalModelTokens) * 100 
                  : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/60">
                        {modelTypeLabels[type] || type}
                      </span>
                      <span className="text-white/40">
                        {formatTokens(data.tokens)} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          type === 'vision'
                            ? 'bg-blue-500'
                            : type === 'smart'
                            ? 'bg-purple-500'
                            : type === 'text'
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 成本明细 */}
          <div className="p-3 rounded-lg bg-white/5">
            <div className="text-xs text-white/50 mb-2">本月成本明细</div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(modelUsage).map(([type, data]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-xs text-white/60">
                    {modelTypeLabels[type] || type}
                  </span>
                  <span className="text-xs text-emerald-400">
                    {formatCost(data.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 使用提示 */}
          <div className="p-2 rounded-lg bg-blue-500/10 text-xs text-blue-300">
            💡 提示：简单任务自动使用免费模型，复杂分析使用付费模型以保证质量
          </div>
        </div>
      )}
    </div>
  );
}
