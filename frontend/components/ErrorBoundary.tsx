'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** 出错时的回调 */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — 包裹子组件，防止单个组件崩溃导致整个页面白屏。
 * 用于包裹 FeedHistory 中的每个 TimelineCard。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 组件渲染出错:', error, info.componentStack);
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-400">这条记录显示异常</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
              {this.state.error?.message || '渲染错误'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
