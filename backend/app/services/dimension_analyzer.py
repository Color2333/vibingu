"""八维度生活模型分析器

评分策略（优先级）：
1. LLM 驱动：由 DataExtractor 在分析记录时直接输出维度评分（推荐）
2. 规则引擎 Fallback：当 LLM 未返回评分时，使用基于分类/元数据/标签的规则计算

八大维度：
1. 身体 (Body) - 睡眠、饮食、运动
2. 心情 (Mood) - 情绪状态、心理健康
3. 社交 (Social) - 人际关系、社会支持
4. 工作 (Work) - 成就感、生产力
5. 成长 (Growth) - 学习、技能提升
6. 意义 (Meaning) - 价值感、目标感
7. 数字 (Digital) - 屏幕时间、数字健康
8. 休闲 (Leisure) - 心流体验、娱乐放松
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import SessionLocal

logger = logging.getLogger(__name__)

# 维度定义
DIMENSIONS = {
    "body": {
        "name": "身体",
        "icon": "💪",
        "description": "睡眠质量、饮食健康、运动活力",
        "categories": ["SLEEP", "DIET", "ACTIVITY"],
        "weight": 0.15
    },
    "mood": {
        "name": "心情",
        "icon": "😊",
        "description": "情绪状态、心理平衡",
        "categories": ["MOOD"],
        "weight": 0.15
    },
    "social": {
        "name": "社交",
        "icon": "👥",
        "description": "人际互动、情感连接",
        "categories": ["SOCIAL"],
        "weight": 0.12
    },
    "work": {
        "name": "工作",
        "icon": "💼",
        "description": "成就感、生产力",
        "categories": ["WORK"],
        "weight": 0.13
    },
    "growth": {
        "name": "成长",
        "icon": "📚",
        "description": "学习进步、技能提升",
        "categories": ["GROWTH"],
        "weight": 0.12
    },
    "meaning": {
        "name": "意义",
        "icon": "🎯",
        "description": "价值感、目标导向",
        "categories": [],
        "weight": 0.10
    },
    "digital": {
        "name": "数字",
        "icon": "📱",
        "description": "屏幕时间、数字平衡",
        "categories": ["SCREEN"],
        "weight": 0.11
    },
    "leisure": {
        "name": "休闲",
        "icon": "🎮",
        "description": "心流体验、放松恢复",
        "categories": ["LEISURE"],
        "weight": 0.12
    }
}

# 分类 → 主维度映射
CATEGORY_TO_DIMENSION = {
    "SLEEP": "body",
    "DIET": "body",
    "ACTIVITY": "body",
    "MOOD": "mood",
    "SOCIAL": "social",
    "WORK": "work",
    "GROWTH": "growth",
    "SCREEN": "digital",
    "LEISURE": "leisure",
}

# 分类 → 次要维度影响（带默认增益）
CATEGORY_SECONDARY = {
    "SLEEP": {"mood": 15},
    "ACTIVITY": {"mood": 15, "leisure": 10},
    "SOCIAL": {"mood": 15, "meaning": 10},
    "GROWTH": {"meaning": 20, "work": 10},
    "LEISURE": {"mood": 10, "meaning": 5},
    "WORK": {"growth": 10},
}


class DimensionAnalyzer:
    """八维度分析器
    
    主要作为 LLM 评分失败时的 fallback。
    日常评分优先使用 DataExtractor 的 LLM 输出。
    """
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def calculate_dimension_scores(
        self,
        category: str,
        meta_data: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        sub_categories: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """
        规则引擎评分（LLM 未返回时的 fallback）
        
        策略：基于分类给主维度基础分 → 副分类补充分 → 次要维度小幅加分 → 元数据微调
        """
        scores = {dim: 0.0 for dim in DIMENSIONS.keys()}
        
        # 1. 主维度基础分
        primary_dim = CATEGORY_TO_DIMENSION.get(category)
        if primary_dim:
            scores[primary_dim] = 65  # 基础分
        
        # 1.5 副分类补充分（每个副分类给对应维度 30 分）
        if sub_categories:
            for sc in sub_categories:
                sc_dim = CATEGORY_TO_DIMENSION.get(sc)
                if sc_dim and scores[sc_dim] < 30:
                    scores[sc_dim] = 30
                # 副分类的次要维度也加一点
                for dim, bonus in CATEGORY_SECONDARY.get(sc, {}).items():
                    scores[dim] += bonus * 0.5
        
        # 2. 次要维度加分
        for dim, bonus in CATEGORY_SECONDARY.get(category, {}).items():
            scores[dim] += bonus
        
        # 3. 元数据微调
        if meta_data:
            scores = self._adjust_by_metadata(scores, category, meta_data)
        
        # 4. 意义维度综合计算
        scores["meaning"] = max(scores["meaning"], self._calc_meaning(scores))
        
        # 归一化到 0-100
        for dim in scores:
            scores[dim] = max(0, min(100, scores[dim]))
        
        return scores
    
    def _adjust_by_metadata(
        self,
        scores: Dict[str, float],
        category: str,
        meta_data: Dict
    ) -> Dict[str, float]:
        """根据元数据微调评分"""
        
        if category == "SLEEP":
            duration = meta_data.get("duration_hours", 7)
            if isinstance(duration, (int, float)):
                if 7 <= duration <= 9:
                    scores["body"] += 20
                elif duration < 6:
                    scores["body"] -= 10
                    scores["mood"] -= 5
            
            quality = meta_data.get("quality", "")
            if quality == "good":
                scores["body"] += 10
                scores["mood"] += 10
            elif quality == "poor":
                scores["body"] -= 5
                scores["mood"] -= 10
        
        elif category == "DIET":
            is_healthy = meta_data.get("is_healthy")
            if is_healthy is True:
                scores["body"] += 15
            elif is_healthy is False:
                scores["body"] -= 5
        
        elif category == "ACTIVITY":
            duration = meta_data.get("duration_minutes", 0)
            if isinstance(duration, (int, float)) and duration >= 30:
                scores["body"] += 15
                scores["mood"] += 5
        
        elif category == "SCREEN":
            total_minutes = meta_data.get("total_minutes", 0)
            if isinstance(total_minutes, (int, float)):
                if total_minutes <= 120:
                    scores["digital"] += 25  # 屏幕时间短=高分
                elif total_minutes >= 360:
                    scores["digital"] -= 20  # 过长=低分
        
        return scores
    
    @staticmethod
    def _calc_meaning(scores: Dict[str, float]) -> float:
        """意义维度 = 其他有价值维度的加权综合"""
        return (
            scores.get("growth", 0) * 0.30 +
            scores.get("social", 0) * 0.20 +
            scores.get("work", 0) * 0.20 +
            scores.get("leisure", 0) * 0.15 +
            scores.get("mood", 0) * 0.15
        )
    
    def get_daily_dimension_summary(
        self,
        date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """获取某日的八维度汇总（聚合所有记录的维度分数）"""
        from app.models.life_stream import LifeStream
        
        if date is None:
            date = datetime.now()
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_of_day,
                LifeStream.created_at < end_of_day
            )
        ).all()
        
        # 聚合各维度分数
        dimension_totals = {dim: [] for dim in DIMENSIONS.keys()}
        
        for record in records:
            if record.dimension_scores:
                for dim, score in record.dimension_scores.items():
                    if dim in dimension_totals and score > 0:
                        dimension_totals[dim].append(score)
        
        # 计算各维度平均分
        result = {}
        for dim, dim_info in DIMENSIONS.items():
            dim_scores = dimension_totals[dim]
            avg_score = sum(dim_scores) / len(dim_scores) if dim_scores else 50
            result[dim] = {
                "name": dim_info["name"],
                "icon": dim_info["icon"],
                "score": round(avg_score, 1),
                "record_count": len(dim_scores)
            }
        
        # 计算综合 Vibe Score
        total_weight = sum(d["weight"] for d in DIMENSIONS.values())
        vibe_score = sum(
            result[dim]["score"] * DIMENSIONS[dim]["weight"]
            for dim in DIMENSIONS.keys()
        ) / total_weight
        
        return {
            "date": date.strftime("%Y-%m-%d"),
            "vibe_score": round(vibe_score, 1),
            "dimensions": result,
            "record_count": len(records)
        }
    
    def get_dimension_radar_data(
        self,
        date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """获取雷达图数据格式"""
        summary = self.get_daily_dimension_summary(date)
        
        radar_data = []
        for dim, info in DIMENSIONS.items():
            radar_data.append({
                "dimension": info["name"],
                "score": summary["dimensions"][dim]["score"],
                "fullMark": 100
            })
        
        return radar_data


# 全局单例
_analyzer: Optional[DimensionAnalyzer] = None


def get_dimension_analyzer() -> DimensionAnalyzer:
    """获取 DimensionAnalyzer 单例"""
    global _analyzer
    if _analyzer is None:
        _analyzer = DimensionAnalyzer()
    return _analyzer
