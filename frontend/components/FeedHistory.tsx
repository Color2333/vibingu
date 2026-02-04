'use client';

import { useState } from 'react';
import { Moon, Utensils, Smartphone, Activity, Smile, Clock, ChevronDown, Image as ImageIcon, X } from 'lucide-react';

interface FeedItem {
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
}

interface FeedHistoryProps {
  items: FeedItem[];
  isLoading: boolean;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  SLEEP: { icon: <Moon className="w-4 h-4" />, color: 'text-indigo-400' },
  DIET: { icon: <Utensils className="w-4 h-4" />, color: 'text-orange-400' },
  SCREEN: { icon: <Smartphone className="w-4 h-4" />, color: 'text-blue-400' },
  ACTIVITY: { icon: <Activity className="w-4 h-4" />, color: 'text-green-400' },
  MOOD: { icon: <Smile className="w-4 h-4" />, color: 'text-pink-400' },
};

function FeedItemCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const category = item.category || 'MOOD';
  const config = categoryConfig[category] || categoryConfig.MOOD;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-subtle rounded-2xl p-4 glass-hover">
      <div className="flex items-start gap-3">
        <div className={`${config.color} opacity-60`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          {item.ai_insight && (
            <p className="text-sm text-white/70 leading-relaxed">{item.ai_insight}</p>
          )}
          
          {/* 保存的图片缩略图 */}
          {item.image_saved && item.thumbnail_path && (
            <button
              onClick={() => setShowImage(true)}
              className="mt-2 relative group"
            >
              <img
                src={item.thumbnail_path}
                alt="记录图片"
                className="h-16 w-auto rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
            </button>
          )}
          
          <div className="flex items-center gap-2 mt-2 text-xs text-white/30">
            <Clock className="w-3 h-3" />
            <span>{formatTime(item.created_at)}</span>
            {item.image_saved && (
              <span className="flex items-center gap-1 text-green-400/60">
                <ImageIcon className="w-3 h-3" />
                已保存
              </span>
            )}
          </div>
        </div>
      </div>

      {item.meta_data && Object.keys(item.meta_data).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            详情
          </button>
          {expanded && (
            <pre className="mt-2 text-xs text-white/30 bg-white/[0.02] rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(item.meta_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* 图片查看模态框 */}
      {showImage && item.image_path && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
          onClick={() => setShowImage(false)}
        >
          <button
            onClick={() => setShowImage(false)}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={item.image_path}
            alt="记录图片"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function FeedHistory({ items, isLoading }: FeedHistoryProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const filteredItems = filter ? items.filter(item => item.category === filter) : items;
  const categories = ['SLEEP', 'DIET', 'SCREEN', 'ACTIVITY', 'MOOD'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.15em] text-white/40">Records</p>
        <span className="text-xs text-white/30">{items.length} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 text-xs rounded-full transition-all btn whitespace-nowrap ${
            filter === null ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
          }`}
        >
          全部
        </button>
        {categories.map(cat => {
          const config = categoryConfig[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all btn whitespace-nowrap flex items-center gap-1.5 ${
                filter === cat ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <span className={config.color}>{config.icon}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item, i) => (
            <div key={item.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <FeedItemCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-white/30 text-sm py-12">暂无记录</p>
      )}
    </div>
  );
}
