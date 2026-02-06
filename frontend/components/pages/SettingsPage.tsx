'use client';

import ReminderSettings from '@/components/ReminderSettings';
import TokenUsage from '@/components/TokenUsage';
import ShareCard from '@/components/ShareCard';
import { Download, Upload, Trash2, Database, User, Check, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

function NicknameSection() {
  const [nickname, setNickname] = useState('小菜');
  const [savedNickname, setSavedNickname] = useState('小菜');
  const [saving, setSaving] = useState(false);

  // 异步加载当前昵称（不阻塞 UI）
  useEffect(() => {
    const token = localStorage.getItem('vibingu_token');
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5秒超时
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.nickname) {
          setNickname(data.nickname);
          setSavedNickname(data.nickname);
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const handleSave = useCallback(async () => {
    const token = localStorage.getItem('vibingu_token');
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/nickname', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedNickname(data.nickname || '');
        setNickname(data.nickname || '');
      }
    } catch (e) {
      console.error('保存昵称失败:', e);
    } finally {
      setSaving(false);
    }
  }, [nickname]);

  const isDirty = nickname.trim() !== (savedNickname || '');

  return (
    <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
          <User className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-sm text-[var(--text-primary)] font-medium block mb-1">
            你的昵称
          </label>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            AI 会用这个称呼和你对话，而不是"用户"
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value.slice(0, 20))}
          placeholder="输入昵称（如：小明）"
          maxLength={20}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]
                     text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                     focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50
                     transition-all"
          onKeyDown={e => { if (e.key === 'Enter' && isDirty) handleSave(); }}
        />
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            isDirty
              ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
              : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          保存
        </button>
      </div>
    </div>
  );
}

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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">设置</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">管理你的偏好和数据</p>
      </div>

      {/* 个人信息 */}
      <section className="animate-fade-in">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">个人信息</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">让 AI 更了解你</p>
        </div>
        <NicknameSection />
      </section>

      {/* 提醒设置 */}
      <section className="animate-fade-in">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">提醒设置</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">设置记录提醒时间</p>
        </div>
        <ReminderSettings />
      </section>

      {/* Token 用量 */}
      <section className="animate-fade-in delay-1 pt-4 border-t border-[var(--border)]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI 用量统计</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">查看 Token 消耗情况</p>
        </div>
        <TokenUsage />
      </section>

      {/* 数据管理 */}
      <section className="animate-fade-in delay-2 pt-4 border-t border-[var(--border)]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">数据管理</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">导出或管理你的数据</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleExportData('json')}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]
                       hover:bg-[var(--bg-secondary)] hover:border-[var(--glass-border)] transition-all group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm text-[var(--text-primary)]">导出 JSON</div>
              <div className="text-xs text-[var(--text-tertiary)]">完整数据备份</div>
            </div>
          </button>

          <button
            onClick={() => handleExportData('csv')}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]
                       hover:bg-[var(--bg-secondary)] hover:border-[var(--glass-border)] transition-all group"
          >
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-colors">
              <Download className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm text-[var(--text-primary)]">导出 CSV</div>
              <div className="text-xs text-[var(--text-tertiary)]">Excel 兼容格式</div>
            </div>
          </button>
        </div>
      </section>

      {/* 分享卡片生成 */}
      <section className="animate-fade-in delay-3 pt-4 border-t border-[var(--border)]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">分享卡片</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">生成精美的状态分享图</p>
        </div>
        <ShareCard />
      </section>

      {/* 关于 */}
      <section className="animate-fade-in delay-4 pt-4 border-t border-[var(--border)]">
        <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
          <div className="text-center">
            <div className="text-2xl mb-2">✨</div>
            <div className="text-sm font-medium text-[var(--text-secondary)]">Vibing u</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">v0.2.0 · 数字生活黑匣子</div>
            <div className="text-[10px] text-[var(--text-tertiary)] opacity-60 mt-3">
              用 AI 寻找"最佳状态"的源代码
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
