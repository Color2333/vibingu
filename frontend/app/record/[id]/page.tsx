'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Clock, Moon, Utensils, Smartphone, Activity, 
  Smile, Users, Briefcase, BookOpen, Gamepad2, Send, 
  Sparkles, Image as ImageIcon, X, Lightbulb, RefreshCw,
  Bookmark, Pencil, Check as CheckIcon, XCircle, Save
} from 'lucide-react';

interface RecordDetail {
  id: string;
  input_type: string;
  category: string;
  raw_content: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string | null;
  created_at: string | null;
  record_time: string | null;  // 实际发生时间
  image_saved: boolean;
  image_type: string | null;
  image_path: string | null;
  thumbnail_path: string | null;
  tags: string[] | null;
  dimension_scores: Record<string, number> | null;
  sub_categories?: string[];
  is_public?: boolean;
  is_bookmarked?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  SLEEP: { icon: <Moon className="w-5 h-5" />, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', label: '睡眠' },
  DIET: { icon: <Utensils className="w-5 h-5" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: '饮食' },
  SCREEN: { icon: <Smartphone className="w-5 h-5" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10', label: '屏幕时间' },
  ACTIVITY: { icon: <Activity className="w-5 h-5" />, color: 'text-green-400', bgColor: 'bg-green-500/10', label: '运动' },
  MOOD: { icon: <Smile className="w-5 h-5" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10', label: '心情' },
  SOCIAL: { icon: <Users className="w-5 h-5" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10', label: '社交' },
  WORK: { icon: <Briefcase className="w-5 h-5" />, color: 'text-slate-400', bgColor: 'bg-slate-500/10', label: '工作' },
  GROWTH: { icon: <BookOpen className="w-5 h-5" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: '成长' },
  LEISURE: { icon: <Gamepad2 className="w-5 h-5" />, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: '休闲' },
};

const ALL_CATEGORIES = ['SLEEP', 'DIET', 'SCREEN', 'ACTIVITY', 'MOOD', 'SOCIAL', 'WORK', 'GROWTH', 'LEISURE'];

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = params.id as string;
  
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRecordTime, setEditRecordTime] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editSubCategories, setEditSubCategories] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showImage, setShowImage] = useState(false);

  // Fetch record detail
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/feed/${recordId}`);
        if (!res.ok) {
          throw new Error('记录不存在');
        }
        const data = await res.json();
        setRecord(data);
        
        // Generate initial suggestions based on category
        const category = data.category || 'MOOD';
        const baseSuggestions = [
          '这条记录对我有什么启示？',
          '有什么改进建议吗？',
          '帮我分析一下这条记录',
        ];
        setSuggestions(baseSuggestions);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (recordId) {
      fetchRecord();
    }
  }, [recordId]);

  // Check if edit mode was requested via URL param
  useEffect(() => {
    if (searchParams.get('edit') === '1' && record) {
      enterEditMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, searchParams]);

  const enterEditMode = () => {
    if (!record) return;
    setEditContent(record.raw_content || '');
    setEditCategory(record.category || 'MOOD');
    setEditRecordTime(record.record_time ? record.record_time.slice(0, 16) : '');
    setEditTags(record.tags || []);
    setEditSubCategories(record.sub_categories || []);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setNewTag('');
  };

  const saveEdit = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('vibingu_token');
      const body: Record<string, unknown> = {};
      if (editContent !== (record.raw_content || '')) body.raw_content = editContent;
      if (editCategory !== record.category) body.category = editCategory;
      if (editRecordTime && editRecordTime !== (record.record_time || '').slice(0, 16)) {
        body.record_time = new Date(editRecordTime).toISOString();
      }
      if (JSON.stringify(editTags) !== JSON.stringify(record.tags || [])) body.tags = editTags;
      if (JSON.stringify(editSubCategories) !== JSON.stringify(record.sub_categories || [])) body.sub_categories = editSubCategories;
      
      if (Object.keys(body).length === 0) {
        setIsEditing(false);
        return;
      }

      const res = await fetch(`/api/feed/${record.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setRecord(prev => prev ? {
          ...prev,
          raw_content: data.record.raw_content ?? prev.raw_content,
          category: data.record.category ?? prev.category,
          sub_categories: data.record.sub_categories ?? prev.sub_categories,
          record_time: data.record.record_time ?? prev.record_time,
          tags: data.record.tags ?? prev.tags,
        } : prev);
        setIsEditing(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBookmark = async () => {
    if (!record) return;
    const newVal = !record.is_bookmarked;
    try {
      const token = localStorage.getItem('vibingu_token');
      const res = await fetch(`/api/feed/${record.id}/bookmark`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_bookmarked: newVal }),
      });
      if (res.ok) {
        setRecord(prev => prev ? { ...prev, is_bookmarked: newVal } : prev);
      }
    } catch {
      // silently fail
    }
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;

    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/feed/${recordId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages,
        }),
      });

      if (!res.ok) {
        throw new Error('发送失败');
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: '抱歉，暂时无法回复，请稍后再试。' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }, [recordId, messages, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <div className="text-[var(--text-tertiary)] text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-4">{error || '记录不存在'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const config = categoryConfig[record.category] || categoryConfig.MOOD;
  const meta = record.meta_data || {};
  const subCategories = (
    (record.sub_categories && record.sub_categories.length > 0)
      ? record.sub_categories
      : (meta.sub_categories as string[] | undefined)
  )?.filter(sc => sc !== record.category && categoryConfig[sc]) || [];
  const analysis = meta.analysis as string | undefined;
  const metaSuggestions = meta.suggestions as string[] | undefined;
  const healthScore = meta.health_score as number | undefined;
  const sleepScore = meta.score as number | undefined;
  const score = healthScore || sleepScore;
  // 睡眠相关数据
  const sleepTime = meta.sleep_time as string | undefined;
  const wakeTime = meta.wake_time as string | undefined;
  const durationHours = meta.duration_hours as number | undefined;
  const deepSleepHours = meta.deep_sleep_hours as number | undefined;
  const remHours = meta.rem_hours as number | undefined;
  const lightSleepHours = meta.light_sleep_hours as number | undefined;
  const sleepQuality = meta.quality as string | undefined;

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span className={config.color}>{config.icon}</span>
                {config.label}记录详情
                {subCategories.map(sc => {
                  const scCfg = categoryConfig[sc];
                  return (
                    <span key={sc} className={`text-xs px-1.5 py-0.5 rounded ${scCfg.bgColor} ${scCfg.color} opacity-70 font-normal`}>
                      {scCfg.label}
                    </span>
                  );
                })}
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleBookmark}
                className={`p-2 rounded-lg transition-colors ${
                  record.is_bookmarked 
                    ? 'text-amber-400 hover:text-amber-300' 
                    : 'text-[var(--text-tertiary)] hover:text-amber-400 hover:bg-[var(--glass-bg)]'
                }`}
                title={record.is_bookmarked ? '取消收藏' : '收藏'}
              >
                <Bookmark className={`w-5 h-5 ${record.is_bookmarked ? 'fill-current' : ''}`} />
              </button>
              {!isEditing && (
                <button
                  onClick={enterEditMode}
                  className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
                  title="编辑"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Edit mode toolbar */}
        {isEditing && (
          <div className="flex items-center justify-between mb-4 p-3 glass-card rounded-xl border border-indigo-500/20">
            <span className="text-sm text-indigo-400 flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              编辑模式
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* Record Content */}
        <div className="glass-card p-6 mb-6">
          {/* Time + Category (edit mode) */}
          {isEditing ? (
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-tertiary)] w-16 flex-shrink-0">分类</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{categoryConfig[cat]?.label || cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-tertiary)] w-16 flex-shrink-0">时间</label>
                <input
                  type="datetime-local"
                  value={editRecordTime}
                  onChange={(e) => setEditRecordTime(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">副分类（可选，选择与此记录相关的其他分类）</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CATEGORIES.filter(cat => cat !== editCategory).map(cat => {
                    const cfg = categoryConfig[cat];
                    const isSelected = editSubCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setEditSubCategories(prev =>
                            isSelected ? prev.filter(c => c !== cat) : [...prev, cat]
                          );
                        }}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all flex items-center gap-1 ${
                          isSelected 
                            ? `${cfg?.bgColor} ${cfg?.color} ring-1 ring-current/20` 
                            : 'bg-[var(--glass-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        {cfg?.label || cat}
                        {isSelected && <span className="ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] mb-4">
            <Clock className="w-4 h-4" />
            <span>{(record.record_time || record.created_at) ? formatDateTime(record.record_time || record.created_at!) : '未知时间'}</span>
            {score !== undefined && (
              <span className={`ml-auto px-2 py-0.5 rounded text-sm ${
                score >= 70 ? 'bg-green-500/10 text-green-400' : 
                score >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 
                'bg-red-500/10 text-red-400'
              }`}>
                {score} 分
              </span>
            )}
          </div>
          )}

          {/* 睡眠数据卡片 */}
          {record.category === 'SLEEP' && (sleepTime || wakeTime || durationHours) && (
            <div className="mb-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <h3 className="text-xs text-indigo-400 mb-3 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5" />
                <span>睡眠数据</span>
                {sleepQuality && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    sleepQuality === 'good' ? 'bg-green-500/20 text-green-400' :
                    sleepQuality === 'fair' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {sleepQuality === 'good' ? '优质' : sleepQuality === 'fair' ? '一般' : '较差'}
                  </span>
                )}
              </h3>
              
              {/* 入睡和苏醒时间 */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-1">入睡时间</div>
                  <div className="text-lg font-semibold text-indigo-300">
                    {sleepTime || '--:--'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-1">苏醒时间</div>
                  <div className="text-lg font-semibold text-amber-300">
                    {wakeTime || '--:--'}
                  </div>
                </div>
              </div>

              {/* 睡眠时长和构成 */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {durationHours && (
                  <div className="p-2 rounded-lg bg-[var(--glass-bg)]">
                    <div className="text-[10px] text-[var(--text-tertiary)]">总时长</div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{durationHours.toFixed(1)}h</div>
                  </div>
                )}
                {deepSleepHours && (
                  <div className="p-2 rounded-lg bg-[var(--glass-bg)]">
                    <div className="text-[10px] text-[var(--text-tertiary)]">深睡</div>
                    <div className="text-sm font-medium text-indigo-300">{deepSleepHours.toFixed(1)}h</div>
                  </div>
                )}
                {remHours && (
                  <div className="p-2 rounded-lg bg-[var(--glass-bg)]">
                    <div className="text-[10px] text-[var(--text-tertiary)]">REM</div>
                    <div className="text-sm font-medium text-purple-300">{remHours.toFixed(1)}h</div>
                  </div>
                )}
                {lightSleepHours && (
                  <div className="p-2 rounded-lg bg-[var(--glass-bg)]">
                    <div className="text-[10px] text-[var(--text-tertiary)]">浅睡</div>
                    <div className="text-sm font-medium text-blue-300">{lightSleepHours.toFixed(1)}h</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Original Content */}
          {isEditing ? (
            <div className="mb-4">
              <h3 className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                <span>内容</span>
              </h3>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
                placeholder="记录内容..."
              />
            </div>
          ) : (
          (() => {
            const content = record.raw_content;
            if (content && !content.startsWith('/') && !content.includes('/Users/')) {
              return (
                <div className="mb-4">
                  <h3 className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                    <span>原始内容</span>
                  </h3>
                  <p className="text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                    {content}
                  </p>
                </div>
              );
            }
            return null;
          })()
          )}

          {/* AI Insight */}
          {record.ai_insight && record.ai_insight !== '已记录' && (
            <div className="mb-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <h3 className="text-xs text-violet-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 洞察</span>
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {record.ai_insight}
              </p>
            </div>
          )}

          {/* AI Analysis */}
          {analysis && (
            <div className="mb-4 p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--border)]">
              <h3 className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>AI 深度分析</span>
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                {analysis}
              </p>
            </div>
          )}

          {/* Suggestions */}
          {metaSuggestions && metaSuggestions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-[var(--text-tertiary)] mb-2">💡 建议</h3>
              <div className="space-y-2">
                {metaSuggestions.map((s, idx) => (
                  <p key={idx} className="text-[var(--text-secondary)] text-sm flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span>{s}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Image */}
          {record.image_saved && record.image_path && (
            <div className="mb-4">
              <button 
                onClick={() => setShowImage(true)} 
                className="relative group"
              >
                <img 
                  src={record.thumbnail_path || record.image_path} 
                  alt="" 
                  className="max-h-60 rounded-xl opacity-90 group-hover:opacity-100 transition-opacity" 
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          )}

          {/* Tags */}
          {isEditing ? (
            <div className="mb-4">
              <h3 className="text-xs text-[var(--text-tertiary)] mb-2">标签</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {editTags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="px-2 py-1 text-xs rounded-lg bg-[var(--glass-bg)] text-[var(--text-tertiary)] flex items-center gap-1"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-[var(--text-tertiary)] hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="添加标签..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--glass-bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="px-2 py-1.5 text-xs rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </div>
          ) : (
          record.tags && record.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {record.tags.map((tag, idx) => (
                <span 
                  key={idx} 
                  className="px-2 py-1 text-xs rounded-lg bg-[var(--glass-bg)] text-[var(--text-tertiary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )
          )}

          {/* Dimension Scores */}
          {record.dimension_scores && Object.keys(record.dimension_scores).length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h3 className="text-xs text-[var(--text-tertiary)] mb-3">维度评分</h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(record.dimension_scores).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              与 AI 讨论这条记录
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">问我任何关于这条记录的问题</p>
          </div>

          {/* Messages */}
          <div className="h-[300px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[var(--text-tertiary)] text-sm mb-4">选择一个问题开始对话</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(s)}
                      className="px-3 py-1.5 text-xs bg-[var(--glass-bg)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500/20 text-[var(--text-primary)]' 
                        : 'bg-[var(--glass-bg)] text-[var(--text-secondary)]'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--glass-bg)] px-4 py-2 rounded-2xl">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Quick Suggestions (when in conversation) */}
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--border)] flex gap-2 overflow-x-auto">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(s)}
                  disabled={isSending}
                  className="px-3 py-1 text-xs bg-[var(--glass-bg)] text-[var(--text-tertiary)] rounded-full hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)] transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的问题..."
                className="flex-1 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] text-sm"
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || isSending}
                className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Image Modal */}
      {showImage && record.image_path && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" 
          onClick={() => setShowImage(false)}
        >
          <button 
            onClick={() => setShowImage(false)} 
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={record.image_path} 
            alt="" 
            className="max-w-full max-h-full rounded-xl" 
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
