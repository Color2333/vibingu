'use client';

import { useEffect, useState } from 'react';

interface Tag {
  tag: string;
  count: number;
  weight: number;
  category: string;
}

interface TagCloudData {
  period_days: number;
  total_tags: number;
  tags: Tag[];
}

interface Props {
  className?: string;
  days?: number;
}

// Category color mapping
const categoryColors: { [key: string]: string } = {
  时间: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  身体: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  心情: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  社交: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  工作: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  休闲: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  饮食: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  习惯: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  成长: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  其他: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function TagCloud({ className = '', days = 30 }: Props) {
  const [data, setData] = useState<TagCloudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, [days]);

  const fetchTags = async () => {
    try {
      const res = await fetch(`/api/tags/cloud?days=${days}&limit=50`);
      if (res.ok) {
        const tagData = await res.json();
        setData(tagData);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories
  const categories = data
    ? Array.from(new Set(data.tags.map((t) => t.category)))
    : [];

  // Filter tags by selected category
  const filteredTags = data
    ? selectedCategory
      ? data.tags.filter((t) => t.category === selectedCategory)
      : data.tags
    : [];

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="flex flex-wrap gap-2">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-8 bg-white/5 rounded-full"
                style={{ width: `${60 + Math.random() * 40}px` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.tags.length === 0) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-white/90 mb-4">标签云</h3>
        <div className="text-center py-8">
          <span className="text-3xl">🏷️</span>
          <p className="text-white/50 mt-2">还没有标签数据</p>
          <p className="text-white/30 text-sm">记录更多内容来生成标签</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white/90">标签云</h3>
        <span className="text-sm text-white/50">
          {data.total_tags} 个标签 · 最近 {data.period_days} 天
        </span>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-xs transition-all ${
            selectedCategory === null
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              setSelectedCategory(cat === selectedCategory ? null : cat)
            }
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              selectedCategory === cat
                ? categoryColors[cat] || categoryColors['其他']
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tag Cloud */}
      <div className="flex flex-wrap gap-2">
        {filteredTags.map((tag) => {
          // Calculate font size based on weight
          const fontSize = 12 + (tag.weight / 100) * 8;
          const colorClass =
            categoryColors[tag.category] || categoryColors['其他'];

          return (
            <span
              key={tag.tag}
              className={`px-3 py-1 rounded-full border cursor-pointer transition-all hover:scale-105 ${colorClass}`}
              style={{ fontSize: `${fontSize}px` }}
              title={`使用次数: ${tag.count}`}
            >
              {tag.tag}
            </span>
          );
        })}
      </div>

      {filteredTags.length === 0 && (
        <p className="text-white/50 text-center py-4">该分类暂无标签</p>
      )}
    </div>
  );
}
