'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, AlertTriangle, PieChart, RefreshCw, Activity, Clock, ChevronDown, ChevronUp, Cpu, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ========== 类型 ==========

interface PeriodData {
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  requests: number;
  avg_tokens: number;
}

interface ModelData {
  tokens: number;
  cost: number;
  count: number;
}

interface ModelNameData {
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  count: number;
  model_type: string;
}

interface TaskData {
  tokens: number;
  cost: number;
  count: number;
}

interface RecentRecord {
  id: number;
  time: string;
  model: string;
  model_type: string;
  task: string;
  task_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
}

interface TrendData {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface DetailedSummary {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  month_by_model: Record<string, ModelData>;
  month_by_model_name: Record<string, ModelNameData>;
  month_by_task: Record<string, TaskData>;
  recent: RecentRecord[];
}

interface Props {
  className?: string;
  expanded?: boolean;
}

// ========== 工具函数 ==========

const formatTokens = (tokens: number) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

const formatCost = (cost: number) => {
  if (cost >= 1) return `¥${cost.toFixed(2)}`;
  if (cost > 0) return `¥${cost.toFixed(4)}`;
  return '¥0';
};

// ========== 标签映射 ==========

const modelTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
  vision:      { label: '付费视觉', color: 'bg-blue-500',    icon: '👁️' },
  vision_free: { label: '免费视觉', color: 'bg-sky-400',     icon: '👁️' },
  text:        { label: '轻量文本', color: 'bg-green-500',   icon: '📝' },
  text_free:   { label: '免费文本', color: 'bg-teal-400',    icon: '📝' },
  smart:       { label: '高级模型', color: 'bg-purple-500',  icon: '🧠' },
  embedding:   { label: '嵌入模型', color: 'bg-cyan-500',    icon: '🔗' },
  other:       { label: '其他',     color: 'bg-gray-500',    icon: '⚙️' },
};

// 具体模型名 → 显示配置
const modelNameConfig: Record<string, { short: string; color: string; free: boolean }> = {
  'glm-4.7':         { short: 'GLM-4.7',       color: 'bg-purple-500',  free: false },
  'glm-4.7-flash':   { short: 'GLM-4.7-Flash', color: 'bg-teal-400',    free: true },
  'glm-4.6v':        { short: 'GLM-4.6V',      color: 'bg-blue-500',    free: false },
  'glm-4.6v-flash':  { short: 'GLM-4.6V-Flash',color: 'bg-sky-400',     free: true },
  'embedding-3':     { short: 'Embedding-3',    color: 'bg-cyan-500',    free: false },
  'gpt-4o':          { short: 'GPT-4o',         color: 'bg-violet-500',  free: false },
  'gpt-4o-mini':     { short: 'GPT-4o-mini',    color: 'bg-green-500',   free: false },
  'gpt-3.5-turbo':   { short: 'GPT-3.5',       color: 'bg-lime-500',    free: false },
  'text-embedding-3-small': { short: 'Embed-3-S', color: 'bg-cyan-400',  free: false },
};

const taskTypeLabels: Record<string, { label: string; icon: string }> = {
  parse_input:      { label: '解析输入',  icon: '📋' },
  classify_image:   { label: '图片分类',  icon: '🖼️' },
  extract_data:     { label: '数据提取',  icon: '🔍' },
  generate_tags:    { label: '生成标签',  icon: '🏷️' },
  generate_insight: { label: '生成洞察',  icon: '💡' },
  rag_query:        { label: 'RAG 查询', icon: '📚' },
  embedding:        { label: '向量嵌入',  icon: '🔗' },
  chat:             { label: 'AI 对话',   icon: '💬' },
  daily_digest:     { label: '每日摘要',  icon: '📰' },
  score_dimensions: { label: '维度评分',  icon: '📊' },
  other:            { label: '其他',      icon: '⚙️' },
};

// ========== 组件 ==========

export default function TokenUsage({ className = '', expanded = false }: Props) {
  const [data, setData] = useState<DetailedSummary | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(expanded);
  const [detailTab, setDetailTab] = useState<'model' | 'task' | 'recent'>('task');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [detailRes, trendRes] = await Promise.all([
        fetch('/api/tokens/detailed-summary'),
        fetch('/api/tokens/trend?days=14'),
      ]);
      if (detailRes.ok) setData(await detailRes.json());
      if (trendRes.ok) {
        const t = await trendRes.json();
        setTrend(t.trend || []);
      }
    } catch (e) {
      console.error('Failed to fetch token usage:', e);
    } finally {
      setLoading(false);
    }
  };

  // 趋势方向
  const getTrendDirection = () => {
    if (trend.length < 4) return 'stable';
    const half = Math.floor(trend.length / 2);
    const first = trend.slice(0, half).reduce((s, d) => s + d.tokens, 0);
    const second = trend.slice(half).reduce((s, d) => s + d.tokens, 0);
    if (second > first * 1.2) return 'up';
    if (second < first * 0.8) return 'down';
    return 'stable';
  };

  const maxTokens = Math.max(...trend.map(d => d.tokens), 1);
  const trendDir = getTrendDirection();

  if (loading) {
    return (
      <div className={`glass-card p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-[var(--glass-bg)] rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--glass-bg)] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const periods: { key: 'today' | 'week' | 'month'; label: string; icon: string }[] = [
    { key: 'today', label: '今日', icon: '📅' },
    { key: 'week',  label: '本周', icon: '📊' },
    { key: 'month', label: '本月', icon: '📈' },
  ];

  const costWarning = data.month.cost > 10;
  const totalModelNameTokens = Object.values(data.month_by_model_name || {}).reduce((s, m) => s + m.tokens, 0);
  const totalTaskTokens = Object.values(data.month_by_task).reduce((s, m) => s + m.tokens, 0);

  return (
    <div className={`glass-card p-4 ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-[var(--text-primary)]">AI 用量统计</h3>
          {trendDir === 'up' && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded">
              <ArrowUpRight className="w-2.5 h-2.5" /> 上升
            </span>
          )}
          {trendDir === 'down' && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-400 rounded">
              <ArrowDownRight className="w-2.5 h-2.5" /> 下降
            </span>
          )}
        </div>
        <button onClick={fetchAll} className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] transition-colors" title="刷新">
          <RefreshCw className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </button>
      </div>

      {/* 成本预警 */}
      {costWarning && (
        <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">本月成本已超过 ¥10，请注意控制用量</span>
        </div>
      )}

      {/* 三列统计卡片 — 增强版 */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {periods.map(({ key, label, icon }) => {
          const d = data[key];
          return (
            <div key={key} className="p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)] hover:border-[var(--glass-border)] transition-colors">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-sm">{icon}</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">{label}</span>
              </div>
              {/* 总 token */}
              <div className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                {formatTokens(d.tokens)}
              </div>
              <div className="text-[9px] text-[var(--text-tertiary)] mb-1.5">tokens</div>
              {/* prompt / completion 拆分 */}
              <div className="flex gap-1 mb-1.5">
                <div className="flex-1 h-1 rounded-full bg-blue-500/30 overflow-hidden" title={`输入 ${formatTokens(d.prompt_tokens)}`}>
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: d.tokens > 0 ? `${(d.prompt_tokens / d.tokens) * 100}%` : '0%' }} />
                </div>
                <div className="flex-1 h-1 rounded-full bg-emerald-500/30 overflow-hidden" title={`输出 ${formatTokens(d.completion_tokens)}`}>
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: d.tokens > 0 ? `${(d.completion_tokens / d.tokens) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-blue-400">入{formatTokens(d.prompt_tokens)}</span>
                <span className="text-emerald-400">出{formatTokens(d.completion_tokens)}</span>
              </div>
              {/* 成本 & 次数 */}
              <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">{formatCost(d.cost)}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{d.requests}次</span>
              </div>
              {/* 平均单次 */}
              {d.requests > 0 && (
                <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5">
                  均 {formatTokens(d.avg_tokens)}/次
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 14天趋势 */}
      {trend.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">近14天趋势</span>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              总计 {formatTokens(trend.reduce((s, d) => s + d.tokens, 0))}
            </span>
          </div>
          <div className="flex items-end gap-[3px] h-14">
            {trend.slice(-14).map((d, i) => {
              const h = Math.max((d.tokens / maxTokens) * 100, 4);
              const isToday = i === trend.slice(-14).length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday
                        ? 'bg-gradient-to-t from-indigo-500 to-violet-400'
                        : d.tokens > 0
                          ? 'bg-gradient-to-t from-violet-500/50 to-violet-400/20 group-hover:from-violet-500/70 group-hover:to-violet-400/40'
                          : 'bg-[var(--glass-bg)]'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] shadow-lg whitespace-nowrap">
                    <div className="text-[10px] text-[var(--text-primary)] font-medium">{formatTokens(d.tokens)}</div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">{d.date.slice(5)} · {d.requests}次</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[var(--text-tertiary)] opacity-60">{trend[Math.max(trend.length - 14, 0)]?.date?.slice(5)}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] opacity-60">{trend[trend.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* 展开/收起 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full py-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center justify-center gap-1"
      >
        {showDetails ? <><ChevronUp className="w-3 h-3" />收起详情</> : <><ChevronDown className="w-3 h-3" />查看详情</>}
      </button>

      {/* 详情面板 */}
      {showDetails && (
        <div className="mt-2 pt-3 border-t border-[var(--border)] space-y-4">
          {/* Tab 切换 */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--glass-bg)]">
            {([
              { key: 'task' as const, label: '按任务', icon: <Activity className="w-3 h-3" /> },
              { key: 'model' as const, label: '按模型', icon: <Cpu className="w-3 h-3" /> },
              { key: 'recent' as const, label: '最近记录', icon: <Clock className="w-3 h-3" /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setDetailTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  detailTab === tab.key
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* 按任务分布 */}
          {detailTab === 'task' && (
            <div className="space-y-2">
              {Object.entries(data.month_by_task)
                .sort((a, b) => b[1].tokens - a[1].tokens)
                .map(([type, td]) => {
                  const cfg = taskTypeLabels[type] || { label: type, icon: '⚙️' };
                  const pct = totalTaskTokens > 0 ? (td.tokens / totalTaskTokens) * 100 : 0;
                  return (
                    <div key={type} className="p-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cfg.icon}</span>
                          <span className="text-xs font-medium text-[var(--text-secondary)]">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-[var(--text-tertiary)]">{td.count}次</span>
                          <span className="text-[var(--text-primary)] font-medium">{formatTokens(td.tokens)}</span>
                          <span className="text-emerald-400">{formatCost(td.cost)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(data.month_by_task).length === 0 && (
                <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">本月暂无数据</div>
              )}
            </div>
          )}

          {/* 按模型分布（具体模型名） */}
          {detailTab === 'model' && (
            <div className="space-y-2">
              {Object.entries(data.month_by_model_name || {})
                .sort((a, b) => b[1].tokens - a[1].tokens)
                .map(([name, md]) => {
                  const cfg = modelNameConfig[name] || { short: name, color: 'bg-gray-500', free: false };
                  const typeCfg = modelTypeLabels[md.model_type] || { icon: '⚙️', label: md.model_type };
                  const pct = totalModelNameTokens > 0 ? (md.tokens / totalModelNameTokens) * 100 : 0;
                  return (
                    <div key={name} className="p-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">{typeCfg.icon}</span>
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{cfg.short}</span>
                          {cfg.free && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/15 text-emerald-400 rounded-full font-medium flex-shrink-0">免费</span>
                          )}
                          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[10px] flex-shrink-0">
                          <span className="text-[var(--text-tertiary)]">{md.count}次</span>
                          <span className="text-[var(--text-primary)] font-medium">{formatTokens(md.tokens)}</span>
                        </div>
                      </div>
                      {/* prompt / completion 拆分条 */}
                      <div className="flex gap-0.5 mb-1">
                        <div
                          className="h-1.5 rounded-l-full bg-blue-400/70 transition-all"
                          style={{ width: md.tokens > 0 ? `${(md.prompt_tokens / md.tokens) * 100}%` : '0%' }}
                          title={`输入 ${formatTokens(md.prompt_tokens)}`}
                        />
                        <div
                          className="h-1.5 rounded-r-full bg-emerald-400/70 transition-all"
                          style={{ width: md.tokens > 0 ? `${(md.completion_tokens / md.tokens) * 100}%` : '0%' }}
                          title={`输出 ${formatTokens(md.completion_tokens)}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px]">
                        <span>
                          <span className="text-blue-400">入 {formatTokens(md.prompt_tokens)}</span>
                          {' / '}
                          <span className="text-emerald-400">出 {formatTokens(md.completion_tokens)}</span>
                        </span>
                        <span className="text-emerald-400 font-medium">{md.cost > 0 ? formatCost(md.cost) : '免费'}</span>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(data.month_by_model_name || {}).length === 0 && (
                <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">本月暂无数据</div>
              )}

              {/* 成本汇总 */}
              {Object.keys(data.month_by_model_name || {}).length > 0 && (
                <div className="p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-2 font-medium">本月成本汇总</div>
                  <div className="space-y-1.5">
                    {Object.entries(data.month_by_model_name || {})
                      .filter(([, md]) => md.cost > 0)
                      .sort((a, b) => b[1].cost - a[1].cost)
                      .map(([name, md]) => {
                        const cfg = modelNameConfig[name] || { short: name, color: 'bg-gray-500', free: false };
                        return (
                          <div key={name} className="flex justify-between items-center">
                            <span className="text-xs text-[var(--text-secondary)]">{cfg.short}</span>
                            <span className="text-xs text-emerald-400 font-medium">{formatCost(md.cost)}</span>
                          </div>
                        );
                      })}
                    {Object.values(data.month_by_model_name || {}).some(m => m.cost === 0) && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">免费模型合计</span>
                        <span className="text-xs text-emerald-400 font-medium">¥0</span>
                      </div>
                    )}
                    <div className="pt-1.5 mt-1 border-t border-[var(--border)] flex justify-between items-center">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">总计</span>
                      <span className="text-xs font-bold text-emerald-400">{formatCost(data.month.cost)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 最近记录 */}
          {detailTab === 'recent' && (
            <div className="space-y-1">
              {data.recent.length > 0 ? (
                <>
                  {data.recent.map(r => {
                    const taskCfg = taskTypeLabels[r.task_type] || { icon: '⚙️', label: r.task };
                    const mCfg = modelNameConfig[r.model] || { short: r.model, color: 'bg-gray-500', free: false };
                    return (
                      <div key={r.id} className="p-2.5 rounded-xl hover:bg-[var(--glass-bg)] border border-transparent hover:border-[var(--border)] transition-all">
                        {/* 第一行：任务 + 模型 + 时间 */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs flex-shrink-0">{taskCfg.icon}</span>
                            <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{taskCfg.label}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">{r.time}</span>
                        </div>
                        {/* 第二行：模型名 + token + 成本 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${mCfg.color} flex-shrink-0`} />
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">{mCfg.short}</span>
                            {mCfg.free && <span className="text-[8px] text-emerald-400">FREE</span>}
                          </div>
                          <div className="flex items-center gap-2.5 text-[10px]">
                            <span>
                              <span className="text-blue-400">{formatTokens(r.prompt_tokens)}</span>
                              <span className="text-[var(--text-tertiary)]"> + </span>
                              <span className="text-emerald-400">{formatTokens(r.completion_tokens)}</span>
                              <span className="text-[var(--text-tertiary)]"> = </span>
                              <span className="text-[var(--text-primary)] font-medium">{formatTokens(r.total_tokens)}</span>
                            </span>
                            <span className="text-emerald-400 font-medium w-10 text-right">{r.cost > 0 ? formatCost(r.cost) : '免费'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">暂无记录</div>
              )}
            </div>
          )}

          {/* 提示 */}
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/15">
            <div className="text-[10px] text-indigo-300 flex items-start gap-1.5">
              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>免费模型（Flash）处理简单任务，付费模型处理复杂分析。<span className="text-blue-400">蓝色</span>=输入 <span className="text-emerald-400">绿色</span>=输出</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
