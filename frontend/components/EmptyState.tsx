'use client';

import { Sparkles } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 mb-4">
        <Sparkles className="w-5 h-5 text-white/40" />
      </div>
      
      <h3 className="text-lg font-light text-white/70 mb-2">
        开始记录
      </h3>
      
      <p className="text-sm text-white/40 max-w-xs mx-auto">
        输入文字、上传图片或语音记录你的生活状态
      </p>
    </div>
  );
}
