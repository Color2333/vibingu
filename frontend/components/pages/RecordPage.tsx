'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MagicInputBar from '@/components/MagicInputBar';
import FeedHistory from '@/components/FeedHistory';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';

export interface FeedItem {
  id: string;
  input_type: string;
  category: string | null;
  raw_content: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string | null;
  created_at: string;
  image_saved?: boolean;
  image_type?: string;
  image_path?: string;
  thumbnail_path?: string;
  tags?: string[];
  dimension_scores?: Record<string, number>;
  _pending?: boolean;
  _tempImagePreview?: string;
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
  const { showToast } = useToast();

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/feed/history?limit=50');
      if (response.ok) {
        const data: FeedItem[] = await response.json();
        // 重置 Map 和 ID 列表
        const newMap = new Map<string, FeedItem>();
        const newIds: string[] = [];
        data.forEach(item => {
          newMap.set(item.id, item);
          newIds.push(item.id);
        });
        feedDataRef.current = newMap;
        setFeedIds(newIds);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
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
      response.ai_insight === '已记录。' ||
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
      image_saved: response.image_saved,
      thumbnail_path: response.thumbnail_path,
      image_path: response.image_path,
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
    
    // Toast 也用有意义的内容
    const toastMessage = isGenericInsight ? '记录成功！' : response.ai_insight;
    showToast('success', toastMessage);
  }, [showToast, feedIds]);

  // 处理失败：移除临时记录
  const handleFeedError = useCallback(() => {
    setFeedIds(prev => {
      const tempIds = prev.filter(id => id.startsWith('temp-'));
      tempIds.forEach(id => feedDataRef.current.delete(id));
      return prev.filter(id => !id.startsWith('temp-'));
    });
    showToast('error', '记录失败，请重试');
  }, [showToast]);

  // 从 Map 获取 items 列表传给子组件
  const feedItems = feedIds.map(id => feedDataRef.current.get(id)).filter(Boolean) as FeedItem[];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">记录</h1>
        <p className="text-sm text-white/40 mt-1">记录生活的每一个瞬间</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 -mx-1 px-1">
        {isFirstLoad ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white/[0.02] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : feedItems.length > 0 ? (
          <FeedHistory items={feedItems} />
        ) : (
          <EmptyState />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-[72px] p-4 pb-6 
                      bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent z-30">
        <div className="max-w-2xl mx-auto">
          <MagicInputBar 
            onSuccess={handleFeedSuccess} 
            onLoading={() => {}}
            onOptimisticAdd={handleOptimisticAdd}
            onError={handleFeedError}
          />
        </div>
      </div>
    </div>
  );
}
