'use client';

import LevelCard from '@/components/LevelCard';
import BadgeCollection from '@/components/BadgeCollection';
import ChallengeList from '@/components/ChallengeList';
import Milestones from '@/components/Milestones';
import Goals from '@/components/Goals';

interface AchievementsPageProps {
  refreshKey: number;
}

export default function AchievementsPage({ refreshKey }: AchievementsPageProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">成就中心</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">追踪目标，解锁徽章</p>
      </div>

      {/* 等级卡片 */}
      <section className="animate-fade-in">
        <LevelCard key={`level-${refreshKey}`} />
      </section>

      {/* 里程碑 */}
      <section className="animate-fade-in delay-1">
        <Milestones />
      </section>

      {/* 当前挑战 */}
      <section className="animate-fade-in delay-2">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">活跃挑战</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">完成挑战获得经验值</p>
        </div>
        <ChallengeList key={`challenges-${refreshKey}`} />
      </section>

      {/* 目标设定 */}
      <section className="animate-fade-in delay-3 pt-4 border-t border-[var(--border)]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">个人目标</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">设定并追踪你的目标</p>
        </div>
        <Goals />
      </section>

      {/* 徽章收藏 */}
      <section className="animate-fade-in delay-4 pt-4 border-t border-[var(--border)]">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">徽章收藏</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">你获得的所有成就</p>
        </div>
        <BadgeCollection key={`badges-${refreshKey}`} />
      </section>
    </div>
  );
}
