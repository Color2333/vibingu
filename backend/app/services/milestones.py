"""
里程碑服务 - 追踪成就和统计
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import LifeStream, DailySummary


class MilestoneService:
    """里程碑和成就追踪"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all_milestones(self) -> Dict[str, Any]:
        """获取所有里程碑数据"""
        return {
            "streak": self._get_streak(),
            "records": self._get_record_stats(),
            "best_days": self._get_best_days(),
            "totals": self._get_totals(),
            "achievements": self._get_achievements(),
        }
    
    def _get_streak(self) -> Dict[str, Any]:
        """计算连续记录天数"""
        # 获取所有有记录的日期
        records = self.db.query(
            func.date(LifeStream.created_at).label('date')
        ).distinct().order_by(func.date(LifeStream.created_at).desc()).all()
        
        if not records:
            return {"current": 0, "longest": 0}
        
        dates = [r.date for r in records]
        today = date.today()
        
        # 计算当前连续天数
        current_streak = 0
        check_date = today
        
        for d in dates:
            if isinstance(d, str):
                d = datetime.strptime(d, "%Y-%m-%d").date()
            
            if d == check_date:
                current_streak += 1
                check_date -= timedelta(days=1)
            elif d < check_date:
                break
        
        # 计算最长连续天数
        longest_streak = 0
        temp_streak = 1
        
        for i in range(1, len(dates)):
            prev = dates[i-1]
            curr = dates[i]
            
            if isinstance(prev, str):
                prev = datetime.strptime(prev, "%Y-%m-%d").date()
            if isinstance(curr, str):
                curr = datetime.strptime(curr, "%Y-%m-%d").date()
            
            if (prev - curr).days == 1:
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
        
        longest_streak = max(longest_streak, temp_streak, current_streak)
        
        return {
            "current": current_streak,
            "longest": longest_streak,
        }
    
    def _get_record_stats(self) -> Dict[str, Any]:
        """获取记录统计"""
        total = self.db.query(LifeStream).count()
        
        # 按类别统计
        category_counts = {}
        categories = ['SLEEP', 'DIET', 'SCREEN', 'ACTIVITY', 'MOOD']
        for cat in categories:
            count = self.db.query(LifeStream).filter(LifeStream.category == cat).count()
            category_counts[cat] = count
        
        # 第一条记录日期
        first_record = self.db.query(LifeStream).order_by(LifeStream.created_at.asc()).first()
        first_date = first_record.created_at.date().isoformat() if first_record else None
        
        return {
            "total": total,
            "by_category": category_counts,
            "first_record_date": first_date,
        }
    
    def _get_best_days(self) -> Dict[str, Any]:
        """获取最佳日期"""
        summaries = self.db.query(DailySummary).filter(
            DailySummary.vibe_score.isnot(None)
        ).all()
        
        if not summaries:
            return {
                "highest_vibe": None,
                "most_active": None,
            }
        
        # 最高 Vibe 分数
        best = max(summaries, key=lambda s: s.vibe_score or 0)
        
        # 最活跃的一天（记录最多）
        record_counts = self.db.query(
            func.date(LifeStream.created_at).label('date'),
            func.count().label('count')
        ).group_by(func.date(LifeStream.created_at)).order_by(func.count().desc()).first()
        
        return {
            "highest_vibe": {
                "date": best.date.isoformat() if best.date else None,
                "score": best.vibe_score,
            },
            "most_active": {
                "date": str(record_counts.date) if record_counts else None,
                "count": record_counts.count if record_counts else 0,
            },
        }
    
    def _get_totals(self) -> Dict[str, Any]:
        """获取累计统计"""
        # 记录天数
        days_recorded = self.db.query(
            func.date(LifeStream.created_at)
        ).distinct().count()
        
        # 平均每日记录数
        total_records = self.db.query(LifeStream).count()
        avg_per_day = round(total_records / max(days_recorded, 1), 1)
        
        return {
            "days_recorded": days_recorded,
            "avg_records_per_day": avg_per_day,
        }
    
    def _get_achievements(self) -> List[Dict[str, Any]]:
        """获取已解锁的成就"""
        achievements = []
        stats = {
            "total": self.db.query(LifeStream).count(),
            "streak": self._get_streak(),
            "days": self.db.query(func.date(LifeStream.created_at)).distinct().count(),
        }
        
        # 定义成就
        achievement_defs = [
            {"id": "first_feed", "name": "初次投喂", "desc": "记录第一条数据", "condition": stats["total"] >= 1, "icon": "🎉"},
            {"id": "week_streak", "name": "一周坚持", "desc": "连续记录7天", "condition": stats["streak"]["longest"] >= 7, "icon": "🔥"},
            {"id": "month_streak", "name": "月度达人", "desc": "连续记录30天", "condition": stats["streak"]["longest"] >= 30, "icon": "💪"},
            {"id": "hundred_records", "name": "百条记录", "desc": "累计记录100条", "condition": stats["total"] >= 100, "icon": "💯"},
            {"id": "ten_days", "name": "十日记录", "desc": "累计记录10天", "condition": stats["days"] >= 10, "icon": "📅"},
            {"id": "fifty_days", "name": "半百日记", "desc": "累计记录50天", "condition": stats["days"] >= 50, "icon": "🏆"},
        ]
        
        for a in achievement_defs:
            achievements.append({
                "id": a["id"],
                "name": a["name"],
                "description": a["desc"],
                "icon": a["icon"],
                "unlocked": a["condition"],
            })
        
        return achievements
