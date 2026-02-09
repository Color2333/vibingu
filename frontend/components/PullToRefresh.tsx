'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
}

const THRESHOLD = 80; // px to trigger refresh
const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;
    // Only allow pull when scrolled to top
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || isRefreshing) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY > 0) {
      // Apply resistance
      const distance = Math.min(deltaY * 0.5, MAX_PULL);
      setPullDistance(distance);
    } else {
      pullingRef.current = false;
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD * 0.6); // Show spinner at fixed position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  if (!isTouchDevice) {
    return <div className={className}>{children}</div>;
  }

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh-container relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div 
          className="flex items-center justify-center transition-all duration-200"
          style={{ height: pullDistance, minHeight: isRefreshing ? 48 : 0 }}
        >
          <div className={`flex items-center gap-2 text-sm text-indigo-400 ${isRefreshing ? 'animate-pulse' : ''}`}>
            <RefreshCw 
              className={`w-5 h-5 transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`, opacity: progress }}
            />
            <span className="text-xs">
              {isRefreshing ? '刷新中...' : progress >= 1 ? '释放刷新' : '下拉刷新'}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ transform: showIndicator && !isRefreshing ? `translateY(0)` : undefined }}>
        {children}
      </div>
    </div>
  );
}
