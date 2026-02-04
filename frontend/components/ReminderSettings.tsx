'use client';

import { useState, useEffect } from 'react';
import { Bell, Droplets, Moon, Coffee, ChevronDown } from 'lucide-react';

interface Reminder {
  id: string;
  name: string;
  icon: React.ReactNode;
  time: string;
  enabled: boolean;
  message: string;
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'water', name: '喝水', icon: <Droplets className="w-4 h-4" />, time: '10:00', enabled: false, message: '该喝水了' },
  { id: 'break', name: '休息', icon: <Coffee className="w-4 h-4" />, time: '15:00', enabled: false, message: '休息一下' },
  { id: 'sleep', name: '睡眠', icon: <Moon className="w-4 h-4" />, time: '22:00', enabled: false, message: '准备睡觉' },
];

export default function ReminderSettings() {
  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vibingu_reminders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setReminders(reminders.map(r => ({
          ...r,
          ...parsed.find((p: Reminder) => p.id === r.id),
        })));
      } catch (e) {
        console.error('Load reminders failed:', e);
      }
    }
  }, []);

  const toggleReminder = (id: string) => {
    const updated = reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setReminders(updated);
    localStorage.setItem('vibingu_reminders', JSON.stringify(updated));
  };

  const enabledCount = reminders.filter(r => r.enabled).length;

  return (
    <div className="glass rounded-3xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/70">提醒</span>
          {enabledCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
              {enabledCount}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-2">
          {reminders.map(reminder => (
            <div
              key={reminder.id}
              className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                reminder.enabled ? 'bg-white/5' : 'bg-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-white/40">{reminder.icon}</span>
                <span className="text-sm text-white/60">{reminder.name}</span>
              </div>
              <button
                onClick={() => toggleReminder(reminder.id)}
                className={`w-10 h-6 rounded-full transition-all ${
                  reminder.enabled ? 'bg-[#6366f1]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    reminder.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
