'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, Clock, Activity } from 'lucide-react';

interface Anomaly {
  type: string;
  date?: string;
  value: number;
  expected?: number;
  deviation?: number;
  severity: number;
  description: string;
  percentage?: number;
}

interface AnomalyData {
  period_days: number;
  total_records: number;
  anomaly_count: number;
  anomalies: Anomaly[];
  message?: string;
}

interface Props {
  className?: string;
}

const anomalyIcons: Record<string, React.ReactNode> = {
  score_deviation: <TrendingDown className="w-4 h-4" />,
  late_night_activity: <Clock className="w-4 h-4" />,
  low_activity: <Activity className="w-4 h-4" />,
};

const anomalyColors: Record<string, string> = {
  score_deviation: 'border-amber-500/30 bg-amber-500/10',
  late_night_activity: 'border-purple-500/30 bg-purple-500/10',
  low_activity: 'border-blue-500/30 bg-blue-500/10',
};

export default function AnomalyDetector({ className = '' }: Props) {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    try {
      const res = await fetch('/api/predict/anomalies?days=30');
      if (res.ok) {
        const anomalyData = await res.json();
        setData(anomalyData);
      }
    } catch (error) {
      console.error('Failed to fetch anomalies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white/90">异常检测</h3>
        </div>
        {data && (
          <span className="text-xs text-white/40">
            最近 {data.period_days} 天
          </span>
        )}
      </div>

      {data?.message ? (
        <p className="text-white/50 text-center py-4">{data.message}</p>
      ) : data?.anomalies && data.anomalies.length > 0 ? (
        <div className="space-y-3">
          {data.anomalies.slice(0, 5).map((anomaly, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                anomalyColors[anomaly.type] || 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-white/60 mt-0.5">
                  {anomalyIcons[anomaly.type] || (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white/80">
                    {anomaly.description}
                  </div>
                  {anomaly.date && (
                    <div className="text-xs text-white/40 mt-1">
                      {anomaly.date}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(anomaly.severity, 3) }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-amber-400"
                      />
                    )
                  )}
                  {Array.from({
                    length: Math.max(0, 3 - Math.min(anomaly.severity, 3)),
                  }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-white/10"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-white/70">一切正常</p>
          <p className="text-xs text-white/40 mt-1">
            未检测到异常模式
          </p>
        </div>
      )}

      {data && data.anomaly_count > 5 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-white/40">
            还有 {data.anomaly_count - 5} 个异常
          </span>
        </div>
      )}
    </div>
  );
}
