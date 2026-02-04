"""
Vibing Index 计算服务

根据用户的生活数据计算每日状态指数 (0-100)

算法权重:
- 睡眠质量: 40%
- 饮食健康: 25%
- 屏幕时间: 20%
- 活动量: 15%
"""

from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import LifeStream, DailySummary


class VibeCalculator:
    """Vibing Index 计算器"""
    
    # 权重配置
    WEIGHTS = {
        "sleep": 0.40,
        "diet": 0.25,
        "screen": 0.20,
        "activity": 0.15,
    }
    
    # 理想值配置
    IDEAL = {
        "sleep_hours": 7.5,          # 理想睡眠时长
        "max_caffeine_mg": 400,      # 每日最大咖啡因摄入
        "max_screen_hours": 6,       # 每日最大屏幕时间
        "min_activity_count": 1,     # 每日最少活动记录
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_daily_vibe(self, target_date: date) -> Dict[str, Any]:
        """
        计算指定日期的 Vibing Index
        
        Returns:
            包含 vibe_score 和各项分数的字典
        """
        # 获取当天所有记录
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_time,
                LifeStream.created_at < end_time
            )
        ).all()
        
        if not records:
            return {
                "vibe_score": None,
                "sleep_score": None,
                "diet_score": None,
                "screen_score": None,
                "activity_score": None,
                "insights": [],
            }
        
        # 分类统计
        sleep_records = [r for r in records if r.category == "SLEEP"]
        diet_records = [r for r in records if r.category == "DIET"]
        screen_records = [r for r in records if r.category == "SCREEN"]
        activity_records = [r for r in records if r.category == "ACTIVITY"]
        
        # 计算各项分数
        sleep_score = self._calculate_sleep_score(sleep_records)
        diet_score = self._calculate_diet_score(diet_records)
        screen_score = self._calculate_screen_score(screen_records)
        activity_score = self._calculate_activity_score(activity_records)
        
        # 计算总分
        scores = {
            "sleep": sleep_score,
            "diet": diet_score,
            "screen": screen_score,
            "activity": activity_score,
        }
        
        # 只计算有数据的维度
        valid_scores = {k: v for k, v in scores.items() if v is not None}
        
        if not valid_scores:
            vibe_score = None
        else:
            # 重新归一化权重
            total_weight = sum(self.WEIGHTS[k] for k in valid_scores.keys())
            vibe_score = sum(
                v * (self.WEIGHTS[k] / total_weight) 
                for k, v in valid_scores.items()
            )
            vibe_score = round(vibe_score)
        
        # 生成洞察
        insights = self._generate_insights(scores, records)
        
        return {
            "vibe_score": vibe_score,
            "sleep_score": sleep_score,
            "diet_score": diet_score,
            "screen_score": screen_score,
            "activity_score": activity_score,
            "insights": insights,
            "record_count": len(records),
        }
    
    def _calculate_sleep_score(self, records: List[LifeStream]) -> Optional[int]:
        """计算睡眠分数"""
        if not records:
            return None
        
        # 从 meta_data 提取睡眠时长
        total_hours = 0
        sleep_quality_scores = []
        
        for r in records:
            if r.meta_data:
                # 尝试获取睡眠时长
                hours = r.meta_data.get("sleep_hours") or r.meta_data.get("sleep_duration")
                if hours:
                    total_hours += float(hours)
                
                # 尝试获取睡眠质量分数
                quality = r.meta_data.get("sleep_score") or r.meta_data.get("sleep_quality")
                if quality:
                    sleep_quality_scores.append(float(quality))
        
        if sleep_quality_scores:
            # 如果有睡眠质量分数，直接使用
            return round(sum(sleep_quality_scores) / len(sleep_quality_scores))
        
        if total_hours > 0:
            # 根据睡眠时长计算分数
            ideal = self.IDEAL["sleep_hours"]
            if total_hours >= ideal - 0.5 and total_hours <= ideal + 1:
                return 100
            elif total_hours < 5:
                return max(0, int((total_hours / 5) * 50))
            elif total_hours < ideal - 0.5:
                return int(50 + (total_hours - 5) / (ideal - 0.5 - 5) * 50)
            else:  # 睡太多
                return max(60, int(100 - (total_hours - ideal - 1) * 10))
        
        # 默认给个基础分
        return 60
    
    def _calculate_diet_score(self, records: List[LifeStream]) -> Optional[int]:
        """计算饮食分数"""
        if not records:
            return None
        
        total_caffeine = 0
        healthy_count = 0
        unhealthy_count = 0
        
        for r in records:
            if r.meta_data:
                # 咖啡因摄入
                caffeine = r.meta_data.get("caffeine_mg") or r.meta_data.get("caffeine")
                if caffeine:
                    total_caffeine += float(caffeine)
                
                # 健康饮食判断
                is_healthy = r.meta_data.get("is_healthy")
                if is_healthy is True:
                    healthy_count += 1
                elif is_healthy is False:
                    unhealthy_count += 1
        
        score = 70  # 基础分
        
        # 咖啡因惩罚
        if total_caffeine > self.IDEAL["max_caffeine_mg"]:
            score -= min(30, int((total_caffeine - self.IDEAL["max_caffeine_mg"]) / 50))
        
        # 健康饮食奖励
        if healthy_count > unhealthy_count:
            score += min(30, (healthy_count - unhealthy_count) * 10)
        elif unhealthy_count > healthy_count:
            score -= min(20, (unhealthy_count - healthy_count) * 10)
        
        return max(0, min(100, score))
    
    def _calculate_screen_score(self, records: List[LifeStream]) -> Optional[int]:
        """计算屏幕时间分数"""
        if not records:
            return None
        
        total_hours = 0
        
        for r in records:
            if r.meta_data:
                hours = r.meta_data.get("screen_hours") or r.meta_data.get("screen_time")
                if hours:
                    total_hours += float(hours)
        
        if total_hours == 0:
            return 70  # 基础分
        
        max_hours = self.IDEAL["max_screen_hours"]
        
        if total_hours <= max_hours:
            return 100 - int((total_hours / max_hours) * 30)
        else:
            return max(30, int(70 - (total_hours - max_hours) * 10))
    
    def _calculate_activity_score(self, records: List[LifeStream]) -> Optional[int]:
        """计算活动分数"""
        if not records:
            return None
        
        activity_count = len(records)
        min_count = self.IDEAL["min_activity_count"]
        
        if activity_count >= min_count:
            return min(100, 70 + activity_count * 10)
        else:
            return 50
    
    def _generate_insights(
        self, 
        scores: Dict[str, Optional[int]], 
        records: List[LifeStream]
    ) -> List[str]:
        """生成 AI 洞察"""
        insights = []
        
        # 睡眠洞察
        if scores.get("sleep") is not None:
            if scores["sleep"] < 60:
                insights.append("睡眠质量偏低，建议今晚早点休息")
            elif scores["sleep"] >= 90:
                insights.append("睡眠状态很棒，继续保持！")
        
        # 饮食洞察
        if scores.get("diet") is not None:
            if scores["diet"] < 60:
                insights.append("今天的饮食可能不太健康，注意营养均衡")
        
        # 屏幕时间洞察
        if scores.get("screen") is not None:
            if scores["screen"] < 50:
                insights.append("屏幕时间过长，记得让眼睛休息一下")
        
        # 活动洞察
        if scores.get("activity") is None:
            insights.append("今天还没有活动记录，起来动一动吧")
        elif scores["activity"] >= 80:
            insights.append("运动做得不错！")
        
        return insights
    
    def update_daily_summary(self, target_date: date) -> DailySummary:
        """
        更新指定日期的 daily_summary
        """
        vibe_data = self.calculate_daily_vibe(target_date)
        
        # 查找或创建记录
        summary = self.db.query(DailySummary).filter(
            DailySummary.date == target_date
        ).first()
        
        if not summary:
            summary = DailySummary(date=target_date)
            self.db.add(summary)
        
        # 更新数据
        summary.vibe_score = vibe_data["vibe_score"]
        
        # 生成日记摘要
        if vibe_data["insights"]:
            summary.daily_summary_text = " | ".join(vibe_data["insights"])
        
        self.db.commit()
        self.db.refresh(summary)
        
        return summary
