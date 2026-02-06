'use client';

import { useState } from 'react';
import { Beaker, Zap, Moon, Coffee, Monitor, Play } from 'lucide-react';

interface SimulationResult {
  scenario: Record<string, unknown>;
  predicted_score: number;
  adjustments: Array<{
    factor: string;
    impact: number;
    reason: string;
  }>;
  recommendations: string[];
}

interface Props {
  className?: string;
}

export default function WhatIfSimulator({ className = '' }: Props) {
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [exerciseMinutes, setExerciseMinutes] = useState<number>(30);
  const [caffeineAfter2pm, setCaffeineAfter2pm] = useState<boolean>(false);
  const [screenHours, setScreenHours] = useState<number>(6);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
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
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Failed to run simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Beaker className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">What-if 模拟</h3>
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        {/* Sleep */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-[var(--text-secondary)]">睡眠时长</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {sleepHours} 小时
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="12"
            step="0.5"
            value={sleepHours}
            onChange={(e) => setSleepHours(Number(e.target.value))}
            className="w-full h-2 bg-[var(--glass-bg)] rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* Exercise */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-[var(--text-secondary)]">运动时长</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {exerciseMinutes} 分钟
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="10"
            value={exerciseMinutes}
            onChange={(e) => setExerciseMinutes(Number(e.target.value))}
            className="w-full h-2 bg-[var(--glass-bg)] rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* Caffeine */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-[var(--text-secondary)]">下午咖啡因</span>
            </div>
            <button
              onClick={() => setCaffeineAfter2pm(!caffeineAfter2pm)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                caffeineAfter2pm ? 'bg-amber-500' : 'bg-[var(--glass-bg)] border border-[var(--border)]'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  caffeineAfter2pm ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Screen Time */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-[var(--text-secondary)]">屏幕时间</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {screenHours} 小时
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={screenHours}
            onChange={(e) => setScreenHours(Number(e.target.value))}
            className="w-full h-2 bg-[var(--glass-bg)] rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={runSimulation}
        disabled={loading}
        className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-medium hover:border-cyan-500/30 transition-all flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        {loading ? '模拟中...' : '运行模拟'}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-6 pt-6 border-t border-[var(--border)]">
          <div className="text-center mb-4">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">预测 Vibe Score</div>
            <div
              className={`text-4xl font-bold ${
                result.predicted_score >= 70
                  ? 'text-emerald-400'
                  : result.predicted_score >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {result.predicted_score}
            </div>
          </div>

          {/* Adjustments */}
          <div className="space-y-2">
            {result.adjustments.map((adj, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--text-tertiary)]">{adj.factor}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">{adj.reason}</span>
                  <span
                    className={
                      adj.impact > 0
                        ? 'text-emerald-400'
                        : adj.impact < 0
                        ? 'text-red-400'
                        : 'text-[var(--text-tertiary)]'
                    }
                  >
                    {adj.impact > 0 ? '+' : ''}
                    {adj.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="text-xs text-[var(--text-tertiary)] mb-2">优化建议</div>
              <ul className="space-y-1">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-[var(--text-secondary)] flex gap-2">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #8b5cf6);
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #8b5cf6);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
