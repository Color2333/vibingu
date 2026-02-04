'use client';

import { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (password: string) => Promise<boolean>;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    const success = await onLogin(password);
    
    if (!success) {
      setError('密码错误');
      setPassword('');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-4">
            <Lock className="w-7 h-7 text-white/60" />
          </div>
          <h1 className="text-2xl font-light gradient-text mb-2">vibing u</h1>
          <p className="text-sm text-white/40">请输入密码进入</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors mb-4"
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#5558e3] text-white rounded-xl px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                进入
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-white/20 text-xs mt-6">
          个人生活数据面板
        </p>
      </div>
    </div>
  );
}
