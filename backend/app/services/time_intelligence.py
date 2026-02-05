"""时间智能分析引擎

核心功能：
1. 昼夜节律分析 - 识别用户的活动时间模式
2. 周期识别 - 发现周/月/季节性规律
3. 生物钟画像 - 生成个人时间模式画像
4. 事件影响追踪 - 分析特定事件对后续状态的影响
"""
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, time
from collections import defaultdict
import math
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.database import SessionLocal
from app.models import LifeStream, DailySummary


# 时间段定义
TIME_PERIODS = {
    "dawn": (5, 7),      # 黎明
    "morning": (7, 12),   # 上午
    "noon": (12, 14),     # 中午
    "afternoon": (14, 18), # 下午
    "evening": (18, 21),  # 傍晚
    "night": (21, 24),    # 夜晚
    "late_night": (0, 5), # 深夜
}

# 生物钟类型
CHRONOTYPE = {
    "lion": {"name": "狮子型", "peak": (6, 10), "description": "早起者，上午效率最高"},
    "bear": {"name": "熊型", "peak": (10, 14), "description": "跟随太阳，中午最活跃"},
    "wolf": {"name": "狼型", "peak": (16, 20), "description": "夜猫子，下午到晚间最佳"},
    "dolphin": {"name": "海豚型", "peak": (10, 12), "description": "睡眠浅，分散式高效"},
}


class TimeIntelligence:
    """时间智能分析器"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def analyze_circadian_rhythm(self, days: int = 30) -> Dict[str, Any]:
        """
        分析昼夜节律模式
        
        返回:
        - 每小时活动分布
        - 高峰时段
        - 低谷时段
        - 推荐的生物钟类型
        """
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        if not records:
            return self._empty_circadian_result()
        
        # 统计每小时的活动数量和维度得分
        hourly_activity: Dict[int, List[float]] = defaultdict(list)
        hourly_counts: Dict[int, int] = defaultdict(int)
        category_by_hour: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        
        for record in records:
            if record.created_at:
                hour = record.created_at.hour
                hourly_counts[hour] += 1
                
                if record.category:
                    category_by_hour[hour][record.category] += 1
                
                # 计算该记录的综合得分
                if record.dimension_scores:
                    avg_score = sum(record.dimension_scores.values()) / len(record.dimension_scores)
                    hourly_activity[hour].append(avg_score)
        
        # 计算每小时平均活跃度和得分
        hourly_stats = {}
        for hour in range(24):
            count = hourly_counts[hour]
            scores = hourly_activity[hour]
            avg_score = sum(scores) / len(scores) if scores else 50
            
            # 找出该小时最常见的活动类型
            top_category = None
            if category_by_hour[hour]:
                top_category = max(category_by_hour[hour], key=category_by_hour[hour].get)
            
            hourly_stats[hour] = {
                "count": count,
                "avg_score": round(avg_score, 1),
                "top_category": top_category,
                "activity_level": self._normalize_activity(count, max(hourly_counts.values()) if hourly_counts else 1)
            }
        
        # 找出高峰和低谷时段
        peak_hours = self._find_peak_hours(hourly_counts)
        valley_hours = self._find_valley_hours(hourly_counts)
        
        # 推断生物钟类型
        chronotype = self._infer_chronotype(peak_hours)
        
        return {
            "period_days": days,
            "total_records": len(records),
            "hourly_stats": hourly_stats,
            "peak_hours": peak_hours,
            "valley_hours": valley_hours,
            "chronotype": chronotype,
            "recommendations": self._generate_circadian_recommendations(chronotype, peak_hours, valley_hours)
        }
    
    def analyze_weekly_pattern(self, weeks: int = 8) -> Dict[str, Any]:
        """
        分析周周期模式
        
        返回:
        - 星期几的活动分布
        - 工作日 vs 周末对比
        - 每周最佳/最差日
        """
        start_date = datetime.now() - timedelta(weeks=weeks)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        # 按星期几统计
        weekday_stats: Dict[int, Dict] = {i: {"count": 0, "scores": []} for i in range(7)}
        
        for record in records:
            if record.created_at:
                weekday = record.created_at.weekday()
                weekday_stats[weekday]["count"] += 1
                
                if record.dimension_scores:
                    avg_score = sum(record.dimension_scores.values()) / len(record.dimension_scores)
                    weekday_stats[weekday]["scores"].append(avg_score)
        
        # 计算每天的平均分
        weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        result = {}
        
        for day, stats in weekday_stats.items():
            avg_score = sum(stats["scores"]) / len(stats["scores"]) if stats["scores"] else 50
            result[day] = {
                "name": weekday_names[day],
                "count": stats["count"],
                "avg_score": round(avg_score, 1),
                "is_weekend": day >= 5
            }
        
        # 工作日 vs 周末
        weekday_scores = [result[d]["avg_score"] for d in range(5)]
        weekend_scores = [result[d]["avg_score"] for d in range(5, 7)]
        
        weekday_avg = sum(weekday_scores) / len(weekday_scores) if weekday_scores else 50
        weekend_avg = sum(weekend_scores) / len(weekend_scores) if weekend_scores else 50
        
        # 找出最佳/最差日
        best_day = max(result.items(), key=lambda x: x[1]["avg_score"])
        worst_day = min(result.items(), key=lambda x: x[1]["avg_score"])
        
        return {
            "period_weeks": weeks,
            "daily_stats": result,
            "weekday_avg": round(weekday_avg, 1),
            "weekend_avg": round(weekend_avg, 1),
            "best_day": {"day": best_day[1]["name"], "score": best_day[1]["avg_score"]},
            "worst_day": {"day": worst_day[1]["name"], "score": worst_day[1]["avg_score"]},
            "weekend_boost": round(weekend_avg - weekday_avg, 1)
        }
    
    def analyze_monthly_pattern(self, months: int = 6) -> Dict[str, Any]:
        """
        分析月度周期模式
        
        返回:
        - 每月各周的表现
        - 月初/月中/月末对比
        - 季节性趋势
        """
        start_date = datetime.now() - timedelta(days=months * 30)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        # 按月份日期分组
        day_of_month_stats: Dict[str, List[float]] = {
            "early": [],    # 1-10
            "mid": [],      # 11-20
            "late": []      # 21-31
        }
        
        monthly_stats: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "scores": []})
        
        for record in records:
            if record.created_at:
                day = record.created_at.day
                month_key = record.created_at.strftime("%Y-%m")
                
                monthly_stats[month_key]["count"] += 1
                
                if record.dimension_scores:
                    avg_score = sum(record.dimension_scores.values()) / len(record.dimension_scores)
                    monthly_stats[month_key]["scores"].append(avg_score)
                    
                    if day <= 10:
                        day_of_month_stats["early"].append(avg_score)
                    elif day <= 20:
                        day_of_month_stats["mid"].append(avg_score)
                    else:
                        day_of_month_stats["late"].append(avg_score)
        
        # 计算月度平均
        monthly_result = {}
        for month, stats in sorted(monthly_stats.items()):
            avg_score = sum(stats["scores"]) / len(stats["scores"]) if stats["scores"] else 50
            monthly_result[month] = {
                "count": stats["count"],
                "avg_score": round(avg_score, 1)
            }
        
        # 计算月初/月中/月末平均
        period_avgs = {}
        for period, scores in day_of_month_stats.items():
            period_avgs[period] = round(sum(scores) / len(scores), 1) if scores else 50
        
        return {
            "period_months": months,
            "monthly_stats": monthly_result,
            "period_of_month": {
                "early": {"name": "月初 (1-10日)", "avg_score": period_avgs["early"]},
                "mid": {"name": "月中 (11-20日)", "avg_score": period_avgs["mid"]},
                "late": {"name": "月末 (21-31日)", "avg_score": period_avgs["late"]}
            }
        }
    
    def get_bio_clock_profile(self) -> Dict[str, Any]:
        """
        生成个人生物钟画像
        
        综合分析用户的：
        - 最佳工作时段
        - 理想睡眠窗口
        - 运动最佳时间
        - 社交高峰期
        """
        circadian = self.analyze_circadian_rhythm(60)  # 用60天数据
        weekly = self.analyze_weekly_pattern(12)       # 用12周数据
        
        # 分析各类活动的时间分布
        activity_times = self._analyze_activity_times()
        
        chronotype_info = CHRONOTYPE.get(circadian["chronotype"], CHRONOTYPE["bear"])
        
        return {
            "chronotype": {
                "type": circadian["chronotype"],
                "name": chronotype_info["name"],
                "description": chronotype_info["description"]
            },
            "optimal_times": {
                "focus_work": self._get_optimal_focus_time(circadian),
                "exercise": activity_times.get("ACTIVITY", {"best_hour": 17, "label": "下午5点"}),
                "sleep": self._get_optimal_sleep_time(circadian),
                "social": activity_times.get("SOCIAL", {"best_hour": 19, "label": "晚上7点"}),
                "meals": {
                    "breakfast": activity_times.get("breakfast", {"best_hour": 8, "label": "早上8点"}),
                    "lunch": activity_times.get("lunch", {"best_hour": 12, "label": "中午12点"}),
                    "dinner": activity_times.get("dinner", {"best_hour": 19, "label": "晚上7点"})
                }
            },
            "weekly_pattern": {
                "best_day": weekly["best_day"],
                "worst_day": weekly["worst_day"],
                "weekend_boost": weekly["weekend_boost"]
            },
            "peak_hours": circadian["peak_hours"],
            "recommendations": circadian["recommendations"]
        }
    
    def get_hourly_distribution(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        获取24小时活动分布数据（用于环形图）
        """
        circadian = self.analyze_circadian_rhythm(days)
        
        result = []
        for hour in range(24):
            stats = circadian["hourly_stats"].get(hour, {})
            result.append({
                "hour": hour,
                "label": f"{hour:02d}:00",
                "count": stats.get("count", 0),
                "activity_level": stats.get("activity_level", 0),
                "avg_score": stats.get("avg_score", 50),
                "top_category": stats.get("top_category")
            })
        
        return result
    
    def get_heatmap_data(self, year: Optional[int] = None) -> Dict[str, Any]:
        """
        获取年度热力图数据
        
        返回每天的活动计数和平均分数
        """
        if year is None:
            year = datetime.now().year
        
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.created_at < end_date
            )
        ).all()
        
        # 按日期聚合
        daily_data: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "scores": []})
        
        for record in records:
            if record.created_at:
                date_key = record.created_at.strftime("%Y-%m-%d")
                daily_data[date_key]["count"] += 1
                
                if record.dimension_scores:
                    avg_score = sum(record.dimension_scores.values()) / len(record.dimension_scores)
                    daily_data[date_key]["scores"].append(avg_score)
        
        # 生成完整年份数据
        result = []
        current = start_date
        while current < end_date and current <= datetime.now():
            date_key = current.strftime("%Y-%m-%d")
            data = daily_data.get(date_key, {"count": 0, "scores": []})
            
            avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else None
            
            result.append({
                "date": date_key,
                "count": data["count"],
                "avg_score": round(avg_score, 1) if avg_score else None,
                "weekday": current.weekday(),
                "week": current.isocalendar()[1]
            })
            
            current += timedelta(days=1)
        
        return {
            "year": year,
            "data": result,
            "total_days": len([d for d in result if d["count"] > 0]),
            "total_records": sum(d["count"] for d in result)
        }
    
    # ========== 辅助方法 ==========
    
    def _empty_circadian_result(self) -> Dict[str, Any]:
        """返回空的昼夜节律结果"""
        return {
            "period_days": 0,
            "total_records": 0,
            "hourly_stats": {h: {"count": 0, "avg_score": 50, "activity_level": 0} for h in range(24)},
            "peak_hours": [],
            "valley_hours": [],
            "chronotype": "bear",
            "recommendations": []
        }
    
    def _normalize_activity(self, count: int, max_count: int) -> float:
        """归一化活动级别 (0-100)"""
        if max_count == 0:
            return 0
        return round((count / max_count) * 100, 1)
    
    def _find_peak_hours(self, hourly_counts: Dict[int, int]) -> List[int]:
        """找出活动高峰时段"""
        if not hourly_counts:
            return []
        
        avg = sum(hourly_counts.values()) / len(hourly_counts)
        threshold = avg * 1.3
        
        peak_hours = [h for h, c in hourly_counts.items() if c >= threshold]
        return sorted(peak_hours)
    
    def _find_valley_hours(self, hourly_counts: Dict[int, int]) -> List[int]:
        """找出活动低谷时段"""
        if not hourly_counts:
            return []
        
        avg = sum(hourly_counts.values()) / len(hourly_counts)
        threshold = avg * 0.5
        
        valley_hours = [h for h, c in hourly_counts.items() if c <= threshold and c > 0]
        return sorted(valley_hours)
    
    def _infer_chronotype(self, peak_hours: List[int]) -> str:
        """根据高峰时段推断生物钟类型"""
        if not peak_hours:
            return "bear"
        
        avg_peak = sum(peak_hours) / len(peak_hours)
        
        if avg_peak < 10:
            return "lion"
        elif avg_peak < 14:
            return "bear"
        elif avg_peak < 20:
            return "wolf"
        else:
            return "dolphin"
    
    def _generate_circadian_recommendations(
        self,
        chronotype: str,
        peak_hours: List[int],
        valley_hours: List[int]
    ) -> List[str]:
        """生成基于昼夜节律的建议"""
        recommendations = []
        
        chronotype_tips = {
            "lion": [
                "你是早起型，建议把重要工作安排在上午",
                "下午可能精力下降，适合做轻松任务",
                "晚上9点后避免重要决策"
            ],
            "bear": [
                "你的节律跟随太阳，中午前后效率最高",
                "建议固定作息，保持规律",
                "午休15-20分钟可以提升下午效率"
            ],
            "wolf": [
                "你是夜猫子类型，下午到晚间效率最高",
                "早晨可能较难集中，建议安排简单任务",
                "创意工作适合放在晚间"
            ],
            "dolphin": [
                "你的睡眠较浅，建议分段式工作",
                "避免长时间高强度，适当休息",
                "可以尝试多个短睡眠周期"
            ]
        }
        
        recommendations.extend(chronotype_tips.get(chronotype, []))
        
        if peak_hours:
            peak_str = ", ".join([f"{h}:00" for h in peak_hours[:3]])
            recommendations.append(f"你的活跃高峰在 {peak_str}，适合安排重要任务")
        
        return recommendations
    
    def _analyze_activity_times(self) -> Dict[str, Dict]:
        """分析各类活动的最佳时间"""
        start_date = datetime.now() - timedelta(days=60)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        # 按类别统计时间分布
        category_hours: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
        
        for record in records:
            if record.created_at and record.category:
                hour = record.created_at.hour
                category_hours[record.category][hour] += 1
        
        result = {}
        for category, hours in category_hours.items():
            if hours:
                best_hour = max(hours, key=hours.get)
                result[category] = {
                    "best_hour": best_hour,
                    "label": f"{best_hour}:00"
                }
        
        return result
    
    def _get_optimal_focus_time(self, circadian: Dict) -> Dict:
        """获取最佳专注工作时间"""
        peak_hours = circadian.get("peak_hours", [])
        
        # 找出工作时间内的高峰
        work_peaks = [h for h in peak_hours if 8 <= h <= 18]
        
        if work_peaks:
            best_hour = work_peaks[0]
        else:
            best_hour = 10  # 默认
        
        return {
            "best_hour": best_hour,
            "label": f"{best_hour}:00",
            "duration": "2-3小时"
        }
    
    def _get_optimal_sleep_time(self, circadian: Dict) -> Dict:
        """获取最佳睡眠时间窗口"""
        chronotype = circadian.get("chronotype", "bear")
        
        sleep_windows = {
            "lion": {"bedtime": "21:00", "waketime": "05:00"},
            "bear": {"bedtime": "22:30", "waketime": "06:30"},
            "wolf": {"bedtime": "00:00", "waketime": "08:00"},
            "dolphin": {"bedtime": "23:30", "waketime": "06:00"}
        }
        
        return sleep_windows.get(chronotype, sleep_windows["bear"])


    def get_emotion_trend(self, days: int = 30) -> Dict[str, Any]:
        """
        获取情绪趋势数据（用于河流图/面积图）
        
        返回每天各维度的得分趋势
        """
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).order_by(LifeStream.created_at).all()
        
        # 按日期聚合各维度得分
        daily_dimensions: Dict[str, Dict[str, List[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        
        dimensions = ["body", "mood", "social", "work", "growth", "meaning", "digital", "leisure"]
        
        for record in records:
            if record.created_at and record.dimension_scores:
                date_key = record.created_at.strftime("%Y-%m-%d")
                for dim in dimensions:
                    if dim in record.dimension_scores:
                        daily_dimensions[date_key][dim].append(record.dimension_scores[dim])
        
        # 生成完整日期序列
        result = []
        current = datetime.now() - timedelta(days=days)
        end = datetime.now()
        
        while current <= end:
            date_key = current.strftime("%Y-%m-%d")
            day_data = {"date": date_key}
            
            if date_key in daily_dimensions:
                for dim in dimensions:
                    scores = daily_dimensions[date_key].get(dim, [])
                    day_data[dim] = round(sum(scores) / len(scores), 1) if scores else None
            else:
                for dim in dimensions:
                    day_data[dim] = None
            
            result.append(day_data)
            current += timedelta(days=1)
        
        return {
            "period_days": days,
            "dimensions": dimensions,
            "data": result
        }
    
    def get_mood_distribution(self, days: int = 30) -> Dict[str, Any]:
        """
        获取心情分布数据
        
        统计各心情状态的出现频率
        """
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.category == "MOOD"
            )
        ).all()
        
        # 从标签中提取心情关键词
        mood_keywords = {
            "开心": ["开心", "快乐", "高兴", "愉快", "兴奋"],
            "平静": ["平静", "放松", "安宁", "淡定"],
            "焦虑": ["焦虑", "紧张", "担心", "不安"],
            "疲惫": ["累", "疲惫", "疲劳", "困"],
            "沮丧": ["沮丧", "难过", "伤心", "失落"],
            "满足": ["满足", "充实", "成就"],
        }
        
        mood_counts: Dict[str, int] = defaultdict(int)
        
        for record in records:
            if record.tags:
                for tag in record.tags:
                    for mood, keywords in mood_keywords.items():
                        if any(kw in tag for kw in keywords):
                            mood_counts[mood] += 1
                            break
            
            # 也从 raw_content 中提取
            if record.raw_content:
                for mood, keywords in mood_keywords.items():
                    if any(kw in record.raw_content for kw in keywords):
                        mood_counts[mood] += 1
                        break
        
        total = sum(mood_counts.values()) or 1
        
        return {
            "period_days": days,
            "total_mood_records": len(records),
            "distribution": [
                {
                    "mood": mood,
                    "count": count,
                    "percentage": round(count / total * 100, 1)
                }
                for mood, count in sorted(mood_counts.items(), key=lambda x: x[1], reverse=True)
            ]
        }


# 全局单例
_time_intelligence: Optional[TimeIntelligence] = None


def get_time_intelligence() -> TimeIntelligence:
    """获取 TimeIntelligence 单例"""
    global _time_intelligence
    if _time_intelligence is None:
        _time_intelligence = TimeIntelligence()
    return _time_intelligence
