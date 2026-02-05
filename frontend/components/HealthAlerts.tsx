'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Info, AlertTriangle, X, Heart } from 'lucide-react';

interface HealthAlert {
  type: string;
  level: 'info' | 'warning' | 'error';
  icon: string;
  title: string;
  message: string;
  suggestion: string;
}

interface Props {
  className?: string;
}

const levelStyles = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Info,
    iconColor: 'text-blue-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: AlertCircle,
    iconColor: 'text-red-400',
  },
};

export default function HealthAlerts({ className = '' }: Props) {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/predict/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch health alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (type: string) => {
    setDismissed((prev) => new Set(prev).add(type));
  };

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.type));

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white/90">健康提醒</h3>
        </div>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-white/70">一切正常</p>
          <p className="text-xs text-white/40 mt-1">
            保持良好的生活习惯
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-400" />
          <h3 className="text-lg font-semibold text-white/90">健康提醒</h3>
        </div>
        <span className="text-xs text-white/40">
          {visibleAlerts.length} 条提醒
        </span>
      </div>

      <div className="space-y-3">
        {visibleAlerts.map((alert) => {
          const style = levelStyles[alert.level] || levelStyles.info;
          const IconComponent = style.icon;

          return (
            <div
              key={alert.type}
              className={`relative p-4 rounded-xl border ${style.bg} ${style.border}`}
            >
              <button
                onClick={() => dismissAlert(alert.type)}
                className="absolute top-2 right-2 p-1 text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-xl">{alert.icon}</span>
                </div>
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <IconComponent className={`w-4 h-4 ${style.iconColor}`} />
                    <span className="font-medium text-white/90">
                      {alert.title}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mb-2">{alert.message}</p>
                  <p className="text-xs text-white/40 bg-white/5 rounded-lg px-3 py-2">
                    💡 {alert.suggestion}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
