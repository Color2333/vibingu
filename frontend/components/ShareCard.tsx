'use client';

import { useState, useRef } from 'react';
import { Share2, Download, X, Moon, Coffee, Smartphone, Zap } from 'lucide-react';

interface ShareCardProps {
  vibeScore: number | null;
  sleepScore: number | null;
  dietScore: number | null;
  screenScore: number | null;
  activityScore: number | null;
  streak?: number;
}

export default function ShareCard({ 
  vibeScore, 
  sleepScore, 
  dietScore, 
  screenScore, 
  activityScore,
  streak = 0
}: ShareCardProps) {
  const [showModal, setShowModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
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
        
        <rect width="400" height="500" fill="url(#bg)" rx="24"/>
        
        <!-- Logo -->
        <text x="200" y="60" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="12" letter-spacing="4">VIBING U</text>
        
        <!-- Date -->
        <text x="200" y="100" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="14">${date}</text>
        
        <!-- Main Score -->
        <text x="200" y="220" text-anchor="middle" fill="${color}" font-family="system-ui" font-size="120" font-weight="200">${vibeScore ?? '—'}</text>
        
        <!-- Score Label -->
        <text x="200" y="260" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="14">TODAY'S VIBE</text>
        
        <!-- Dimension Scores -->
        <g transform="translate(50, 320)">
          <rect x="0" y="0" width="70" height="70" rx="12" fill="rgba(255,255,255,0.05)"/>
          <text x="35" y="35" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">睡眠</text>
          <text x="35" y="55" text-anchor="middle" fill="${getScoreColor(sleepScore)}" font-family="system-ui" font-size="20">${sleepScore ?? '—'}</text>
        </g>
        <g transform="translate(130, 320)">
          <rect x="0" y="0" width="70" height="70" rx="12" fill="rgba(255,255,255,0.05)"/>
          <text x="35" y="35" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">饮食</text>
          <text x="35" y="55" text-anchor="middle" fill="${getScoreColor(dietScore)}" font-family="system-ui" font-size="20">${dietScore ?? '—'}</text>
        </g>
        <g transform="translate(210, 320)">
          <rect x="0" y="0" width="70" height="70" rx="12" fill="rgba(255,255,255,0.05)"/>
          <text x="35" y="35" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">屏幕</text>
          <text x="35" y="55" text-anchor="middle" fill="${getScoreColor(screenScore)}" font-family="system-ui" font-size="20">${screenScore ?? '—'}</text>
        </g>
        <g transform="translate(290, 320)">
          <rect x="0" y="0" width="70" height="70" rx="12" fill="rgba(255,255,255,0.05)"/>
          <text x="35" y="35" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui" font-size="10">活动</text>
          <text x="35" y="55" text-anchor="middle" fill="${getScoreColor(activityScore)}" font-family="system-ui" font-size="20">${activityScore ?? '—'}</text>
        </g>
        
        <!-- Streak -->
        ${streak > 0 ? `
          <text x="200" y="440" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="system-ui" font-size="12">🔥 连续记录 ${streak} 天</text>
        ` : ''}
        
        <!-- Footer -->
        <text x="200" y="475" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="system-ui" font-size="10">Digitize Your Vibe</text>
      </svg>
    `;
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all btn"
        title="分享"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in">
            {/* Preview Card */}
            <div 
              ref={cardRef}
              className="rounded-3xl p-6 mb-4"
              style={{
                background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
              }}
            >
              <p className="text-center text-white/30 text-[10px] tracking-[0.3em] mb-6">VIBING U</p>
              
              <p className="text-center text-white/50 text-sm mb-4">
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              </p>
              
              <p 
                className="text-center text-7xl font-extralight mb-2"
                style={{ color: getScoreColor(vibeScore) }}
              >
                {vibeScore ?? '—'}
              </p>
              <p className="text-center text-white/40 text-xs tracking-wider mb-8">TODAY&apos;S VIBE</p>
              
              <div className="grid grid-cols-4 gap-2">
                <DimPreview label="睡眠" score={sleepScore} color={getScoreColor(sleepScore)} />
                <DimPreview label="饮食" score={dietScore} color={getScoreColor(dietScore)} />
                <DimPreview label="屏幕" score={screenScore} color={getScoreColor(screenScore)} />
                <DimPreview label="活动" score={activityScore} color={getScoreColor(activityScore)} />
              </div>
              
              {streak > 0 && (
                <p className="text-center text-white/30 text-xs mt-6">🔥 连续记录 {streak} 天</p>
              )}
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
