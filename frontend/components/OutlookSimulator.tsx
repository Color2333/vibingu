'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Moon,
  Zap,
  Coffee,
  Monitor,
  Play,
  RefreshCw,
} from 'lucide-react';

/* ---------- Prediction types ---------- */
interface PredictionData {
  predicted_date: string;
  predicted_score: number;
  confidence: string;
  base_score: number;
  adjustments: { trend: number; today_factors: number };
  factors: Array<{ type: string; status: string; impact: string }>;
  historical_reference: { weekday: string; avg_score: number; sample_size: number };
  recent_trend: { direction: string; strength: number };
}

/* ---------- Simulation types ---------- */
interface SimulationResult {
  scenario: Record<string, unknown>;
  predicted_score: number;
  adjustments: Array<{ factor: string; impact: number; reason: string }>;
  recommendations: string[];
}

const confidenceLabels: Record<string, string> = { high: '高置信度', medium: '中置信度', low: '低置信度' };
const confidenceColors: Record<string, string> = { high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-rose-400' };

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

function factorLabel(type: string) {
  const map: Record<string, string> = { sleep: '睡眠', exercise: '运动', caffeine: '咖啡因', screen: '屏幕', diet: '饮食', mood: '心情' };
  return map[type] || type;
}

export default function OutlookSimulator({ className = '' }: { className?: string }) {
  /* ---------- Prediction state ---------- */
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [predLoading, setPredLoading] = useState(true);

  /* ---------- Simulator state ---------- */
  const [simOpen, setSimOpen] = useState(false);
  const [sleepHours, setSleepHours] = useState(7);
  const [exerciseMinutes, setExerciseMinutes] = useState(30);
  const [caffeineAfter2pm, setCaffeineAfter2pm] = useState(false);
  const [screenHours, setScreenHours] = useState(6);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fetchPrediction = useCallback(async () => {
    setPredLoading(true);
    try {
      const res = await fetch('/api/predict/tomorrow');
      if (res.ok) setPrediction(await res.json());
    } catch { /* ignore */ } finally {
      setPredLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrediction(); }, [fetchPrediction]);

  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await fetch('/api/predict/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleep_hours: sleepHours,
          exercise_minutes: exerciseMinutes,
          caffeine_after_2pm: caffeineAfter2pm,
          screen_hours: screenHours,
        }),
      });
      if (res.ok) setSimResult(await res.json());
    } catch { /* ignore */ } finally {
      setSimLoading(false);
    }
  };

  /* ---------- Loading ---------- */
  if (predLoading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--glass-bg)] rounded w-1/3 mb-4" />
          <div className="h-24 bg-[var(--glass-bg)] rounded" />
        </div>
      </div>
    );
  }

  /* ---------- No data ---------- */
  if (!prediction) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <Header />
        <p className="text-[var(--text-tertiary)] text-center py-6">数据不足，暂时无法预测</p>
      </div>
    );
  }

  const trendDir = prediction.recent_trend.direction;
  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus;
  const trendColor = trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-rose-400' : 'text-[var(--text-tertiary)]';
  const trendText = trendDir === 'up' ? '上升趋势' : trendDir === 'down' ? '下降趋势' : '稳定';

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">明日展望</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${confidenceColors[prediction.confidence] || 'text-[var(--text-tertiary)]'}`}>
            {confidenceLabels[prediction.confidence] || prediction.confidence}
          </span>
          <button
            onClick={fetchPrediction}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
            aria-label="刷新预测"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prediction Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <div className={`text-4xl font-bold ${scoreColor(prediction.predicted_score)}`}>
              {prediction.predicted_score}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">预测分数</div>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            <span className={`text-sm ${trendColor}`}>{trendText}</span>
          </div>
        </div>
        <div className="text-right text-xs text-[var(--text-tertiary)]">
          <div>{prediction.historical_reference.weekday}</div>
          <div>历史均值 {prediction.historical_reference.avg_score}</div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="p-2 rounded-lg bg-[var(--glass-bg)] text-center">
          <div className="text-[var(--text-tertiary)]">基准</div>
          <div className="font-medium text-[var(--text-primary)]">{prediction.base_score}</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--glass-bg)] text-center">
          <div className="text-[var(--text-tertiary)]">趋势</div>
          <div className={`font-medium ${prediction.adjustments.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {prediction.adjustments.trend > 0 ? '+' : ''}{prediction.adjustments.trend}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--glass-bg)] text-center">
          <div className="text-[var(--text-tertiary)]">今日因素</div>
          <div className={`font-medium ${prediction.adjustments.today_factors >= 0 ? 'text-emerald-400' : prediction.adjustments.today_factors < 0 ? 'text-rose-400' : 'text-[var(--text-tertiary)]'}`}>
            {prediction.adjustments.today_factors > 0 ? '+' : ''}{prediction.adjustments.today_factors}
          </div>
        </div>
      </div>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {prediction.factors.map((f, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-full text-xs ${
                f.impact === 'positive' ? 'bg-emerald-500/10 text-emerald-400'
                : f.impact === 'negative' ? 'bg-rose-500/10 text-rose-400'
                : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)]'
              }`}
            >
              {factorLabel(f.type)}
            </span>
          ))}
        </div>
      )}

      {/* What-If Simulator (collapsible) */}
      <div className="border-t border-[var(--border)] pt-3">
        <button
          onClick={() => setSimOpen(!simOpen)}
          className="w-full flex items-center justify-between py-1 hover:bg-[var(--glass-bg)] rounded-lg transition-colors -mx-2 px-2"
        >
          <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
            🧪 What-If 模拟
          </span>
          <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${simOpen ? 'rotate-180' : ''}`} />
        </button>

        {simOpen && (
          <div className="mt-3 space-y-4">
            {/* Sliders */}
            <SliderRow
              icon={<Moon className="w-4 h-4 text-indigo-400" />}
              label="睡眠时长"
              value={sleepHours}
              unit="小时"
              min={4} max={12} step={0.5}
              onChange={setSleepHours}
            />
            <SliderRow
              icon={<Zap className="w-4 h-4 text-emerald-400" />}
              label="运动时长"
              value={exerciseMinutes}
              unit="分钟"
              min={0} max={120} step={10}
              onChange={setExerciseMinutes}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-[var(--text-secondary)]">下午咖啡因</span>
              </div>
              <button
                onClick={() => setCaffeineAfter2pm(!caffeineAfter2pm)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  caffeineAfter2pm ? 'bg-amber-500' : 'bg-[var(--glass-bg)] border border-[var(--border)]'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${caffeineAfter2pm ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <SliderRow
              icon={<Monitor className="w-4 h-4 text-blue-400" />}
              label="屏幕时间"
              value={screenHours}
              unit="小时"
              min={0} max={12} step={1}
              onChange={setScreenHours}
            />

            {/* Run button */}
            <button
              onClick={runSimulation}
              disabled={simLoading}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-[var(--border)] rounded-xl text-[var(--text-primary)] text-sm font-medium hover:border-cyan-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {simLoading ? '模拟中...' : '运行模拟'}
            </button>

            {/* Result */}
            {simResult && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-[var(--border)]">
                <div className="text-center mb-3">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">模拟 Vibe Score</div>
                  <div className={`text-3xl font-bold ${scoreColor(simResult.predicted_score)}`}>
                    {simResult.predicted_score}
                  </div>
                </div>
                {simResult.adjustments.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {simResult.adjustments.map((adj, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-tertiary)]">{adj.factor}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-tertiary)]">{adj.reason}</span>
                          <span className={adj.impact > 0 ? 'text-emerald-400' : adj.impact < 0 ? 'text-rose-400' : 'text-[var(--text-tertiary)]'}>
                            {adj.impact > 0 ? '+' : ''}{adj.impact}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {simResult.recommendations && simResult.recommendations.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <div className="text-[10px] text-[var(--text-tertiary)] mb-1.5">优化建议</div>
                    {simResult.recommendations.map((rec, idx) => (
                      <p key={idx} className="text-xs text-[var(--text-secondary)] flex gap-1.5 mb-1">
                        <span>•</span><span>{rec}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Slider thumb styling */}
            <style jsx>{`
              :global(.sim-slider::-webkit-slider-thumb) {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #06b6d4, #8b5cf6);
                cursor: pointer;
              }
              :global(.sim-slider::-moz-range-thumb) {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #06b6d4, #8b5cf6);
                cursor: pointer;
                border: none;
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function Header() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
        <Sparkles className="w-4 h-4 text-cyan-400" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">明日展望</h3>
    </div>
  );
}

function SliderRow({
  icon, label, value, unit, min, max, step, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sim-slider w-full h-1.5 bg-[var(--glass-bg)] rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
