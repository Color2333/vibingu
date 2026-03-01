"""
Vibing Index 计算服务

两种计算模式：
1. LLM 驱动（推荐）：聚合当日所有记录的 LLM dimension_scores，加权计算
2. 规则引擎 Fallback：当 LLM 评分缺失时，使用传统的分类规则计算

八维度权重：
- body: 15%  - mood: 15%  - social: 12%  - work: 13%
- growth: 12% - meaning: 10% - digital: 11% - leisure: 12%
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import LifeStream, DailySummary
from app.services.dimension_analyzer import DIMENSIONS

logger = logging.getLogger(__name__)


class VibeCalculator:
    """Vibing Index 计算器 — LLM 驱动 + 规则引擎 Fallback"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_daily_vibe(self, target_date: date) -> Dict[str, Any]:
        """
        计算指定日期的 Vibing Index
        
        优先从 LLM 维度评分聚合，缺失时 fallback 到规则引擎
        """
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
                "dimension_averages": None,
                "insights": [],
                "record_count": 0,
                "scoring_mode": "none",
            }
        
        # 尝试 LLM 驱动模式：聚合所有记录的 dimension_scores
        llm_scored_records = [
            r for r in records
            if r.dimension_scores and isinstance(r.dimension_scores, dict) and len(r.dimension_scores) >= 4
        ]
        
        if llm_scored_records and len(llm_scored_records) >= len(records) * 0.5:
            # 超过一半记录有 LLM 评分 → 使用 LLM 模式
            return self._calculate_from_dimensions(records, llm_scored_records, target_date)
        else:
            # Fallback 到规则引擎
            logger.info(f"Vibe {target_date}: LLM 评分不足({len(llm_scored_records)}/{len(records)})，使用规则引擎")
            return self._calculate_from_rules(records, target_date)
    
    def calculate_vibe_from_records(self, records: list) -> Optional[int]:
        """
        从已加载的记录列表计算 vibe score，不发起额外 DB 查询。
        用于 trend API 批量计算场景。
        """
        if not records:
            return None
        
        llm_scored_records = [
            r for r in records
            if r.dimension_scores and isinstance(r.dimension_scores, dict) and len(r.dimension_scores) >= 4
        ]
        
        if llm_scored_records and len(llm_scored_records) >= len(records) * 0.5:
            # LLM 模式：加权平均
            dim_totals: Dict[str, list] = {dim: [] for dim in DIMENSIONS}
            for record in llm_scored_records:
                for dim, score in record.dimension_scores.items():
                    if dim in dim_totals and isinstance(score, (int, float)) and score > 0:
                        dim_totals[dim].append(float(score))
            
            dim_averages = {}
            for dim in DIMENSIONS:
                scores = dim_totals[dim]
                dim_averages[dim] = sum(scores) / len(scores) if scores else 50.0
            
            total_weight = sum(d["weight"] for d in DIMENSIONS.values())
            vibe_score = sum(
                dim_averages[dim] * DIMENSIONS[dim]["weight"]
                for dim in DIMENSIONS
            ) / total_weight
            return round(vibe_score)
        else:
            # 规则引擎 fallback：简化计算
            def _cat_match(r, cat):
                if r.category == cat:
                    return True
                if r.sub_categories and cat in r.sub_categories:
                    return True
                return False
            
            WEIGHTS = {"sleep": 0.40, "diet": 0.25, "screen": 0.20, "activity": 0.15}
            scores = {
                "sleep": self._rule_sleep_score([r for r in records if _cat_match(r, "SLEEP")]),
                "diet": self._rule_diet_score([r for r in records if _cat_match(r, "DIET")]),
                "screen": self._rule_screen_score([r for r in records if _cat_match(r, "SCREEN")]),
                "activity": self._rule_activity_score([r for r in records if _cat_match(r, "ACTIVITY")]),
            }
            valid_scores = {k: v for k, v in scores.items() if v is not None}
            if not valid_scores:
                return None
            total_weight = sum(WEIGHTS[k] for k in valid_scores)
            return round(sum(v * (WEIGHTS[k] / total_weight) for k, v in valid_scores.items()))
    def _calculate_from_dimensions(
        self,
        all_records: List[LifeStream],
        scored_records: List[LifeStream],
        target_date: date,
    ) -> Dict[str, Any]:
        """LLM 驱动模式：从维度评分聚合计算 Vibe Score"""
        
        # 聚合各维度分数
        dim_totals: Dict[str, List[float]] = {dim: [] for dim in DIMENSIONS}
        
        for record in scored_records:
            for dim, score in record.dimension_scores.items():
                if dim in dim_totals and isinstance(score, (int, float)) and score > 0:
                    dim_totals[dim].append(float(score))
        
        # 各维度平均分
        dim_averages = {}
        for dim, dim_info in DIMENSIONS.items():
            scores = dim_totals[dim]
            dim_averages[dim] = round(sum(scores) / len(scores), 1) if scores else 50.0
        
        # 加权计算 Vibe Score
        total_weight = sum(d["weight"] for d in DIMENSIONS.values())
        vibe_score = sum(
            dim_averages[dim] * DIMENSIONS[dim]["weight"]
            for dim in DIMENSIONS
        ) / total_weight
        
        # 生成洞察
        insights = self._generate_dimension_insights(dim_averages, all_records)
        
        return {
            "vibe_score": round(vibe_score),
            "dimension_averages": dim_averages,
            "insights": insights,
            "record_count": len(all_records),
            "scoring_mode": "llm",
        }
    
    def _calculate_from_rules(
        self,
        records: List[LifeStream],
        target_date: date,
    ) -> Dict[str, Any]:
        """规则引擎 Fallback：传统分类加权计算"""
        
        # 旧版权重
        WEIGHTS = {"sleep": 0.40, "diet": 0.25, "screen": 0.20, "activity": 0.15}
        
        def _cat_match(r, cat):
            if r.category == cat:
                return True
            if r.sub_categories and cat in r.sub_categories:
                return True
            return False
        
        sleep_records = [r for r in records if _cat_match(r, "SLEEP")]
        diet_records = [r for r in records if _cat_match(r, "DIET")]
        screen_records = [r for r in records if _cat_match(r, "SCREEN")]
        activity_records = [r for r in records if _cat_match(r, "ACTIVITY")]
        
        sleep_score = self._rule_sleep_score(sleep_records)
        diet_score = self._rule_diet_score(diet_records)
        screen_score = self._rule_screen_score(screen_records)
        activity_score = self._rule_activity_score(activity_records)
        
        scores = {
            "sleep": sleep_score,
            "diet": diet_score,
            "screen": screen_score,
            "activity": activity_score,
        }
        
        valid_scores = {k: v for k, v in scores.items() if v is not None}
        
        if not valid_scores:
            vibe_score = None
        else:
            total_weight = sum(WEIGHTS[k] for k in valid_scores)
            vibe_score = round(sum(v * (WEIGHTS[k] / total_weight) for k, v in valid_scores.items()))
        
        insights = self._generate_rule_insights(scores, records)
        
        return {
            "vibe_score": vibe_score,
            "dimension_averages": None,
            "insights": insights,
            "record_count": len(records),
            "scoring_mode": "rules",
        }
    
    # ========== LLM 模式的洞察生成 ==========
    
    def _generate_dimension_insights(
        self,
        dim_averages: Dict[str, float],
        records: List[LifeStream],
    ) -> List[str]:
        """基于维度分数生成洞察"""
        insights = []
        
        # 找出最高和最低维度
        sorted_dims = sorted(dim_averages.items(), key=lambda x: x[1], reverse=True)
        best_dim = sorted_dims[0]
        worst_dim = sorted_dims[-1]
        
        dim_names = {d: DIMENSIONS[d]["name"] for d in DIMENSIONS}
        
        if best_dim[1] >= 75:
            insights.append(f"「{dim_names[best_dim[0]]}」维度表现出色（{best_dim[1]}分）")
        
        if worst_dim[1] < 40 and worst_dim[1] > 0:
            insights.append(f"「{dim_names[worst_dim[0]]}」维度需要关注（{worst_dim[1]}分）")
        
        # 特定维度洞察
        if dim_averages.get("body", 50) < 50:
            insights.append("身体维度偏低，注意休息和运动")
        if dim_averages.get("mood", 50) < 40:
            insights.append("情绪状态不太好，试试做一些让自己开心的事")
        if dim_averages.get("digital", 50) < 40:
            insights.append("屏幕时间可能过长，记得让眼睛休息")
        if dim_averages.get("social", 0) >= 70:
            insights.append("社交活跃，人际关系维护得不错")
        
        # 记录数量提示
        if len(records) >= 5:
            insights.append(f"今天记录了 {len(records)} 条，生活记录习惯很好！")
        
        return insights[:5]  # 最多 5 条
    
    # ========== 规则引擎 Fallback 方法 ==========
    
    def _rule_sleep_score(self, records: List[LifeStream]) -> Optional[int]:
        """规则引擎：睡眠分数"""
        if not records:
            return None
        
        total_hours = 0
        quality_scores = []
        
        for r in records:
            if r.meta_data:
                hours = r.meta_data.get("sleep_hours") or r.meta_data.get("sleep_duration") or r.meta_data.get("duration_hours")
                if hours:
                    try:
                        total_hours += float(hours)
                    except (ValueError, TypeError):
                        pass
                quality = r.meta_data.get("sleep_score") or r.meta_data.get("sleep_quality") or r.meta_data.get("score")
                if quality:
                    try:
                        quality_scores.append(float(quality))
                    except (ValueError, TypeError):
                        pass
        
        if quality_scores:
            return round(sum(quality_scores) / len(quality_scores))
        
        if total_hours > 0:
            if 7 <= total_hours <= 8.5:
                return 90
            elif 6 <= total_hours < 7:
                return 70
            elif total_hours < 6:
                return max(30, int(total_hours / 6 * 60))
            else:
                return max(60, int(100 - (total_hours - 8.5) * 10))
        
        return 60
    
    def _rule_diet_score(self, records: List[LifeStream]) -> Optional[int]:
        """规则引擎：饮食分数"""
        if not records:
            return None
        
        healthy_count = 0
        unhealthy_count = 0
        
        for r in records:
            if r.meta_data:
                is_healthy = r.meta_data.get("is_healthy")
                if is_healthy is True:
                    healthy_count += 1
                elif is_healthy is False:
                    unhealthy_count += 1
        
        score = 70
        if healthy_count > unhealthy_count:
            score += min(25, (healthy_count - unhealthy_count) * 10)
        elif unhealthy_count > healthy_count:
            score -= min(20, (unhealthy_count - healthy_count) * 10)
        
        return max(0, min(100, score))
    
    def _rule_screen_score(self, records: List[LifeStream]) -> Optional[int]:
        """规则引擎：屏幕时间分数"""
        if not records:
            return None
        
        total_minutes = 0
        for r in records:
            if r.meta_data:
                mins = r.meta_data.get("total_minutes") or r.meta_data.get("screen_minutes")
                if mins:
                    try:
                        total_minutes += float(mins)
                    except (ValueError, TypeError):
                        pass
        
        if total_minutes == 0:
            return 70
        
        total_hours = total_minutes / 60
        if total_hours <= 3:
            return 90
        elif total_hours <= 5:
            return 70
        elif total_hours <= 7:
            return 50
        else:
            return max(20, int(50 - (total_hours - 7) * 10))
    
    def _rule_activity_score(self, records: List[LifeStream]) -> Optional[int]:
        """规则引擎：活动分数"""
        if not records:
            return None
        return min(100, 70 + len(records) * 10)
    
    def _generate_rule_insights(
        self,
        scores: Dict[str, Optional[int]],
        records: List[LifeStream],
    ) -> List[str]:
        """规则引擎洞察"""
        insights = []
        
        if scores.get("sleep") is not None:
            if scores["sleep"] < 60:
                insights.append("睡眠质量偏低，建议今晚早点休息")
            elif scores["sleep"] >= 90:
                insights.append("睡眠状态很棒，继续保持！")
        
        if scores.get("diet") is not None and scores["diet"] < 60:
            insights.append("今天的饮食可能不太健康，注意营养均衡")
        
        if scores.get("screen") is not None and scores["screen"] < 50:
            insights.append("屏幕时间过长，记得让眼睛休息一下")
        
        if scores.get("activity") is None:
            insights.append("今天还没有活动记录，起来动一动吧")
        elif scores["activity"] >= 80:
            insights.append("运动做得不错！")
        
        return insights
    
    # ========== Daily Summary 更新 ==========
    
    def update_daily_summary(self, target_date: date) -> DailySummary:
        """更新指定日期的 daily_summary"""
        vibe_data = self.calculate_daily_vibe(target_date)
        
        summary = self.db.query(DailySummary).filter(
            DailySummary.date == target_date
        ).first()
        
        if not summary:
            summary = DailySummary(date=target_date)
            self.db.add(summary)
        
        summary.vibe_score = vibe_data["vibe_score"]
        
        if vibe_data["insights"]:
            summary.daily_summary_text = " | ".join(vibe_data["insights"])
        
        self.db.commit()
        self.db.refresh(summary)
        
        return summary
