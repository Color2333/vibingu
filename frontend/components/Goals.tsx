'use client';

import { useState, useEffect } from 'react';
import { Target, Moon, Zap, Check, ChevronDown } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  icon: React.ReactNode;
  target: number;
  current: number;
  unit: string;
  color: string;
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // 从 localStorage 加载目标
    const saved = localStorage.getItem('vibingu_goals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGoals(parsed);
      } catch {}
    } else {
      // 默认目标
      setGoals([
        { id: 'sleep', name: '睡眠', icon: <Moon className="w-4 h-4" />, target: 8, current: 0, unit: '小时', color: 'text-indigo-400' },
        { id: 'activity', name: '运动', icon: <Zap className="w-4 h-4" />, target: 3, current: 0, unit: '次/周', color: 'text-green-400' },
      ]);
    }

    // 从 API 获取本周数据更新进度
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/reports/weekly');
      if (res.ok) {
        const data = await res.json();
        setGoals(prev => prev.map(g => {
          if (g.id === 'activity') {
            return { ...g, current: data.category_breakdown?.ACTIVITY || 0 };
          }
          return g;
        }));
      }
    } catch {}
  };

  const updateGoal = (id: string, target: number) => {
    const updated = goals.map(g => g.id === id ? { ...g, target } : g);
    setGoals(updated);
    localStorage.setItem('vibingu_goals', JSON.stringify(updated));
  };

  const completedCount = goals.filter(g => g.current >= g.target).length;

  return (
    <div className="glass rounded-3xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--glass-bg)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm text-[var(--text-secondary)]">目标</span>
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              <Check className="w-3 h-3" />
              {completedCount}/{goals.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-3">
          {goals.map(goal => (
            <GoalItem 
              key={goal.id} 
              goal={goal} 
              onUpdate={(target) => updateGoal(goal.id, target)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalItem({ goal, onUpdate }: { goal: Goal; onUpdate: (target: number) => void }) {
  const progress = Math.min((goal.current / goal.target) * 100, 100);
  const isCompleted = goal.current >= goal.target;

  return (
    <div className={`p-4 rounded-xl ${isCompleted ? 'bg-green-500/10' : 'glass-subtle'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={goal.color}>{goal.icon}</span>
          <span className="text-sm text-[var(--text-secondary)]">{goal.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-light ${isCompleted ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
            {goal.current}
          </span>
          <span className="text-[var(--text-tertiary)]">/</span>
          <input
            type="number"
            value={goal.target}
            onChange={(e) => onUpdate(Number(e.target.value))}
            className="w-12 bg-transparent text-[var(--text-tertiary)] text-lg font-light text-center outline-none"
            min={1}
          />
          <span className="text-xs text-[var(--text-tertiary)]">{goal.unit}</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1 bg-[var(--glass-bg)] rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-400' : 'bg-[#6366f1]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
