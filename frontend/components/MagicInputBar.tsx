'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Mic, MicOff, Send, X, Image as ImageIcon, Loader2 } from 'lucide-react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface FeedResponse {
  id: string;
  category: string | null;
  meta_data: Record<string, unknown> | null;
  ai_insight: string;
  created_at: string;
  tags?: string[];
}

interface MagicInputBarProps {
  onSuccess: (response: FeedResponse) => void;
  onLoading: (loading: boolean) => void;
  onOptimisticAdd?: (data: { text: string; imagePreview: string | null }) => void;
  onError?: () => void;
}

export default function MagicInputBar({ onSuccess, onLoading, onOptimisticAdd, onError }: MagicInputBarProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      // 先检查是否有图片
      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          hasImage = true;
          const file = item.getAsFile();
          if (file) {
            // 阻止默认粘贴行为，避免同时粘贴图片链接文本
            e.preventDefault();
            setImage(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(file);
          }
          break;
        }
      }
      
      // 如果有图片，检查是否同时粘贴了图片链接文本，如果是则过滤掉
      if (hasImage) {
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        // 如果粘贴的文本看起来像是图片链接，就不添加到输入框
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(pastedText) ||
                          /^(data:image|blob:|file:)/i.test(pastedText) ||
                          /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)/i.test(pastedText);
        if (!isImageUrl && pastedText.trim()) {
          // 如果不是图片链接，允许添加文本作为描述
          setText(prev => prev + pastedText);
        }
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0];
      if (result && result.isFinal) {
        const transcript = result[0].transcript;
        setText((prev) => prev + transcript);
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !image) return;

    const currentText = text.trim();
    const currentImagePreview = imagePreview;
    const currentImage = image;

    // 立即清空输入
    setText('');
    clearImage();

    // 乐观更新 - 立即显示记录
    if (onOptimisticAdd) {
      onOptimisticAdd({
        text: currentText,
        imagePreview: currentImagePreview,
      });
    }

    setIsSubmitting(true);
    onLoading(true);

    try {
      const formData = new FormData();
      if (currentText) formData.append('text', currentText);
      if (currentImage) formData.append('image', currentImage);
      
      // 传递客户端实时时间
      const clientTime = new Date().toISOString();
      formData.append('client_time', clientTime);

      const response = await fetch('/api/feed', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const data = await response.json();
      onSuccess(data);
    } catch (err) {
      console.error(err);
      // 失败时恢复输入内容，方便用户重试
      setText(currentText);
      if (currentImage && currentImagePreview) {
        setImage(currentImage);
        setImagePreview(currentImagePreview);
      }
      if (onError) {
        onError();
      }
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="glass rounded-2xl p-4"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Image Preview */}
      {imagePreview && (
        <div className="relative mb-3 inline-block">
          <img
            src={imagePreview}
            alt="预览"
            className="max-h-24 rounded-xl object-cover opacity-80"
          />
          <button
            onClick={clearImage}
            className="absolute -top-2 -right-2 p-1 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="记录此刻..."
          className="flex-1 bg-transparent border-none outline-none resize-none text-white/90 placeholder-white/30 text-sm min-h-[40px] max-h-32"
          rows={1}
          disabled={isSubmitting}
        />

        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all btn"
            disabled={isSubmitting}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="camera-input"
          />
          <label
            htmlFor="camera-input"
            className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all cursor-pointer md:hidden btn"
          >
            <Camera className="w-5 h-5" />
          </label>

          <button
            onClick={toggleRecording}
            className={`p-2 rounded-lg transition-all btn ${
              isRecording
                ? 'text-red-400 bg-red-500/10'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            disabled={isSubmitting}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && !image)}
            className="p-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e3] transition-all btn disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
