"""预测 & 异常检测系统

核心功能：
1. 次日 Vibe 预测 - 基于历史模式预测明天的状态
2. 异常模式检测 - 识别偏离正常模式的行为
3. 因果归因分析 - 分析影响状态的关键因素
4. What-if 模拟 - 模拟不同行为的影响

增强版 v0.2:
- AI 驱动的预测分析
- 更精准的异常检测
- 个性化健康建议
- 智能风险评估
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, date
from collections import defaultdict
import statistics
import json
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import LifeStream, DailySummary

logger = logging.getLogger(__name__)


class Predictor:
    """预测与异常检测器"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def predict_tomorrow_vibe(self) -> Dict[str, Any]:
        """
        预测明天的 Vibe Score
        
        基于:
        - 同星期几的历史表现
        - 最近7天趋势
        - 今日活动影响
        """
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        tomorrow_weekday = tomorrow.weekday()
        
        # 获取历史同星期几数据
        historical_scores = self._get_historical_weekday_scores(tomorrow_weekday, weeks=8)
        
        # 获取最近7天趋势
        recent_trend = self._get_recent_trend(7)
        
        # 获取今日因素
        today_factors = self._analyze_today_factors()
        
        # 计算预测分数
        base_score = 50  # 默认基准
        
        if historical_scores:
            base_score = statistics.mean(historical_scores)
        
        # 趋势调整
        trend_adjustment = 0
        if recent_trend["direction"] == "up":
            trend_adjustment = min(recent_trend["strength"] * 2, 10)
        elif recent_trend["direction"] == "down":
            trend_adjustment = -min(recent_trend["strength"] * 2, 10)
        
        # 今日因素调整
        factor_adjustment = self._calculate_factor_adjustment(today_factors)
        
        predicted_score = base_score + trend_adjustment + factor_adjustment
        predicted_score = max(0, min(100, predicted_score))
        
        # 置信度
        confidence = self._calculate_confidence(len(historical_scores), recent_trend)
        
        return {
            "predicted_date": tomorrow.isoformat(),
            "predicted_score": round(predicted_score, 1),
            "confidence": confidence,
            "base_score": round(base_score, 1),
            "adjustments": {
                "trend": round(trend_adjustment, 1),
                "today_factors": round(factor_adjustment, 1)
            },
            "factors": today_factors,
            "historical_reference": {
                "weekday": self._weekday_name(tomorrow_weekday),
                "avg_score": round(base_score, 1),
                "sample_size": len(historical_scores)
            },
            "recent_trend": recent_trend
        }
    
    def detect_anomalies(self, days: int = 30) -> Dict[str, Any]:
        """
        检测异常模式
        
        识别:
        - 突然的分数波动
        - 异常的时间模式
        - 偏离常规的行为
        """
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).order_by(LifeStream.created_at).all()
        
        if len(records) < 7:
            return {"anomalies": [], "message": "数据不足，无法进行异常检测"}
        
        anomalies = []
        
        # 1. 检测分数异常
        score_anomalies = self._detect_score_anomalies(records)
        anomalies.extend(score_anomalies)
        
        # 2. 检测时间模式异常
        time_anomalies = self._detect_time_anomalies(records)
        anomalies.extend(time_anomalies)
        
        # 3. 检测活动频率异常
        frequency_anomalies = self._detect_frequency_anomalies(records)
        anomalies.extend(frequency_anomalies)
        
        # 按严重程度排序
        anomalies.sort(key=lambda x: x.get("severity", 0), reverse=True)
        
        return {
            "period_days": days,
            "total_records": len(records),
            "anomaly_count": len(anomalies),
            "anomalies": anomalies[:10]  # 返回前10个
        }
    
    def analyze_causation(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        因果归因分析
        
        分析影响当日状态的关键因素
        """
        if target_date is None:
            target_date = datetime.now().date()
        
        # 获取目标日期的数据
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_time,
                LifeStream.created_at < end_time
            )
        ).all()
        
        # 获取前一天的数据用于对比
        prev_start = start_time - timedelta(days=1)
        prev_end = start_time
        
        prev_records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= prev_start,
                LifeStream.created_at < prev_end
            )
        ).all()
        
        # 分析各因素的影响
        factors = []
        
        # 睡眠因素
        sleep_impact = self._analyze_sleep_impact(records, prev_records)
        if sleep_impact:
            factors.append(sleep_impact)
        
        # 饮食因素
        diet_impact = self._analyze_diet_impact(records)
        if diet_impact:
            factors.append(diet_impact)
        
        # 运动因素
        activity_impact = self._analyze_activity_impact(records)
        if activity_impact:
            factors.append(activity_impact)
        
        # 社交因素
        social_impact = self._analyze_social_impact(records)
        if social_impact:
            factors.append(social_impact)
        
        # 屏幕时间因素
        screen_impact = self._analyze_screen_impact(records)
        if screen_impact:
            factors.append(screen_impact)
        
        # 按影响力排序
        factors.sort(key=lambda x: abs(x.get("impact_score", 0)), reverse=True)
        
        # 计算总体评价
        total_positive = sum(f["impact_score"] for f in factors if f["impact_score"] > 0)
        total_negative = sum(f["impact_score"] for f in factors if f["impact_score"] < 0)
        
        return {
            "date": target_date.isoformat(),
            "record_count": len(records),
            "factors": factors,
            "summary": {
                "positive_impact": round(total_positive, 1),
                "negative_impact": round(total_negative, 1),
                "net_impact": round(total_positive + total_negative, 1)
            },
            "top_positive": factors[0] if factors and factors[0]["impact_score"] > 0 else None,
            "top_negative": next((f for f in factors if f["impact_score"] < 0), None)
        }
    
    def what_if_simulation(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """
        What-if 模拟
        
        模拟不同行为选择的影响
        
        scenario 示例:
        {
            "sleep_hours": 8,
            "exercise_minutes": 30,
            "caffeine_after_2pm": False,
            "screen_hours": 4
        }
        """
        base_score = 50
        adjustments = []
        
        # 睡眠影响
        sleep_hours = scenario.get("sleep_hours")
        if sleep_hours is not None:
            if 7 <= sleep_hours <= 9:
                adj = 10
                adjustments.append({"factor": "睡眠", "impact": adj, "reason": "理想睡眠时长"})
            elif sleep_hours < 6:
                adj = -15
                adjustments.append({"factor": "睡眠", "impact": adj, "reason": "睡眠不足"})
            elif sleep_hours > 9:
                adj = -5
                adjustments.append({"factor": "睡眠", "impact": adj, "reason": "睡眠过多"})
            else:
                adj = 5
                adjustments.append({"factor": "睡眠", "impact": adj, "reason": "睡眠基本充足"})
            base_score += adj
        
        # 运动影响
        exercise_minutes = scenario.get("exercise_minutes")
        if exercise_minutes is not None:
            if exercise_minutes >= 30:
                adj = 12
                adjustments.append({"factor": "运动", "impact": adj, "reason": "充足运动"})
            elif exercise_minutes > 0:
                adj = 5
                adjustments.append({"factor": "运动", "impact": adj, "reason": "有运动"})
            else:
                adj = -5
                adjustments.append({"factor": "运动", "impact": adj, "reason": "缺乏运动"})
            base_score += adj
        
        # 咖啡因影响
        caffeine_after_2pm = scenario.get("caffeine_after_2pm")
        if caffeine_after_2pm is not None:
            if caffeine_after_2pm:
                adj = -8
                adjustments.append({"factor": "咖啡因", "impact": adj, "reason": "下午摄入咖啡因可能影响睡眠"})
            else:
                adj = 3
                adjustments.append({"factor": "咖啡因", "impact": adj, "reason": "避免下午咖啡因"})
            base_score += adj
        
        # 屏幕时间影响
        screen_hours = scenario.get("screen_hours")
        if screen_hours is not None:
            if screen_hours <= 4:
                adj = 8
                adjustments.append({"factor": "屏幕时间", "impact": adj, "reason": "健康屏幕时间"})
            elif screen_hours <= 6:
                adj = 0
                adjustments.append({"factor": "屏幕时间", "impact": adj, "reason": "中等屏幕时间"})
            else:
                adj = -10
                adjustments.append({"factor": "屏幕时间", "impact": adj, "reason": "过多屏幕时间"})
            base_score += adj
        
        predicted_score = max(0, min(100, base_score))
        
        return {
            "scenario": scenario,
            "predicted_score": round(predicted_score, 1),
            "adjustments": adjustments,
            "recommendations": self._generate_recommendations(adjustments)
        }
    
    def get_health_alerts(self) -> List[Dict[str, Any]]:
        """
        获取健康提醒
        
        基于近期数据生成个性化提醒
        """
        alerts = []
        
        # 检查最近的睡眠模式
        sleep_alert = self._check_sleep_pattern()
        if sleep_alert:
            alerts.append(sleep_alert)
        
        # 检查运动频率
        activity_alert = self._check_activity_pattern()
        if activity_alert:
            alerts.append(activity_alert)
        
        # 检查屏幕时间趋势
        screen_alert = self._check_screen_pattern()
        if screen_alert:
            alerts.append(screen_alert)
        
        # 检查情绪趋势
        mood_alert = self._check_mood_pattern()
        if mood_alert:
            alerts.append(mood_alert)
        
        return alerts
    
    # ========== 辅助方法 ==========
    
    def _get_historical_weekday_scores(self, weekday: int, weeks: int) -> List[float]:
        """获取历史同星期几的分数"""
        scores = []
        
        for i in range(1, weeks + 1):
            target_date = datetime.now().date() - timedelta(weeks=i)
            # 调整到目标星期几
            days_diff = (target_date.weekday() - weekday) % 7
            target_date = target_date - timedelta(days=days_diff)
            
            # 查询该日期的记录
            start_time = datetime.combine(target_date, datetime.min.time())
            end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
            
            records = self.db.query(LifeStream).filter(
                and_(
                    LifeStream.created_at >= start_time,
                    LifeStream.created_at < end_time
                )
            ).all()
            
            if records:
                day_scores = []
                for r in records:
                    if r.dimension_scores:
                        avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                        day_scores.append(avg)
                
                if day_scores:
                    scores.append(statistics.mean(day_scores))
        
        return scores
    
    def _get_recent_trend(self, days: int) -> Dict[str, Any]:
        """获取最近的趋势"""
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).order_by(LifeStream.created_at).all()
        
        if len(records) < 3:
            return {"direction": "stable", "strength": 0}
        
        # 按天计算平均分
        daily_scores: Dict[str, List[float]] = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        if len(daily_scores) < 2:
            return {"direction": "stable", "strength": 0}
        
        # 计算趋势
        sorted_days = sorted(daily_scores.keys())
        first_half = sorted_days[:len(sorted_days)//2]
        second_half = sorted_days[len(sorted_days)//2:]
        
        first_avg = statistics.mean([
            statistics.mean(daily_scores[d]) for d in first_half if daily_scores[d]
        ]) if first_half else 50
        
        second_avg = statistics.mean([
            statistics.mean(daily_scores[d]) for d in second_half if daily_scores[d]
        ]) if second_half else 50
        
        diff = second_avg - first_avg
        
        if diff > 3:
            return {"direction": "up", "strength": min(abs(diff), 15)}
        elif diff < -3:
            return {"direction": "down", "strength": min(abs(diff), 15)}
        else:
            return {"direction": "stable", "strength": 0}
    
    def _analyze_today_factors(self) -> List[Dict[str, Any]]:
        """分析今日因素"""
        today = datetime.now().date()
        start_time = datetime.combine(today, datetime.min.time())
        end_time = datetime.now()
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_time,
                LifeStream.created_at < end_time
            )
        ).all()
        
        factors = []
        
        # 按类别统计
        category_counts: Dict[str, int] = defaultdict(int)
        for r in records:
            if r.category:
                category_counts[r.category] += 1
        
        # 检查睡眠记录
        if category_counts.get("SLEEP", 0) > 0:
            factors.append({"type": "sleep", "status": "recorded", "impact": "positive"})
        
        # 检查运动记录
        if category_counts.get("ACTIVITY", 0) > 0:
            factors.append({"type": "exercise", "status": "active", "impact": "positive"})
        
        # 检查饮食中的咖啡因
        for r in records:
            if r.category == "DIET" and r.meta_data:
                caffeine = r.meta_data.get("caffeine_mg", 0)
                if caffeine and r.created_at.hour >= 14:
                    factors.append({"type": "caffeine", "status": "late_intake", "impact": "negative"})
                    break
        
        return factors
    
    def _calculate_factor_adjustment(self, factors: List[Dict]) -> float:
        """计算因素调整值"""
        adjustment = 0
        
        for f in factors:
            if f.get("impact") == "positive":
                adjustment += 3
            elif f.get("impact") == "negative":
                adjustment -= 5
        
        return adjustment
    
    def _calculate_confidence(self, sample_size: int, trend: Dict) -> str:
        """计算置信度"""
        if sample_size >= 6 and trend["strength"] < 5:
            return "high"
        elif sample_size >= 3:
            return "medium"
        else:
            return "low"
    
    def _weekday_name(self, weekday: int) -> str:
        """获取星期几名称"""
        names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        return names[weekday]
    
    def _detect_score_anomalies(self, records: List[LifeStream]) -> List[Dict]:
        """检测分数异常"""
        anomalies = []
        
        # 按天计算分数
        daily_scores: Dict[str, List[float]] = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        if len(daily_scores) < 3:
            return anomalies
        
        # 计算统计值
        all_daily_avgs = [statistics.mean(scores) for scores in daily_scores.values() if scores]
        
        if len(all_daily_avgs) < 3:
            return anomalies
        
        mean_score = statistics.mean(all_daily_avgs)
        std_score = statistics.stdev(all_daily_avgs) if len(all_daily_avgs) > 1 else 10
        
        # 检测异常
        for date_str, scores in daily_scores.items():
            day_avg = statistics.mean(scores)
            z_score = (day_avg - mean_score) / std_score if std_score > 0 else 0
            
            if abs(z_score) > 2:
                anomalies.append({
                    "type": "score_deviation",
                    "date": date_str,
                    "value": round(day_avg, 1),
                    "expected": round(mean_score, 1),
                    "deviation": round(z_score, 2),
                    "severity": min(abs(z_score), 3),
                    "description": f"{'异常高分' if z_score > 0 else '异常低分'}: {round(day_avg, 1)} (平均 {round(mean_score, 1)})"
                })
        
        return anomalies
    
    def _detect_time_anomalies(self, records: List[LifeStream]) -> List[Dict]:
        """检测时间模式异常"""
        anomalies = []
        
        # 统计每小时的活动
        hourly_counts: Dict[int, int] = defaultdict(int)
        
        for r in records:
            if r.created_at:
                hourly_counts[r.created_at.hour] += 1
        
        # 检测深夜活动
        late_night_count = sum(hourly_counts.get(h, 0) for h in [0, 1, 2, 3, 4])
        total_count = sum(hourly_counts.values())
        
        if total_count > 0 and late_night_count / total_count > 0.15:
            anomalies.append({
                "type": "late_night_activity",
                "value": late_night_count,
                "percentage": round(late_night_count / total_count * 100, 1),
                "severity": 2,
                "description": f"深夜活动偏多 ({round(late_night_count / total_count * 100, 1)}%)"
            })
        
        return anomalies
    
    def _detect_frequency_anomalies(self, records: List[LifeStream]) -> List[Dict]:
        """检测活动频率异常"""
        anomalies = []
        
        # 按天统计活动数量
        daily_counts: Dict[str, int] = defaultdict(int)
        
        for r in records:
            if r.created_at:
                date_key = r.created_at.strftime("%Y-%m-%d")
                daily_counts[date_key] += 1
        
        if len(daily_counts) < 3:
            return anomalies
        
        counts = list(daily_counts.values())
        mean_count = statistics.mean(counts)
        std_count = statistics.stdev(counts) if len(counts) > 1 else mean_count / 2
        
        # 检测记录过少的日子
        for date_str, count in daily_counts.items():
            if count < mean_count - 2 * std_count and count < mean_count * 0.3:
                anomalies.append({
                    "type": "low_activity",
                    "date": date_str,
                    "value": count,
                    "expected": round(mean_count, 1),
                    "severity": 1,
                    "description": f"活动记录偏少: {count}条 (平均 {round(mean_count, 1)}条)"
                })
        
        return anomalies
    
    def _analyze_sleep_impact(self, records, prev_records) -> Optional[Dict]:
        """分析睡眠对当日的影响"""
        sleep_records = [r for r in prev_records if r.category == "SLEEP"]
        
        if not sleep_records:
            return None
        
        # 简化分析
        return {
            "factor": "睡眠",
            "impact_score": 5 if sleep_records else -5,
            "description": f"前一天有 {len(sleep_records)} 条睡眠记录",
            "recommendation": "保持规律睡眠"
        }
    
    def _analyze_diet_impact(self, records) -> Optional[Dict]:
        """分析饮食影响"""
        diet_records = [r for r in records if r.category == "DIET"]
        
        if not diet_records:
            return None
        
        return {
            "factor": "饮食",
            "impact_score": 3,
            "description": f"今日 {len(diet_records)} 条饮食记录",
            "recommendation": "注意营养均衡"
        }
    
    def _analyze_activity_impact(self, records) -> Optional[Dict]:
        """分析运动影响"""
        activity_records = [r for r in records if r.category == "ACTIVITY"]
        
        if activity_records:
            return {
                "factor": "运动",
                "impact_score": 8,
                "description": f"今日 {len(activity_records)} 条运动记录",
                "recommendation": "继续保持运动习惯"
            }
        else:
            return {
                "factor": "运动",
                "impact_score": -3,
                "description": "今日暂无运动记录",
                "recommendation": "建议增加适量运动"
            }
    
    def _analyze_social_impact(self, records) -> Optional[Dict]:
        """分析社交影响"""
        social_records = [r for r in records if r.category == "SOCIAL"]
        
        if social_records:
            return {
                "factor": "社交",
                "impact_score": 5,
                "description": f"今日 {len(social_records)} 条社交记录",
                "recommendation": "社交互动有助心理健康"
            }
        
        return None
    
    def _analyze_screen_impact(self, records) -> Optional[Dict]:
        """分析屏幕时间影响"""
        screen_records = [r for r in records if r.category == "SCREEN"]
        
        if screen_records:
            total_hours = 0
            for r in screen_records:
                if r.meta_data:
                    total_hours += r.meta_data.get("screen_hours", 0)
            
            if total_hours > 6:
                return {
                    "factor": "屏幕时间",
                    "impact_score": -8,
                    "description": f"今日屏幕时间约 {total_hours:.1f} 小时，偏多",
                    "recommendation": "适当减少屏幕时间"
                }
            elif total_hours > 0:
                return {
                    "factor": "屏幕时间",
                    "impact_score": 0,
                    "description": f"今日屏幕时间约 {total_hours:.1f} 小时",
                    "recommendation": "保持合理屏幕时间"
                }
        
        return None
    
    def _generate_recommendations(self, adjustments: List[Dict]) -> List[str]:
        """基于调整生成建议"""
        recommendations = []
        
        for adj in adjustments:
            if adj["impact"] < 0:
                if adj["factor"] == "睡眠":
                    recommendations.append("尝试增加睡眠时间到7-9小时")
                elif adj["factor"] == "咖啡因":
                    recommendations.append("避免下午2点后摄入咖啡因")
                elif adj["factor"] == "屏幕时间":
                    recommendations.append("设定屏幕时间限制，每小时休息5分钟")
                elif adj["factor"] == "运动":
                    recommendations.append("每天至少进行30分钟中等强度运动")
        
        return recommendations
    
    def _check_sleep_pattern(self) -> Optional[Dict]:
        """检查睡眠模式"""
        # 获取最近7天的睡眠记录
        start_date = datetime.now() - timedelta(days=7)
        
        sleep_records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.category == "SLEEP"
            )
        ).all()
        
        if len(sleep_records) < 3:
            return {
                "type": "sleep",
                "level": "info",
                "icon": "😴",
                "title": "睡眠记录不足",
                "message": "最近7天只有 {} 条睡眠记录，建议每天记录睡眠情况".format(len(sleep_records)),
                "suggestion": "养成每天记录睡眠的习惯，有助于了解作息规律"
            }
        
        # 检查睡眠时间是否规律（记录时间的标准差）
        sleep_hours = []
        for r in sleep_records:
            if r.created_at:
                sleep_hours.append(r.created_at.hour)
        
        if sleep_hours and len(sleep_hours) >= 3:
            avg_hour = sum(sleep_hours) / len(sleep_hours)
            variance = sum((h - avg_hour) ** 2 for h in sleep_hours) / len(sleep_hours)
            std_dev = variance ** 0.5
            
            if std_dev > 3:
                return {
                    "type": "sleep",
                    "level": "warning",
                    "icon": "⏰",
                    "title": "作息不规律",
                    "message": "睡眠时间波动较大（标准差 {:.1f} 小时），建议固定作息".format(std_dev),
                    "suggestion": "尝试每天在相同时间入睡，有助于提高睡眠质量"
                }
            
            # 检查是否睡得太晚
            late_count = sum(1 for h in sleep_hours if h >= 1 and h <= 6)
            if late_count >= 3:
                return {
                    "type": "sleep",
                    "level": "warning",
                    "icon": "🌙",
                    "title": "熬夜较多",
                    "message": "最近7天有 {} 次凌晨后才睡觉".format(late_count),
                    "suggestion": "尽量在23点前入睡，保证充足睡眠"
                }
        
        return None
    
    def _check_activity_pattern(self) -> Optional[Dict]:
        """检查运动模式"""
        start_date = datetime.now() - timedelta(days=7)
        
        activity_records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.category == "ACTIVITY"
            )
        ).all()
        
        activity_count = len(activity_records)
        
        if activity_count == 0:
            return {
                "type": "activity",
                "level": "warning",
                "icon": "🏃",
                "title": "缺乏运动",
                "message": "最近7天没有运动记录",
                "suggestion": "每天30分钟中等强度运动可以显著提升身心状态"
            }
        elif activity_count < 3:
            return {
                "type": "activity",
                "level": "info",
                "icon": "💪",
                "title": "运动可以更多",
                "message": "最近7天只有 {} 次运动记录".format(activity_count),
                "suggestion": "建议每周至少运动3-5次，每次30分钟以上"
            }
        
        return None
    
    def _check_screen_pattern(self) -> Optional[Dict]:
        """检查屏幕时间模式"""
        start_date = datetime.now() - timedelta(days=7)
        
        screen_records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.category == "SCREEN"
            )
        ).all()
        
        if not screen_records:
            return None
        
        # 统计总屏幕时间
        total_hours = 0
        days_with_data = set()
        
        for r in screen_records:
            if r.meta_data and r.meta_data.get("screen_hours"):
                total_hours += r.meta_data.get("screen_hours", 0)
            if r.created_at:
                days_with_data.add(r.created_at.date())
        
        if days_with_data:
            avg_daily = total_hours / len(days_with_data)
            
            if avg_daily > 8:
                return {
                    "type": "screen",
                    "level": "warning",
                    "icon": "📱",
                    "title": "屏幕时间过长",
                    "message": "日均屏幕时间约 {:.1f} 小时，建议控制在6小时以内".format(avg_daily),
                    "suggestion": "设置屏幕时间限制，每使用1小时休息5-10分钟"
                }
            elif avg_daily > 6:
                return {
                    "type": "screen",
                    "level": "info",
                    "icon": "👀",
                    "title": "注意屏幕时间",
                    "message": "日均屏幕时间约 {:.1f} 小时".format(avg_daily),
                    "suggestion": "适当减少非必要的屏幕使用，多进行户外活动"
                }
        
        # 检查深夜使用屏幕
        late_screen = sum(1 for r in screen_records if r.created_at and r.created_at.hour >= 23)
        if late_screen >= 3:
            return {
                "type": "screen",
                "level": "warning",
                "icon": "🌃",
                "title": "睡前屏幕使用",
                "message": "最近有 {} 次深夜使用屏幕的记录".format(late_screen),
                "suggestion": "睡前1小时避免使用电子设备，有助于改善睡眠质量"
            }
        
        return None
    
    def _check_mood_pattern(self) -> Optional[Dict]:
        """检查情绪模式"""
        start_date = datetime.now() - timedelta(days=7)
        
        mood_records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_date,
                LifeStream.category == "MOOD"
            )
        ).all()
        
        if len(mood_records) < 3:
            return {
                "type": "mood",
                "level": "info",
                "icon": "😊",
                "title": "记录你的心情",
                "message": "最近心情记录较少",
                "suggestion": "定期记录心情有助于情绪觉察和管理"
            }
        
        # 分析心情标签
        negative_keywords = ["焦虑", "紧张", "担心", "压力", "烦躁", "沮丧", "难过", "累", "疲惫", "失眠", "不安"]
        positive_keywords = ["开心", "快乐", "满足", "放松", "平静", "充实", "愉快", "期待"]
        
        negative_count = 0
        positive_count = 0
        
        for r in mood_records:
            content = (r.raw_content or "") + " " + " ".join(r.tags or [])
            
            for kw in negative_keywords:
                if kw in content:
                    negative_count += 1
                    break
            
            for kw in positive_keywords:
                if kw in content:
                    positive_count += 1
                    break
        
        if negative_count >= 4 and negative_count > positive_count:
            return {
                "type": "mood",
                "level": "warning",
                "icon": "💭",
                "title": "情绪需要关注",
                "message": "最近负面情绪记录较多（{} 条）".format(negative_count),
                "suggestion": "尝试运动、冥想或与朋友交流，必要时寻求专业帮助"
            }
        
        # 检查情绪维度得分
        mood_scores = []
        for r in mood_records:
            if r.dimension_scores and "mood" in r.dimension_scores:
                mood_scores.append(r.dimension_scores["mood"])
        
        if mood_scores:
            avg_mood = sum(mood_scores) / len(mood_scores)
            if avg_mood < 40:
                return {
                    "type": "mood",
                    "level": "warning",
                    "icon": "🫂",
                    "title": "情绪状态偏低",
                    "message": "最近情绪维度平均得分 {:.0f}".format(avg_mood),
                    "suggestion": "关注自己的情绪健康，做一些让自己开心的事情"
                }
        
        return None
    
    # ========== AI 增强功能 v0.2 ==========
    
    async def ai_predict_tomorrow(self) -> Dict[str, Any]:
        """
        AI 驱动的次日预测
        
        结合历史数据和 AI 分析，给出更精准的预测
        """
        from app.services.ai_client import get_ai_client, AIClientError
        
        # 获取基础预测
        base_prediction = self.predict_tomorrow_vibe()
        
        # 获取最近的记录摘要
        recent_summary = self._get_recent_summary(7)
        
        if not recent_summary["has_data"]:
            return {
                **base_prediction,
                "ai_enhanced": False,
                "message": "数据不足，使用基础预测"
            }
        
        try:
            ai_client = get_ai_client()
            
            prompt = f"""基于以下用户数据，预测明天的状态并给出建议。

基础预测分数: {base_prediction['predicted_score']}
近7天数据摘要:
{json.dumps(recent_summary, ensure_ascii=False, indent=2)}

请分析:
1. 基于数据模式，明天状态的可能范围
2. 影响明天状态的关键因素
3. 提升明天状态的具体建议

返回JSON格式:
{{
    "adjusted_score": 预测分数（保持原分数或微调），
    "confidence": "high/medium/low",
    "key_factors": ["因素1", "因素2"],
    "improvement_tips": ["建议1", "建议2"],
    "risk_factors": ["风险1"] 或 [],
    "morning_suggestion": "早晨的一句话建议"
}}"""
            
            result = await ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": "你是一个生活状态预测专家。基于用户的历史数据模式进行预测。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=3000,
                task_type="ai_prediction",
                task_description="AI 次日预测",
                json_response=True,
            )
            
            ai_result = result["content"]
            
            if isinstance(ai_result, dict):
                return {
                    **base_prediction,
                    "ai_enhanced": True,
                    "ai_analysis": ai_result,
                    "predicted_score": ai_result.get("adjusted_score", base_prediction["predicted_score"]),
                }
            else:
                raise ValueError("AI 返回格式错误")
                
        except Exception as e:
            logger.error(f"AI 预测错误: {e}")
            return {
                **base_prediction,
                "ai_enhanced": False,
                "error": str(e)
            }
    
    async def ai_detect_risks(self) -> Dict[str, Any]:
        """
        AI 驱动的风险检测
        
        分析近期数据，识别潜在的健康风险
        """
        from app.services.ai_client import get_ai_client, AIClientError
        
        # 获取健康提醒
        alerts = self.get_health_alerts()
        
        # 获取异常检测
        anomalies = self.detect_anomalies(14)
        
        # 获取近期数据摘要
        recent_summary = self._get_recent_summary(14)
        
        if not recent_summary["has_data"]:
            return {
                "has_data": False,
                "alerts": alerts,
                "message": "数据不足"
            }
        
        try:
            ai_client = get_ai_client()
            
            prompt = f"""分析以下用户数据，识别潜在的健康风险和需要关注的模式。

系统检测到的告警: {json.dumps(alerts, ensure_ascii=False)}
异常检测结果: {json.dumps(anomalies.get('anomalies', [])[:5], ensure_ascii=False)}
近期数据摘要: {json.dumps(recent_summary, ensure_ascii=False)}

请分析:
1. 综合风险评估
2. 需要立即关注的问题
3. 长期需要注意的趋势
4. 预防建议

返回JSON格式:
{{
    "risk_level": "low/medium/high",
    "risk_score": 0-100,
    "immediate_concerns": ["关注点1", "关注点2"] 或 [],
    "long_term_trends": ["趋势1", "趋势2"] 或 [],
    "preventive_suggestions": ["建议1", "建议2"],
    "positive_notes": ["积极方面1", "积极方面2"]
}}"""
            
            result = await ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": "你是一个健康风险分析专家。提供客观、有建设性的分析，避免过度担忧。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=3000,
                task_type="risk_detection",
                task_description="AI 风险检测",
                json_response=True,
            )
            
            ai_result = result["content"]
            
            if isinstance(ai_result, dict):
                return {
                    "has_data": True,
                    "ai_analysis": ai_result,
                    "system_alerts": alerts,
                    "anomaly_count": anomalies.get("anomaly_count", 0)
                }
            else:
                raise ValueError("AI 返回格式错误")
                
        except Exception as e:
            logger.error(f"AI 风险检测错误: {e}")
            return {
                "has_data": True,
                "ai_analysis": None,
                "system_alerts": alerts,
                "error": str(e)
            }
    
    def _get_recent_summary(self, days: int) -> Dict[str, Any]:
        """获取近期数据摘要"""
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date
        ).all()
        
        if len(records) < 5:
            return {"has_data": False}
        
        # 统计各类别
        category_counts = defaultdict(int)
        dimension_scores = defaultdict(list)
        
        for r in records:
            if r.category:
                category_counts[r.category] += 1
            if r.dimension_scores:
                for dim, score in r.dimension_scores.items():
                    dimension_scores[dim].append(score)
        
        # 计算维度平均分
        dim_avgs = {}
        for dim, scores in dimension_scores.items():
            if scores:
                dim_avgs[dim] = round(sum(scores) / len(scores), 1)
        
        return {
            "has_data": True,
            "period_days": days,
            "total_records": len(records),
            "category_distribution": dict(category_counts),
            "dimension_averages": dim_avgs,
        }


# 全局单例
_predictor: Optional[Predictor] = None


def get_predictor() -> Predictor:
    """获取 Predictor 单例"""
    global _predictor
    if _predictor is None:
        _predictor = Predictor()
    return _predictor
