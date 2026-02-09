'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MagicInputBar from '@/components/MagicInputBar';
import FeedHistory from '@/components/FeedHistory';
import EmptyState from '@/components/EmptyState';
import PullToRefresh from '@/components/PullToRefresh';
import { useToast } from '@/components/Toast';

export interface FeedItem {
  id: string;
  input_type: string;
  category: string | null;
  raw_content: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string | null;
  created_at: string;
  record_time?: string;  // 实际发生时间（AI分析得出）
  image_saved?: boolean;
  image_type?: string;
  image_path?: string;
  thumbnail_path?: string;
  tags?: string[];
  dimension_scores?: Record<string, number>;
  sub_categories?: string[];
  is_public?: boolean;
  is_bookmarked?: boolean;
  // 分步处理状态
  failed_phases?: string[];    // 后端返回的失败阶段列表
  _pending?: boolean;
  _failed?: boolean;           // 整体提交失败（网络错误等）
  _errorMsg?: string;          // 错误信息
  _tempImagePreview?: string;
  _regenerating?: string[];    // 正在重新生成的阶段
  // SSE 实时阶段推送
  _serverPhase?: string;           // 当前后端正在处理的阶段
  _completedPhases?: string[];     // 已完成的阶段列表
}

interface RecordPageProps {
  refreshKey: number;
}

export default function RecordPage({ refreshKey }: RecordPageProps) {
  // ======== 关键改动1: 使用 Map + ID 列表 ========
  // useRef 存储数据 Map，避免每次更新触发重渲染
  const feedDataRef = useRef<Map<string, FeedItem>>(new Map());
  // 只有 ID 列表变化才会更新界面
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<{ text: string; imagePreview: string | null } | null>(null);
  const { showToast } = useToast();

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await fetch('/api/feed/history?limit=50');
      if (response.ok) {
        const data: FeedItem[] = await response.json();
        // 重置 Map 和 ID 列表（保留未完成的 temp 项）
        const newMap = new Map<string, FeedItem>();
        const newIds: string[] = [];
        // 先保留 pending/failed 的 temp 项
        feedDataRef.current.forEach((item, id) => {
          if (id.startsWith('temp-')) {
            newMap.set(id, item);
            newIds.push(id);
          }
        });
        data.forEach(item => {
          newMap.set(item.id, item);
          newIds.push(item.id);
        });
        feedDataRef.current = newMap;
        setFeedIds(newIds);
      } else {
        setLoadError(`加载失败 (${response.status})`);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
      setLoadError('网络错误，请检查连接');
    } finally {
      setIsFirstLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  // 乐观更新：在列表顶部插入临时记录
  const handleOptimisticAdd = useCallback((tempRecord: {
    text: string;
    imagePreview: string | null;
  }) => {
    const tempId = `temp-${Date.now()}`;
    const tempItem: FeedItem = {
      id: tempId,
      input_type: tempRecord.imagePreview ? 'IMAGE' : 'TEXT',
      category: null,
      raw_content: tempRecord.text || null,
      meta_data: null,
      ai_insight: null,
      created_at: new Date().toISOString(),
      _pending: true,
      _tempImagePreview: tempRecord.imagePreview || undefined,
    };
    
    // 只修改 Map，不触发其他项目的重新渲染
    feedDataRef.current.set(tempId, tempItem);
    // 只在 ID 列表顶部添加新 ID
    setFeedIds(prev => [tempId, ...prev]);
  }, []);

  // AI 处理完成后替换临时记录
  const handleFeedSuccess = useCallback((response: {
    id: string;
    category: string | null;
    meta_data: Record<string, unknown> | null;
    ai_insight: string;
    created_at: string;
    tags?: string[];
    image_saved?: boolean;
    thumbnail_path?: string;
    image_path?: string;
    failed_phases?: string[];
    dimension_scores?: Record<string, number>;
  }) => {
    // 找到临时项，获取原始输入内容
    let originalContent: string | null = null;
    const tempId = feedIds.find(id => id.startsWith('temp-'));
    if (tempId) {
      const tempItem = feedDataRef.current.get(tempId);
      originalContent = tempItem?.raw_content || null;
    }
    
    // 判断 ai_insight 是否有意义（不是空洞的"已记录"等）
    const isGenericInsight = !response.ai_insight || 
      response.ai_insight === '已记录' || 
      response.ai_insight.startsWith('已记录。') ||
      response.ai_insight.startsWith('已记录！') ||
      response.ai_insight.includes('AI 分析暂时不可用') ||
      response.ai_insight.length < 5;
    
    // 如果 AI 没有给出有意义的洞察，使用原始输入
    const finalInsight = isGenericInsight && originalContent 
      ? originalContent 
      : response.ai_insight;
    
    const realItem: FeedItem = {
      id: response.id,
      input_type: 'TEXT',
      category: response.category,
      raw_content: originalContent, // 保留原始内容
      meta_data: response.meta_data,
      ai_insight: finalInsight,
      created_at: response.created_at,
      tags: response.tags,
      dimension_scores: response.dimension_scores,
      image_saved: response.image_saved,
      thumbnail_path: response.thumbnail_path,
      image_path: response.image_path,
      failed_phases: response.failed_phases?.length ? response.failed_phases : undefined,
    };
    
    // 找到临时 ID 并替换
    setFeedIds(prev => {
      const tempIdx = prev.findIndex(id => id.startsWith('temp-'));
      if (tempIdx >= 0) {
        const tid = prev[tempIdx];
        // 从 Map 中删除临时项，添加真实项
        feedDataRef.current.delete(tid);
        feedDataRef.current.set(response.id, realItem);
        // 返回新的 ID 列表（只替换 ID）
        const newIds = [...prev];
        newIds[tempIdx] = response.id;
        return newIds;
      }
      // 如果没找到临时项，添加到顶部
      feedDataRef.current.set(response.id, realItem);
      return [response.id, ...prev];
    });
    
    // Toast 提示
    if (response.failed_phases?.length) {
      const phaseNames: Record<string, string> = {
        tags: '标签', dimension_scores: '维度评分', ai_insight: 'AI 洞察',
        image_save: '图片保存', rag_index: '搜索索引',
      };
      const failedNames = response.failed_phases.map(p => phaseNames[p] || p).join('、');
      showToast('success', `记录已保存，${failedNames}生成失败（可点击重试）`);
    } else {
      const toastMessage = isGenericInsight ? '记录成功！' : response.ai_insight;
      showToast('success', toastMessage);
    }
  }, [showToast, feedIds]);

  // 处理失败：将临时记录标记为失败状态（保留在列表中，不自动消失）
  const handleFeedError = useCallback((errorMsg?: string) => {
    setFeedIds(prev => {
      const tempIds = prev.filter(id => id.startsWith('temp-'));
      tempIds.forEach(id => {
        const item = feedDataRef.current.get(id);
        if (item) {
          feedDataRef.current.set(id, {
            ...item,
            _pending: false,
            _failed: true,
            _errorMsg: errorMsg || '提交失败',
          });
        }
      });
      // 触发重渲染
      return [...prev];
    });
    showToast('error', errorMsg || '记录失败，可点击重试');
  }, [showToast]);

  // SSE 阶段进度更新
  const handlePhaseUpdate = useCallback((phase: string, status: string) => {
    setFeedIds(prev => {
      const tempIds = prev.filter(id => id.startsWith('temp-'));
      if (tempIds.length === 0) return prev;
      
      const latestTempId = tempIds[0];
      const item = feedDataRef.current.get(latestTempId);
      if (!item) return prev;
      
      const completedPhases = [...(item._completedPhases || [])];
      if (status === 'done' && !completedPhases.includes(phase)) {
        completedPhases.push(phase);
      }
      
      feedDataRef.current.set(latestTempId, {
        ...item,
        _serverPhase: status === 'start' || status === 'retry' ? phase : item._serverPhase,
        _completedPhases: completedPhases,
      });
      
      // 触发重渲染
      return [...prev];
    });
  }, []);

  // 取消/移除失败的记录
  const handleDismissFailed = useCallback((id: string) => {
    feedDataRef.current.delete(id);
    setFeedIds(prev => prev.filter(i => i !== id));
  }, []);

  // 重试失败的记录（重新提交到输入框）
  const handleRetryFailed = useCallback((id: string) => {
    const item = feedDataRef.current.get(id);
    if (!item) return;
    // 移除失败的临时项
    feedDataRef.current.delete(id);
    setFeedIds(prev => prev.filter(i => i !== id));
    // 将内容恢复到输入框（通过设置 retryContent 让 MagicInputBar 读取）
    setRetryContent({
      text: item.raw_content || '',
      imagePreview: item._tempImagePreview || null,
    });
  }, []);

  // 重新生成已保存记录中失败的部分
  const handleRegenerate = useCallback(async (id: string, phases: string[]) => {
    // 标记正在重新生成
    const item = feedDataRef.current.get(id);
    if (item) {
      feedDataRef.current.set(id, { ...item, _regenerating: phases });
      setFeedIds(prev => [...prev]);
    }

    try {
      const token = localStorage.getItem('vibingu_token');
      const controller = new AbortController();
      // 120秒超时（重新生成阶段较少，但AI调用仍需时间）
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(`/api/feed/${id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phases }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error('重新生成请求失败');
      }

      const data = await res.json();
      const current = feedDataRef.current.get(id);
      if (current) {
        const updated = { ...current, _regenerating: undefined };
        if (data.tags !== null && data.tags !== undefined) updated.tags = data.tags;
        if (data.dimension_scores !== null && data.dimension_scores !== undefined) updated.dimension_scores = data.dimension_scores;
        if (data.ai_insight !== null && data.ai_insight !== undefined) updated.ai_insight = data.ai_insight;
        updated.failed_phases = data.failed_phases?.length ? data.failed_phases : undefined;
        feedDataRef.current.set(id, updated);
        setFeedIds(prev => [...prev]);
      }

      if (data.failed_phases?.length) {
        showToast('error', '部分内容仍然生成失败，可稍后再试');
      } else {
        showToast('success', '重新生成成功！');
      }
    } catch (err) {
      // 恢复状态
      const current = feedDataRef.current.get(id);
      if (current) {
        feedDataRef.current.set(id, { ...current, _regenerating: undefined });
        setFeedIds(prev => [...prev]);
      }
      showToast('error', '重新生成失败，请稍后重试');
    }
  }, [showToast]);

  // 删除记录
  const handleDelete = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem('vibingu_token');
      const res = await fetch(`/api/feed/${id}`, { 
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        feedDataRef.current.delete(id);
        setFeedIds(prev => prev.filter(i => i !== id));
        showToast('success', '记录已删除');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast('error', errorData.detail || '删除失败');
      }
    } catch {
      showToast('error', '网络错误，请重试');
    }
  }, [showToast]);

  // 切换公开状态
  const handleTogglePublic = useCallback(async (id: string, isPublic: boolean) => {
    try {
      const token = localStorage.getItem('vibingu_token');
      const res = await fetch(`/api/feed/${id}/visibility`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_public: isPublic }),
      });
      if (res.ok) {
        const item = feedDataRef.current.get(id);
        if (item) {
          feedDataRef.current.set(id, { ...item, is_public: isPublic });
          setFeedIds(prev => [...prev]); // 触发重渲染
        }
        showToast('success', isPublic ? '已设为公开' : '已设为私密');
      } else {
        // 处理 HTTP 错误状态
        const errorData = await res.json().catch(() => ({}));
        showToast('error', errorData.detail || '操作失败');
      }
    } catch {
      showToast('error', '网络错误，请重试');
    }
  }, [showToast]);

  // 切换收藏状态
  const handleToggleBookmark = useCallback(async (id: string, isBookmarked: boolean) => {
    try {
      const token = localStorage.getItem('vibingu_token');
      const res = await fetch(`/api/feed/${id}/bookmark`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_bookmarked: isBookmarked }),
      });
      if (res.ok) {
        const item = feedDataRef.current.get(id);
        if (item) {
          feedDataRef.current.set(id, { ...item, is_bookmarked: isBookmarked });
          setFeedIds(prev => [...prev]); // 触发重渲染
        }
        showToast('success', isBookmarked ? '已收藏' : '已取消收藏');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast('error', errorData.detail || '操作失败');
      }
    } catch {
      showToast('error', '网络错误，请重试');
    }
  }, [showToast]);

  // 从 Map 获取 items 列表传给子组件
  const feedItems = feedIds.map(id => feedDataRef.current.get(id)).filter(Boolean) as FeedItem[];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">记录</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">记录生活的每一个瞬间</p>
      </div>

      <PullToRefresh onRefresh={fetchHistory} className="flex-1 overflow-y-auto pb-32 -mx-1 px-1">
        {isFirstLoad ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-[var(--glass-bg)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm text-red-400">{loadError}</p>
            <button
              onClick={fetchHistory}
              className="px-4 py-2 text-sm rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-all"
            >
              重新加载
            </button>
          </div>
        ) : feedItems.length > 0 ? (
          <FeedHistory 
            items={feedItems} 
            onDelete={handleDelete}
            onTogglePublic={handleTogglePublic}
            onToggleBookmark={handleToggleBookmark}
            onDismissFailed={handleDismissFailed}
            onRetryFailed={handleRetryFailed}
            onRegenerate={handleRegenerate}
            showManagement={true}
          />
        ) : (
          <EmptyState />
        )}
      </PullToRefresh>

      <div className="fixed bottom-0 left-0 right-0 md:left-[72px] p-4 pb-6 
                      bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/95 to-transparent z-30">
        <div className="max-w-2xl mx-auto">
          <MagicInputBar 
            onSuccess={handleFeedSuccess} 
            onLoading={() => {}}
            onOptimisticAdd={handleOptimisticAdd}
            onError={handleFeedError}
            onPhaseUpdate={handlePhaseUpdate}
            retryContent={retryContent}
            onRetryConsumed={() => setRetryContent(null)}
          />
        </div>
      </div>
    </div>
  );
}
