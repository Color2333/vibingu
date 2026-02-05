"""游戏化服务

等级、经验值、徽章、挑战管理
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, date
from collections import defaultdict
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.database import SessionLocal
from app.models import LifeStream
from app.models.gamification import (
    UserLevel, UserBadge, Challenge, UserChallengeProgress,
    BadgeType, LEVEL_XP_REQUIREMENTS, LEVEL_TITLES, XP_REWARDS, BADGE_CONFIG
)


class GamificationService:
    """游戏化服务"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    # ========== 等级系统 ==========
    
    def get_or_create_user_level(self, user_id: Optional[str] = None) -> UserLevel:
        """获取或创建用户等级"""
        user_level = self.db.query(UserLevel).filter(
            UserLevel.user_id == user_id
        ).first()
        
        if not user_level:
            user_level = UserLevel(
                id=str(uuid.uuid4()),
                user_id=user_id,
                total_xp=0,
                current_level=1,
                xp_to_next_level=LEVEL_XP_REQUIREMENTS.get(2, 100),
            )
            self.db.add(user_level)
            self.db.commit()
            self.db.refresh(user_level)
        
        return user_level
    
    def add_xp(self, user_id: Optional[str], amount: int, reason: str) -> Dict[str, Any]:
        """添加经验值"""
        user_level = self.get_or_create_user_level(user_id)
        
        old_level = user_level.current_level
        user_level.total_xp += amount
        
        # 检查升级
        new_level = self._calculate_level(user_level.total_xp)
        level_up = new_level > old_level
        
        if level_up:
            user_level.current_level = new_level
        
        # 更新下一级需要的经验
        next_level = min(new_level + 1, 20)
        user_level.xp_to_next_level = LEVEL_XP_REQUIREMENTS.get(next_level, 55000) - user_level.total_xp
        
        self.db.commit()
        
        return {
            "xp_gained": amount,
            "reason": reason,
            "total_xp": user_level.total_xp,
            "current_level": user_level.current_level,
            "level_up": level_up,
            "new_level": new_level if level_up else None,
            "level_title": LEVEL_TITLES.get(user_level.current_level, "未知"),
            "xp_to_next": user_level.xp_to_next_level,
        }
    
    def _calculate_level(self, total_xp: int) -> int:
        """根据总经验值计算等级"""
        level = 1
        for lvl, required_xp in sorted(LEVEL_XP_REQUIREMENTS.items()):
            if total_xp >= required_xp:
                level = lvl
            else:
                break
        return level
    
    def get_level_info(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """获取用户等级信息"""
        user_level = self.get_or_create_user_level(user_id)
        
        current_level_xp = LEVEL_XP_REQUIREMENTS.get(user_level.current_level, 0)
        next_level_xp = LEVEL_XP_REQUIREMENTS.get(
            min(user_level.current_level + 1, 20), 55000
        )
        
        progress_in_level = user_level.total_xp - current_level_xp
        xp_needed_for_level = next_level_xp - current_level_xp
        progress_percent = (progress_in_level / xp_needed_for_level * 100) if xp_needed_for_level > 0 else 100
        
        return {
            "current_level": user_level.current_level,
            "level_title": LEVEL_TITLES.get(user_level.current_level, "未知"),
            "total_xp": user_level.total_xp,
            "xp_to_next_level": max(0, next_level_xp - user_level.total_xp),
            "progress_percent": round(min(progress_percent, 100), 1),
            "total_records": user_level.total_records,
            "current_streak": user_level.current_streak,
            "longest_streak": user_level.longest_streak,
            "max_level": 20,
        }
    
    # ========== 徽章系统 ==========
    
    def get_user_badges(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取用户已获得的徽章"""
        badges = self.db.query(UserBadge).filter(
            UserBadge.user_id == user_id
        ).order_by(UserBadge.earned_at.desc()).all()
        
        return [
            {
                "badge_type": b.badge_type,
                "title": b.title,
                "description": b.description,
                "icon": b.icon,
                "rarity": b.rarity,
                "earned_at": b.earned_at.isoformat() if b.earned_at else None,
            }
            for b in badges
        ]
    
    def get_all_badges(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有徽章（包含是否已获得）"""
        earned_badges = {
            b.badge_type for b in self.db.query(UserBadge).filter(
                UserBadge.user_id == user_id
            ).all()
        }
        
        all_badges = []
        for badge_type, config in BADGE_CONFIG.items():
            all_badges.append({
                "badge_type": badge_type,
                "title": config["title"],
                "description": config["description"],
                "icon": config["icon"],
                "rarity": config["rarity"],
                "earned": badge_type in earned_badges,
            })
        
        # 按稀有度排序
        rarity_order = {"legendary": 0, "epic": 1, "rare": 2, "common": 3}
        all_badges.sort(key=lambda x: (not x["earned"], rarity_order.get(x["rarity"], 4)))
        
        return all_badges
    
    def award_badge(self, user_id: Optional[str], badge_type: str) -> Optional[Dict[str, Any]]:
        """授予徽章"""
        # 检查是否已获得
        existing = self.db.query(UserBadge).filter(
            and_(
                UserBadge.user_id == user_id,
                UserBadge.badge_type == badge_type
            )
        ).first()
        
        if existing:
            return None
        
        config = BADGE_CONFIG.get(badge_type)
        if not config:
            return None
        
        badge = UserBadge(
            id=str(uuid.uuid4()),
            user_id=user_id,
            badge_type=badge_type,
            title=config["title"],
            description=config["description"],
            icon=config["icon"],
            rarity=config["rarity"],
        )
        self.db.add(badge)
        self.db.commit()
        
        # 授予徽章奖励 XP
        self.add_xp(user_id, XP_REWARDS["earn_badge"], f"获得徽章: {config['title']}")
        
        return {
            "badge_type": badge_type,
            "title": config["title"],
            "description": config["description"],
            "icon": config["icon"],
            "rarity": config["rarity"],
        }
    
    def check_and_award_badges(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """检查并授予符合条件的徽章"""
        awarded = []
        
        user_level = self.get_or_create_user_level(user_id)
        
        # 记录数量相关
        record_count = self.db.query(func.count(LifeStream.id)).scalar() or 0
        
        if record_count >= 1:
            badge = self.award_badge(user_id, BadgeType.FIRST_RECORD.value)
            if badge:
                awarded.append(badge)
        
        if record_count >= 100:
            badge = self.award_badge(user_id, BadgeType.CENTURY.value)
            if badge:
                awarded.append(badge)
        
        if record_count >= 1000:
            badge = self.award_badge(user_id, BadgeType.THOUSAND.value)
            if badge:
                awarded.append(badge)
        
        # 连续记录相关
        if user_level.current_streak >= 7:
            badge = self.award_badge(user_id, BadgeType.WEEK_STREAK.value)
            if badge:
                awarded.append(badge)
        
        if user_level.current_streak >= 30:
            badge = self.award_badge(user_id, BadgeType.MONTH_STREAK.value)
            if badge:
                awarded.append(badge)
        
        # 类别相关
        category_counts = self._get_category_counts()
        
        if category_counts.get("SLEEP", 0) >= 30:
            badge = self.award_badge(user_id, BadgeType.SLEEP_MASTER.value)
            if badge:
                awarded.append(badge)
        
        if category_counts.get("ACTIVITY", 0) >= 30:
            badge = self.award_badge(user_id, BadgeType.FITNESS_LOVER.value)
            if badge:
                awarded.append(badge)
        
        if category_counts.get("DIET", 0) >= 50:
            badge = self.award_badge(user_id, BadgeType.FOODIE.value)
            if badge:
                awarded.append(badge)
        
        if category_counts.get("SOCIAL", 0) >= 20:
            badge = self.award_badge(user_id, BadgeType.SOCIAL_BUTTERFLY.value)
            if badge:
                awarded.append(badge)
        
        if category_counts.get("GROWTH", 0) >= 20:
            badge = self.award_badge(user_id, BadgeType.BOOKWORM.value)
            if badge:
                awarded.append(badge)
        
        # 时间相关
        time_badges = self._check_time_badges(user_id)
        awarded.extend(time_badges)
        
        return awarded
    
    def _get_category_counts(self) -> Dict[str, int]:
        """获取各类别记录数量"""
        results = self.db.query(
            LifeStream.category,
            func.count(LifeStream.id)
        ).group_by(LifeStream.category).all()
        
        return {cat: count for cat, count in results if cat}
    
    def _check_time_badges(self, user_id: Optional[str]) -> List[Dict[str, Any]]:
        """检查时间相关徽章"""
        awarded = []
        
        # 最近7天的记录
        start_date = datetime.now() - timedelta(days=7)
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        early_count = sum(1 for r in records if r.created_at and r.created_at.hour < 7)
        late_count = sum(1 for r in records if r.created_at and r.created_at.hour >= 22)
        
        if early_count >= 5:
            badge = self.award_badge(user_id, BadgeType.EARLY_BIRD.value)
            if badge:
                awarded.append(badge)
        
        if late_count >= 5:
            badge = self.award_badge(user_id, BadgeType.NIGHT_OWL.value)
            if badge:
                awarded.append(badge)
        
        return awarded
    
    # ========== 连续记录 ==========
    
    def update_streak(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """更新连续记录天数"""
        user_level = self.get_or_create_user_level(user_id)
        today = datetime.now().date()
        
        if user_level.last_record_date:
            last_date = user_level.last_record_date.date() if isinstance(
                user_level.last_record_date, datetime
            ) else user_level.last_record_date
            
            days_diff = (today - last_date).days
            
            if days_diff == 0:
                # 今天已经记录过
                return {
                    "streak": user_level.current_streak,
                    "is_new_day": False,
                    "xp_earned": 0,
                }
            elif days_diff == 1:
                # 连续记录
                user_level.current_streak += 1
                if user_level.current_streak > user_level.longest_streak:
                    user_level.longest_streak = user_level.current_streak
            else:
                # 断了，重新开始
                user_level.current_streak = 1
        else:
            user_level.current_streak = 1
            user_level.longest_streak = max(user_level.longest_streak, 1)
        
        user_level.last_record_date = datetime.now()
        user_level.total_records += 1
        self.db.commit()
        
        # 给经验奖励
        xp_result = self.add_xp(
            user_id, 
            XP_REWARDS["daily_first"] + XP_REWARDS["streak_day"] * min(user_level.current_streak, 7),
            f"每日首次记录 + {user_level.current_streak}天连续记录"
        )
        
        return {
            "streak": user_level.current_streak,
            "longest_streak": user_level.longest_streak,
            "is_new_day": True,
            "xp_earned": xp_result["xp_gained"],
            "level_up": xp_result.get("level_up", False),
        }
    
    # ========== 挑战系统 ==========
    
    def get_active_challenges(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取当前活跃的挑战"""
        now = datetime.now()
        
        challenges = self.db.query(Challenge).filter(
            and_(
                Challenge.is_active == True,
                Challenge.start_date <= now,
                Challenge.end_date >= now
            )
        ).all()
        
        result = []
        for c in challenges:
            # 获取用户进度
            progress = self.db.query(UserChallengeProgress).filter(
                and_(
                    UserChallengeProgress.user_id == user_id,
                    UserChallengeProgress.challenge_id == c.id
                )
            ).first()
            
            current_progress = progress.current_progress if progress else 0
            is_completed = progress.is_completed if progress else False
            
            result.append({
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "type": c.challenge_type,
                "target_count": c.target_count,
                "current_progress": current_progress,
                "progress_percent": round(current_progress / c.target_count * 100, 1) if c.target_count > 0 else 0,
                "is_completed": is_completed,
                "xp_reward": c.xp_reward,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "days_left": (c.end_date.date() - now.date()).days if c.end_date else 0,
            })
        
        return result
    
    def create_weekly_challenges(self) -> List[Challenge]:
        """创建本周挑战"""
        now = datetime.now()
        # 本周一
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_week = start_of_week + timedelta(days=7) - timedelta(seconds=1)
        
        # 检查是否已创建
        existing = self.db.query(Challenge).filter(
            and_(
                Challenge.challenge_type == "weekly",
                Challenge.start_date >= start_of_week,
                Challenge.start_date < end_of_week
            )
        ).first()
        
        if existing:
            return []
        
        # 创建本周挑战
        weekly_challenges = [
            {
                "title": "📝 记录达人",
                "description": "本周记录15条生活数据",
                "target_category": None,
                "target_count": 15,
                "target_metric": "records",
                "xp_reward": 100,
            },
            {
                "title": "🏃 运动周",
                "description": "本周记录5次运动",
                "target_category": "ACTIVITY",
                "target_count": 5,
                "target_metric": "records",
                "xp_reward": 80,
            },
            {
                "title": "😴 规律作息",
                "description": "本周记录7次睡眠",
                "target_category": "SLEEP",
                "target_count": 7,
                "target_metric": "records",
                "xp_reward": 80,
            },
        ]
        
        created = []
        for c in weekly_challenges:
            challenge = Challenge(
                id=str(uuid.uuid4()),
                title=c["title"],
                description=c["description"],
                challenge_type="weekly",
                target_category=c["target_category"],
                target_count=c["target_count"],
                target_metric=c["target_metric"],
                xp_reward=c["xp_reward"],
                start_date=start_of_week,
                end_date=end_of_week,
                is_active=True,
            )
            self.db.add(challenge)
            created.append(challenge)
        
        self.db.commit()
        return created
    
    def update_challenge_progress(self, user_id: Optional[str], category: Optional[str] = None) -> List[Dict[str, Any]]:
        """更新挑战进度"""
        completed_challenges = []
        
        # 获取活跃挑战
        now = datetime.now()
        challenges = self.db.query(Challenge).filter(
            and_(
                Challenge.is_active == True,
                Challenge.start_date <= now,
                Challenge.end_date >= now
            )
        ).all()
        
        for challenge in challenges:
            # 获取或创建进度
            progress = self.db.query(UserChallengeProgress).filter(
                and_(
                    UserChallengeProgress.user_id == user_id,
                    UserChallengeProgress.challenge_id == challenge.id
                )
            ).first()
            
            if not progress:
                progress = UserChallengeProgress(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    challenge_id=challenge.id,
                    current_progress=0,
                )
                self.db.add(progress)
            
            if progress.is_completed:
                continue
            
            # 检查是否匹配此挑战的类别
            if challenge.target_category and challenge.target_category != category:
                continue
            
            # 更新进度
            progress.current_progress += 1
            
            # 检查是否完成
            if progress.current_progress >= challenge.target_count:
                progress.is_completed = True
                progress.completed_at = datetime.now()
                
                # 给奖励
                xp_result = self.add_xp(user_id, challenge.xp_reward, f"完成挑战: {challenge.title}")
                
                completed_challenges.append({
                    "challenge_title": challenge.title,
                    "xp_reward": challenge.xp_reward,
                    "level_up": xp_result.get("level_up", False),
                })
        
        self.db.commit()
        return completed_challenges
    
    # ========== 统计 ==========
    
    def get_gamification_summary(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """获取游戏化数据汇总"""
        level_info = self.get_level_info(user_id)
        badges = self.get_user_badges(user_id)
        challenges = self.get_active_challenges(user_id)
        
        # 确保有本周挑战
        if not challenges:
            self.create_weekly_challenges()
            challenges = self.get_active_challenges(user_id)
        
        return {
            "level": level_info,
            "badges": {
                "earned_count": len(badges),
                "total_count": len(BADGE_CONFIG),
                "recent": badges[:3],
            },
            "challenges": {
                "active_count": len(challenges),
                "completed_count": sum(1 for c in challenges if c["is_completed"]),
                "challenges": challenges,
            },
        }


# 全局单例
_gamification_service: Optional[GamificationService] = None


def get_gamification_service() -> GamificationService:
    """获取 GamificationService 单例"""
    global _gamification_service
    if _gamification_service is None:
        _gamification_service = GamificationService()
    return _gamification_service
