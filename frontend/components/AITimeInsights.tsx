'use client';

import { useEffect, useState } from 'react';
import { 
  Clock, 
  Sparkles, 
  TrendingUp, 
  Heart, 
  Bell,
  Sun,
  Moon,
  Zap,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

interface TimeInsights {
  has_data: boolean;
  message?: string;
  data_summary?: {
    period_days: number;
    total_records: number;
    chronotype: string;
    peak_hours: number[];
    best_day?: { day: string; score: number };
    worst_day?: { day: string; score: number };
  };
  ai_insights?: {
    pattern_summary: string;
    key_insights: string[];
    efficiency_tips: string[];
    health_suggestions: string[];
    optimal_schedule: {
      focus_work: string;
      creative_work: string;
      exercise: string;
      rest: string;
    };
    smart_reminders: Array<{ time: string; message: string }>;
  };
  chronotype_info?: {
    name: string;
    description: string;
    emoji: string;
  };
  basic_recommendations?: string[];
}

interface SmartReminder {
  time: string;
  type: string;
  message: string;
  icon: string;
}

export default function AITimeInsights() {
  const [insights, setInsights] = useState<TimeInsights | null>(null);
  const [reminders, setReminders] = useState<SmartReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'schedule' | 'reminders'>('insights');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [insightsRes, remindersRes] = await Promise.all([
        fetch('/api/time/ai-insights?days=30'),
        fetch('/api/time/smart-reminders'),
      ]);

      if (insightsRes.ok) {
        setInsights(await insightsRes.json());
      }
      if (remindersRes.ok) {
        setReminders(await remindersRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch time insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3"></div>
          <div className="h-20 bg-[var(--glass-bg)] rounded-xl"></div>
          <div className="h-32 bg-[var(--glass-bg)] rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!insights?.has_data) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-500/20">
            <Clock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">时间智能分析</h3>
            <p className="text-xs text-[var(--text-tertiary)]">AI 驱动的时间模式洞察</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[var(--glass-bg)] text-center">
          <p className="text-[var(--text-secondary)] text-sm">{insights?.message || '数据不足，继续记录以获得个性化分析'}</p>
        </div>
      </div>
    );
  }

  const { data_summary, ai_insights, chronotype_info, basic_recommendations } = insights;

  return (
    <div className="glass-card p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">时间智能分析</h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              基于 {data_summary?.total_records || 0} 条记录的 AI 深度分析
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-[var(--text-tertiary)]" />
        </button>
      </div>

      {/* 生物钟类型卡片 */}
      {chronotype_info && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{chronotype_info.emoji}</span>
            <div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                {chronotype_info.name}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                {chronotype_info.description}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'insights', label: '洞察', icon: Zap },
          { id: 'schedule', label: '最佳时间', icon: Clock },
          { id: 'reminders', label: '智能提醒', icon: Bell },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === id
                ? 'bg-violet-500/20 text-violet-600 dark:text-violet-300'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* 洞察内容 */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          {/* AI 模式总结 */}
          {ai_insights?.pattern_summary && (
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">AI 分析总结</span>
              </div>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {ai_insights.pattern_summary}
              </p>
            </div>
          )}

          {/* 关键洞察 */}
          {ai_insights?.key_insights && ai_insights.key_insights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">关键发现</span>
              </div>
              <div className="space-y-2">
                {ai_insights.key_insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-3 rounded-lg bg-[var(--glass-bg)]"
                  >
                    <ChevronRight className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[var(--text-secondary)]">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 效率建议 */}
          {ai_insights?.efficiency_tips && ai_insights.efficiency_tips.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">效率提升</span>
              </div>
              <div className="grid gap-2">
                {ai_insights.efficiency_tips.map((tip, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-200"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 健康建议 */}
          {ai_insights?.health_suggestions && ai_insights.health_suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">健康建议</span>
              </div>
              <div className="grid gap-2">
                {ai_insights.health_suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-200"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 基础建议（如果没有 AI 建议） */}
          {!ai_insights && basic_recommendations && basic_recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">建议</span>
              </div>
              <div className="space-y-2">
                {basic_recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[var(--glass-bg)] text-sm text-[var(--text-secondary)]"
                  >
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 最佳时间安排 */}
      {activeTab === 'schedule' && ai_insights?.optimal_schedule && (
        <div className="space-y-3">
          {[
            { key: 'focus_work', label: '专注工作', icon: '🎯', cls: 'bg-violet-500/10 border-violet-500/20' },
            { key: 'creative_work', label: '创意工作', icon: '💡', cls: 'bg-amber-500/10 border-amber-500/20' },
            { key: 'exercise', label: '运动锻炼', icon: '🏃', cls: 'bg-green-500/10 border-green-500/20' },
            { key: 'rest', label: '休息放松', icon: '😴', cls: 'bg-blue-500/10 border-blue-500/20' },
          ].map(({ key, label, icon, cls }) => (
            <div
              key={key}
              className={`flex items-center justify-between p-4 rounded-xl border ${cls}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {ai_insights.optimal_schedule[key as keyof typeof ai_insights.optimal_schedule]}
              </span>
            </div>
          ))}

          {/* 高峰时段 */}
          {data_summary?.peak_hours && data_summary.peak_hours.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--glass-bg)]">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">活跃高峰时段</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data_summary.peak_hours.map((hour) => (
                  <span
                    key={hour}
                    className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-sm"
                  >
                    {hour}:00
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 周模式 */}
          {data_summary?.best_day && data_summary?.worst_day && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">最佳状态日</div>
                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                  {data_summary.best_day.day}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  平均得分 {data_summary.best_day.score}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">需要注意日</div>
                <div className="text-lg font-semibold text-rose-600 dark:text-rose-300">
                  {data_summary.worst_day.day}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  平均得分 {data_summary.worst_day.score}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 智能提醒 */}
      {activeTab === 'reminders' && (
        <div className="space-y-3">
          {reminders.length > 0 ? (
            reminders.map((reminder, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="text-2xl">{reminder.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {reminder.time}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--glass-bg)] text-[var(--text-tertiary)]">
                      {reminder.type === 'focus' ? '专注' : 
                       reminder.type === 'rest' ? '休息' :
                       reminder.type === 'peak' ? '高峰' :
                       reminder.type === 'wind_down' ? '放松' : '提醒'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{reminder.message}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl bg-[var(--glass-bg)] text-center">
              <Moon className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-tertiary)]">暂无智能提醒</p>
            </div>
          )}

          {/* AI 提醒（如果有） */}
          {ai_insights?.smart_reminders && ai_insights.smart_reminders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">AI 个性化提醒</span>
              </div>
              {ai_insights.smart_reminders.map((reminder, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-2"
                >
                  <Bell className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-600 dark:text-violet-200 font-medium">{reminder.time}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{reminder.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
