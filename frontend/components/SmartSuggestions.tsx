'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

export default function SmartSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await fetch('/api/reports/suggestions');
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error('获取建议失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, []);

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6">
        <div className="h-16 skeleton rounded-xl" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <p className="text-xs uppercase tracking-[0.15em] text-white/40">
          Insights
        </p>
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 2).map((suggestion, index) => (
          <p key={index} className="text-sm text-white/60 leading-relaxed">
            {suggestion}
          </p>
        ))}
      </div>
    </div>
  );
}
