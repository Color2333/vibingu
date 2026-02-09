'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Share2, Download, X, Star, Flame } from 'lucide-react';

interface VibeData {
  vibeScore: number | null;
  sleepScore: number | null;
  dietScore: number | null;
  screenScore: number | null;
  activityScore: number | null;
  streak: number;
}

interface LevelData {
  current_level: number;
  level_title: string;
}

interface DimensionData {
  body: number | null;
  mood: number | null;
  social: number | null;
  work: number | null;
  growth: number | null;
  meaning: number | null;
  digital: number | null;
  leisure: number | null;
}

export default function ShareCard() {
  const [showModal, setShowModal] = useState(false);
  const [vibeData, setVibeData] = useState<VibeData>({
    vibeScore: null,
    sleepScore: null,
    dietScore: null,
    screenScore: null,
    activityScore: null,
    streak: 0
  });
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [dimensions, setDimensions] = useState<DimensionData | null>(null);
  const [cardStyle, setCardStyle] = useState<'classic' | 'radar' | 'minimal'>('classic');
  const cardRef = useRef<HTMLDivElement>(null);

  // 获取今日 Vibe 数据
  const fetchVibeData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/vibe/today');
      if (res.ok) {
        const data = await res.json();
        setVibeData({
          vibeScore: data.vibe_index,
          sleepScore: data.sleep_score,
          dietScore: data.diet_score,
          screenScore: data.screen_score,
          activityScore: data.activity_score,
          streak: data.streak || 0
        });
      }
    } catch (e) {
      console.error('Failed to fetch vibe data:', e);
    }
  }, []);

  useEffect(() => {
    if (showModal) {
      fetchVibeData();
      fetchLevelData();
      fetchDimensions();
    }
  }, [showModal, fetchVibeData]);

  // 解构 vibeData 用于渲染
  const { vibeScore, sleepScore, dietScore, screenScore, activityScore, streak } = vibeData;

  const fetchLevelData = async () => {
    try {
      const res = await fetch('/api/gamification/level');
      if (res.ok) {
        const data = await res.json();
        setLevelData(data);
      }
    } catch (e) {
      console.error('Failed to fetch level:', e);
    }
  };

  const fetchDimensions = async () => {
    try {
      const res = await fetch('/api/analytics/dimensions/today');
      if (res.ok) {
        const data = await res.json();
        // API 返回 { body: { score: 50, ... }, mood: { score: 60, ... }, ... }
        // 需要提取每个维度的 score 数字
        const raw = data.dimensions;
        if (raw) {
          setDimensions({
            body: typeof raw.body === 'number' ? raw.body : (raw.body?.score ?? null),
            mood: typeof raw.mood === 'number' ? raw.mood : (raw.mood?.score ?? null),
            social: typeof raw.social === 'number' ? raw.social : (raw.social?.score ?? null),
            work: typeof raw.work === 'number' ? raw.work : (raw.work?.score ?? null),
            growth: typeof raw.growth === 'number' ? raw.growth : (raw.growth?.score ?? null),
            meaning: typeof raw.meaning === 'number' ? raw.meaning : (raw.meaning?.score ?? null),
            digital: typeof raw.digital === 'number' ? raw.digital : (raw.digital?.score ?? null),
            leisure: typeof raw.leisure === 'number' ? raw.leisure : (raw.leisure?.score ?? null),
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch dimensions:', e);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#666';
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#60a5fa';
    if (score >= 40) return '#fbbf24';
    return '#f87171';
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // 使用 html2canvas（如果已安装）或创建 SVG
      const svg = generateSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibing-u-${new Date().toISOString().split('T')[0]}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  const generateSVG = () => {
    const date = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    const color = getScoreColor(vibeScore);
    const level = levelData?.current_level ?? 1;
    const title = levelData?.level_title ?? '新手记录者';
    const currentStreak = levelData ? (streak || 0) : streak;
    
    if (cardStyle === 'radar' && dimensions) {
      return generateRadarSVG(date, color, level, title, currentStreak);
    }
    
    if (cardStyle === 'minimal') {
      return generateMinimalSVG(date, color, currentStreak);
    }
    
    // Classic style with 8 dimensions
    const dim = dimensions || { body: null, mood: null, social: null, work: null, growth: null, meaning: null, digital: null, leisure: null };
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0a0a0f"/>
            <stop offset="100%" style="stop-color:#1a1a2e"/>
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#6366f1"/>
            <stop offset="100%" style="stop-color:#a855f7"/>
          </linearGradient>
        </defs>
        
        <rect width="400" height="560" fill="url(#bg)" rx="24"/>
        
        <!-- Logo & Level -->
        <text x="200" y="50" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="12" letter-spacing="4">VIBING U</text>
        <text x="200" y="75" text-anchor="middle" fill="#fbbf24" font-family="system-ui" font-size="11">Lv.${level} ${title}</text>
        
        <!-- Date -->
        <text x="200" y="110" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="14">${date}</text>
        
        <!-- Main Score -->
        <text x="200" y="210" text-anchor="middle" fill="${color}" font-family="system-ui" font-size="100" font-weight="200">${vibeScore ?? '—'}</text>
        <text x="200" y="240" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="12">TODAY'S VIBE</text>
        
        <!-- 8 Dimension Grid -->
        <g transform="translate(30, 280)">
          ${['身体', '心情', '社交', '工作'].map((label, i) => {
            const keys = ['body', 'mood', 'social', 'work'] as const;
            const score = dim[keys[i]];
            return `
              <g transform="translate(${i * 85}, 0)">
                <rect width="80" height="55" rx="10" fill="rgba(255,255,255,0.05)"/>
                <text x="40" y="22" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">${label}</text>
                <text x="40" y="42" text-anchor="middle" fill="${getScoreColor(score)}" font-family="system-ui" font-size="18">${score?.toFixed(0) ?? '—'}</text>
              </g>
            `;
          }).join('')}
        </g>
        <g transform="translate(30, 345)">
          ${['成长', '意义', '数字', '休闲'].map((label, i) => {
            const keys = ['growth', 'meaning', 'digital', 'leisure'] as const;
            const score = dim[keys[i]];
            return `
              <g transform="translate(${i * 85}, 0)">
                <rect width="80" height="55" rx="10" fill="rgba(255,255,255,0.05)"/>
                <text x="40" y="22" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">${label}</text>
                <text x="40" y="42" text-anchor="middle" fill="${getScoreColor(score)}" font-family="system-ui" font-size="18">${score?.toFixed(0) ?? '—'}</text>
              </g>
            `;
          }).join('')}
        </g>
        
        <!-- Streak & Level -->
        <g transform="translate(100, 430)">
          <rect width="200" height="50" rx="12" fill="rgba(255,255,255,0.03)"/>
          <text x="50" y="32" text-anchor="middle" fill="#f97316" font-family="system-ui" font-size="16">🔥 ${currentStreak}</text>
          <text x="50" y="45" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="9">连续天数</text>
          <line x1="100" y1="10" x2="100" y2="40" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
          <text x="150" y="32" text-anchor="middle" fill="#fbbf24" font-family="system-ui" font-size="16">⭐ ${level}</text>
          <text x="150" y="45" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="9">等级</text>
        </g>
        
        <!-- Footer -->
        <text x="200" y="520" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="system-ui" font-size="10">Digitize Your Vibe • 数字人生黑匣子</text>
      </svg>
    `;
  };

  const generateRadarSVG = (date: string, color: string, level: number, title: string, currentStreak: number) => {
    const dim = dimensions || { body: 50, mood: 50, social: 50, work: 50, growth: 50, meaning: 50, digital: 50, leisure: 50 };
    const labels = ['身体', '心情', '社交', '工作', '成长', '意义', '数字', '休闲'];
    const values = [dim.body, dim.mood, dim.social, dim.work, dim.growth, dim.meaning, dim.digital, dim.leisure].map(v => v || 50);
    
    // Calculate radar polygon points
    const cx = 200, cy = 220, maxR = 80;
    const points = values.map((v, i) => {
      const angle = (Math.PI * 2 * i / 8) - Math.PI / 2;
      const r = (v / 100) * maxR;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="480" viewBox="0 0 400 480">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0a0a0f"/>
            <stop offset="100%" style="stop-color:#1a1a2e"/>
          </linearGradient>
          <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.3"/>
            <stop offset="100%" style="stop-color:#a855f7;stop-opacity:0.3"/>
          </linearGradient>
        </defs>
        
        <rect width="400" height="480" fill="url(#bg)" rx="24"/>
        
        <text x="200" y="45" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="12" letter-spacing="4">VIBING U</text>
        <text x="200" y="75" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="13">${date} • Lv.${level}</text>
        
        <!-- Radar background circles -->
        ${[20, 40, 60, 80].map(r => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`).join('')}
        
        <!-- Radar data polygon -->
        <polygon points="${points}" fill="url(#radarFill)" stroke="#8b5cf6" stroke-width="2"/>
        
        <!-- Labels -->
        ${labels.map((label, i) => {
          const angle = (Math.PI * 2 * i / 8) - Math.PI / 2;
          const lx = cx + (maxR + 25) * Math.cos(angle);
          const ly = cy + (maxR + 25) * Math.sin(angle);
          return `<text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="10">${label}</text>`;
        }).join('')}
        
        <!-- Center score -->
        <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="${color}" font-family="system-ui" font-size="36" font-weight="300">${vibeScore ?? '—'}</text>
        
        <!-- Streak -->
        <text x="200" y="380" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="12">🔥 连续 ${currentStreak} 天 • ${title}</text>
        
        <text x="200" y="450" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="system-ui" font-size="10">Digitize Your Vibe</text>
      </svg>
    `;
  };

  const generateMinimalSVG = (date: string, color: string, currentStreak: number) => {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0a0a0f"/>
            <stop offset="100%" style="stop-color:#1a1a2e"/>
          </linearGradient>
        </defs>
        
        <rect width="400" height="300" fill="url(#bg)" rx="24"/>
        
        <text x="200" y="60" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="system-ui" font-size="11" letter-spacing="3">VIBING U</text>
        
        <text x="200" y="160" text-anchor="middle" fill="${color}" font-family="system-ui" font-size="80" font-weight="200">${vibeScore ?? '—'}</text>
        
        <text x="200" y="200" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="12">${date}</text>
        
        ${currentStreak > 0 ? `<text x="200" y="240" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="11">🔥 ${currentStreak} 天</text>` : ''}
        
        <text x="200" y="275" text-anchor="middle" fill="rgba(255,255,255,0.15)" font-family="system-ui" font-size="9">Digitize Your Vibe</text>
      </svg>
    `;
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-3 w-full p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]
                   hover:bg-[var(--bg-secondary)] hover:border-[var(--glass-border)] transition-all group text-left"
      >
        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 transition-colors">
          <Share2 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm text-[var(--text-primary)]">生成分享卡片</div>
          <div className="text-xs text-[var(--text-tertiary)]">生成今日状态的精美分享图</div>
        </div>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in">
            {/* Style selector */}
            <div className="flex gap-2 mb-4">
              {[
                { key: 'classic', label: '经典' },
                { key: 'radar', label: '雷达图' },
                { key: 'minimal', label: '极简' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCardStyle(key as typeof cardStyle)}
                  className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                    cardStyle === key
                      ? 'bg-white/10 text-white/90 border border-white/20'
                      : 'bg-white/5 text-white/50 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            {/* Preview Card */}
            <div 
              ref={cardRef}
              className="rounded-3xl p-6 mb-4"
              style={{
                background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
              }}
            >
              <p className="text-center text-white/30 text-[10px] tracking-[0.3em] mb-2">VIBING U</p>
              
              {levelData && (
                <p className="text-center text-amber-400 text-[11px] mb-4">
                  <Star className="w-3 h-3 inline mr-1" />
                  Lv.{levelData.current_level} {levelData.level_title}
                </p>
              )}
              
              <p className="text-center text-white/50 text-sm mb-4">
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              </p>
              
              <p 
                className="text-center text-7xl font-extralight mb-2"
                style={{ color: getScoreColor(vibeScore) }}
              >
                {vibeScore ?? '—'}
              </p>
              <p className="text-center text-white/40 text-xs tracking-wider mb-6">TODAY&apos;S VIBE</p>
              
              {/* 8 Dimensions */}
              {cardStyle === 'classic' && dimensions && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <DimPreview label="身体" score={dimensions.body} color={getScoreColor(dimensions.body)} />
                  <DimPreview label="心情" score={dimensions.mood} color={getScoreColor(dimensions.mood)} />
                  <DimPreview label="社交" score={dimensions.social} color={getScoreColor(dimensions.social)} />
                  <DimPreview label="工作" score={dimensions.work} color={getScoreColor(dimensions.work)} />
                  <DimPreview label="成长" score={dimensions.growth} color={getScoreColor(dimensions.growth)} />
                  <DimPreview label="意义" score={dimensions.meaning} color={getScoreColor(dimensions.meaning)} />
                  <DimPreview label="数字" score={dimensions.digital} color={getScoreColor(dimensions.digital)} />
                  <DimPreview label="休闲" score={dimensions.leisure} color={getScoreColor(dimensions.leisure)} />
                </div>
              )}
              
              {/* Legacy 4 dimensions as fallback */}
              {cardStyle === 'classic' && !dimensions && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <DimPreview label="睡眠" score={sleepScore} color={getScoreColor(sleepScore)} />
                  <DimPreview label="饮食" score={dietScore} color={getScoreColor(dietScore)} />
                  <DimPreview label="屏幕" score={screenScore} color={getScoreColor(screenScore)} />
                  <DimPreview label="活动" score={activityScore} color={getScoreColor(activityScore)} />
                </div>
              )}
              
              {/* Streak */}
              <div className="flex items-center justify-center gap-4 text-white/30 text-xs">
                {streak > 0 && (
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    连续 {streak} 天
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] text-white rounded-xl py-3 transition-colors hover:bg-[#5558e3]"
              >
                <Download className="w-4 h-4" />
                下载图片
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="p-3 glass rounded-xl text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DimPreview({ label, score, color }: { label: string; score: number | null; color: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-2 text-center">
      <p className="text-white/40 text-[10px] mb-1">{label}</p>
      <p className="text-lg font-light" style={{ color }}>{score ?? '—'}</p>
    </div>
  );
}
