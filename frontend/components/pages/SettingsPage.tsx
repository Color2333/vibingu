'use client';

import ReminderSettings from '@/components/ReminderSettings';
import TokenUsage from '@/components/TokenUsage';
import ShareCard from '@/components/ShareCard';
import { Download, Upload, Trash2, Database } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vibingu-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <p className="text-sm text-white/40 mt-1">管理你的偏好和数据</p>
      </div>

      {/* 提醒设置 */}
      <section className="animate-fade-in">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white/80">提醒设置</h2>
          <p className="text-xs text-white/40 mt-0.5">设置记录提醒时间</p>
        </div>
        <ReminderSettings />
      </section>

      {/* Token 用量 */}
      <section className="animate-fade-in delay-1 pt-4 border-t border-white/[0.06]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white/80">AI 用量统计</h2>
          <p className="text-xs text-white/40 mt-0.5">查看 Token 消耗情况</p>
        </div>
        <TokenUsage />
      </section>

      {/* 数据管理 */}
      <section className="animate-fade-in delay-2 pt-4 border-t border-white/[0.06]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white/80">数据管理</h2>
          <p className="text-xs text-white/40 mt-0.5">导出或管理你的数据</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleExportData('json')}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]
                       hover:bg-white/[0.06] hover:border-white/10 transition-all group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm text-white/80">导出 JSON</div>
              <div className="text-xs text-white/40">完整数据备份</div>
            </div>
          </button>

          <button
            onClick={() => handleExportData('csv')}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]
                       hover:bg-white/[0.06] hover:border-white/10 transition-all group"
          >
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-colors">
              <Download className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm text-white/80">导出 CSV</div>
              <div className="text-xs text-white/40">Excel 兼容格式</div>
            </div>
          </button>
        </div>
      </section>

      {/* 分享卡片生成 */}
      <section className="animate-fade-in delay-3 pt-4 border-t border-white/[0.06]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white/80">分享卡片</h2>
          <p className="text-xs text-white/40 mt-0.5">生成精美的状态分享图</p>
        </div>
        <ShareCard />
      </section>

      {/* 关于 */}
      <section className="animate-fade-in delay-4 pt-4 border-t border-white/[0.06]">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className="text-center">
            <div className="text-2xl mb-2">✨</div>
            <div className="text-sm font-medium text-white/60">Vibing u</div>
            <div className="text-xs text-white/30 mt-1">v0.2.0 · 数字生活黑匣子</div>
            <div className="text-[10px] text-white/20 mt-3">
              用 AI 寻找"最佳状态"的源代码
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
