'use client';

import { useState, useEffect } from 'react';
import { Moon, Coffee, Smartphone, Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface VibeData {
  date: string;
  vibe_score: number | null;
  sleep_score: number | null;
  diet_score: number | null;
  screen_score: number | null;
  activity_score: number | null;
  insights: string[];
  record_count: number;
}

interface TrendData {
  date: string;
  vibe_score: number | null;
}

interface WeeklyReport {
  average_vibe_score: number | null;
  total_records: number;
  insights: string[];
}

export default function PublicPage() {
  const [vibeData, setVibeData] = useState<VibeData | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vibeRes, trendRes, weeklyRes] = await Promise.all([
          fetch('/api/analytics/vibe/today'),
          fetch('/api/analytics/trend?days=14'),
          fetch('/api/reports/weekly'),
        ]);

        if (vibeRes.ok) setVibeData(await vibeRes.json());
        if (trendRes.ok) setTrendData(await trendRes.json());
        if (weeklyRes.ok) setWeeklyReport(await weeklyRes.json());
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-white/30';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/30 animate-pulse">Loading...</div>
      </div>
    );
  }

  const vibeScore = vibeData?.vibe_score ?? null;

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <Link href="/" className="p-2 text-white/30 hover:text-white/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">Live</p>
          </div>
          <div className="w-9" />
        </header>

        {/* Main Score */}
        <section className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-4">
            Hao&apos;s Vibe
          </p>
          <div className="relative inline-block">
            <span className={`text-8xl md:text-9xl font-extralight number-display ${getScoreClass(vibeScore)}`}>
              {vibeScore !== null ? vibeScore : '—'}
            </span>
            {vibeScore !== null && vibeScore >= 60 && (
              <div className="absolute -inset-8 bg-current opacity-10 blur-[60px] rounded-full -z-10" />
            )}
          </div>
          <p className="mt-4 text-sm text-white/40">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </section>

        {/* Dimensions */}
        <section className="glass rounded-3xl p-6 mb-6">
          <div className="grid grid-cols-4 gap-4">
            <DimensionItem icon={<Moon className="w-4 h-4" />} label="睡眠" score={vibeData?.sleep_score ?? null} />
            <DimensionItem icon={<Coffee className="w-4 h-4" />} label="饮食" score={vibeData?.diet_score ?? null} />
            <DimensionItem icon={<Smartphone className="w-4 h-4" />} label="屏幕" score={vibeData?.screen_score ?? null} />
            <DimensionItem icon={<Zap className="w-4 h-4" />} label="活动" score={vibeData?.activity_score ?? null} />
          </div>
        </section>

        {/* Trend */}
        <section className="glass rounded-3xl p-6 mb-6">
          <p className="text-xs uppercase tracking-[0.15em] text-white/30 mb-4">14 Day Trend</p>
          <TrendChart data={trendData} />
        </section>

        {/* Weekly Summary */}
        {weeklyReport && (
          <section className="glass rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-white/30 mb-4">This Week</p>
            <div className="flex justify-between items-center mb-4">
              <span className="text-white/50 text-sm">平均</span>
              <span className={`text-2xl font-light ${getScoreClass(weeklyReport.average_vibe_score)}`}>
                {weeklyReport.average_vibe_score ?? '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">记录</span>
              <span className="text-lg text-white/70">{weeklyReport.total_records}</span>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20">
            Powered by vibing u
          </p>
        </footer>
      </div>
    </div>
  );
}

function DimensionItem({ icon, label, score }: { icon: React.ReactNode; label: string; score: number | null }) {
  const getScoreClass = (score: number | null) => {
    if (score === null) return 'text-white/30';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="text-center">
      <div className="text-white/30 flex justify-center mb-2">{icon}</div>
      <p className={`text-lg font-light number-display ${getScoreClass(score)}`}>
        {score !== null ? score : '—'}
      </p>
      <p className="text-[10px] text-white/30 mt-1">{label}</p>
    </div>
  );
}

function TrendChart({ data }: { data: TrendData[] }) {
  const validData = data.filter(d => d.vibe_score !== null);
  if (validData.length === 0) {
    return <p className="text-center text-white/20 text-sm py-6">No data</p>;
  }

  const maxScore = Math.max(...validData.map(d => d.vibe_score!));
  const minScore = Math.min(...validData.map(d => d.vibe_score!));
  const range = Math.max(maxScore - minScore, 20);

  return (
    <div>
      <svg viewBox="0 0 100 32" className="w-full h-20">
        <defs>
          <linearGradient id="pubLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="pubAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area */}
        <path d={generateAreaPath(data, minScore, range)} fill="url(#pubAreaGrad)" />
        
        {/* Line */}
        <path
          d={generateLinePath(data, minScore, range)}
          fill="none"
          stroke="url(#pubLineGrad)"
          strokeWidth="0.6"
          strokeLinecap="round"
        />

        {/* Points */}
        {data.map((d, i) => {
          if (d.vibe_score === null) return null;
          const x = (i / (data.length - 1)) * 100;
          const y = 30 - ((d.vibe_score - minScore + 10) / (range + 20)) * 28;
          return <circle key={i} cx={x} cy={y} r="1" fill="#fff" />;
        })}
      </svg>

      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function generateLinePath(data: TrendData[], minScore: number, range: number): string {
  const points = data
    .map((d, i) => {
      if (d.vibe_score === null) return null;
      const x = (i / (data.length - 1)) * 100;
      const y = 30 - ((d.vibe_score - minScore + 10) / (range + 20)) * 28;
      return { x, y };
    })
    .filter(Boolean) as { x: number; y: number }[];

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function generateAreaPath(data: TrendData[], minScore: number, range: number): string {
  const linePath = generateLinePath(data, minScore, range);
  if (!linePath) return '';

  const points = data
    .map((d, i) => d.vibe_score !== null ? (i / (data.length - 1)) * 100 : null)
    .filter(Boolean) as number[];

  if (points.length === 0) return '';

  return `${linePath} L ${points[points.length - 1]} 32 L ${points[0]} 32 Z`;
}
