"""八维度生活模型分析器

基于理论框架：
- PERMA+ (积极心理学)
- SDT 自我决定理论
- 生命之轮
- 数字健康

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
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import SessionLocal


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
        "categories": [],  # 从多个维度综合
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


class DimensionAnalyzer:
    """八维度分析器"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def calculate_dimension_scores(
        self,
        category: str,
        meta_data: Optional[Dict] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """
        根据单条记录计算对各维度的贡献分数
        
        Args:
            category: 记录分类
            meta_data: 记录元数据
            tags: 标签列表
            
        Returns:
            各维度的贡献分数 (0-100)
        """
        scores = {dim: 0.0 for dim in DIMENSIONS.keys()}
        
        # 基于分类的直接贡献
        category_to_dimension = {
            "SLEEP": "body",
            "DIET": "body",
            "ACTIVITY": "body",
            "MOOD": "mood",
            "SOCIAL": "social",
            "WORK": "work",
            "GROWTH": "growth",
            "SCREEN": "digital",
            "LEISURE": "leisure"
        }
        
        primary_dim = category_to_dimension.get(category)
        if primary_dim:
            scores[primary_dim] = 70  # 基础分
        
        # 基于 meta_data 调整分数
        if meta_data:
            scores = self._adjust_by_metadata(scores, category, meta_data)
        
        # 基于标签调整分数
        if tags:
            scores = self._adjust_by_tags(scores, tags)
        
        # 计算意义维度（综合其他维度）
        scores["meaning"] = self._calculate_meaning_score(scores, meta_data)
        
        return scores
    
    def _adjust_by_metadata(
        self,
        scores: Dict[str, float],
        category: str,
        meta_data: Dict
    ) -> Dict[str, float]:
        """根据元数据调整分数"""
        
        if category == "SLEEP":
            # 睡眠评估
            duration = meta_data.get("duration_hours", 7)
            quality = meta_data.get("quality", "normal")
            
            if 7 <= duration <= 9:
                scores["body"] += 20
            elif duration < 6:
                scores["body"] -= 10
            
            if quality == "good":
                scores["body"] += 10
                scores["mood"] += 15
            elif quality == "poor":
                scores["mood"] -= 10
        
        elif category == "DIET":
            # 饮食评估
            is_healthy = meta_data.get("is_healthy", True)
            has_caffeine = meta_data.get("caffeine_mg", 0) > 0
            
            if is_healthy:
                scores["body"] += 15
            else:
                scores["body"] -= 5
            
            if has_caffeine and datetime.now().hour >= 15:
                scores["body"] -= 5  # 下午咖啡因可能影响睡眠
        
        elif category == "ACTIVITY":
            # 运动评估
            duration = meta_data.get("duration_minutes", 30)
            intensity = meta_data.get("intensity", "moderate")
            
            if duration >= 30:
                scores["body"] += 20
                scores["mood"] += 10
            
            if intensity == "high":
                scores["body"] += 10
        
        elif category == "GROWTH":
            # 学习/成长评估
            scores["meaning"] += 20
            scores["mood"] += 10
        
        elif category == "SOCIAL":
            # 社交评估
            quality = meta_data.get("quality", "good")
            if quality == "good":
                scores["mood"] += 15
                scores["meaning"] += 10
        
        # 确保分数在 0-100 范围内
        for dim in scores:
            scores[dim] = max(0, min(100, scores[dim]))
        
        return scores
    
    def _adjust_by_tags(
        self,
        scores: Dict[str, float],
        tags: List[str]
    ) -> Dict[str, float]:
        """根据标签调整分数"""
        
        # 正面标签增益
        positive_tags = {
            "#心情/开心": ("mood", 15),
            "#心情/满足": ("mood", 10),
            "#心情/平静": ("mood", 10),
            "#身体/精力充沛": ("body", 15),
            "#成长/学习": ("growth", 15),
            "#习惯/好习惯": ("meaning", 10),
            "#社交/朋友": ("social", 15),
            "#社交/家人": ("social", 15),
        }
        
        # 负面标签减益
        negative_tags = {
            "#心情/焦虑": ("mood", -15),
            "#心情/烦躁": ("mood", -10),
            "#心情/沮丧": ("mood", -20),
            "#身体/疲劳": ("body", -15),
            "#工作/拖延": ("work", -15),
            "#习惯/坏习惯": ("meaning", -10),
        }
        
        for tag in tags:
            if tag in positive_tags:
                dim, value = positive_tags[tag]
                scores[dim] += value
            elif tag in negative_tags:
                dim, value = negative_tags[tag]
                scores[dim] += value
        
        # 确保分数在 0-100 范围内
        for dim in scores:
            scores[dim] = max(0, min(100, scores[dim]))
        
        return scores
    
    def _calculate_meaning_score(
        self,
        scores: Dict[str, float],
        meta_data: Optional[Dict]
    ) -> float:
        """计算意义维度分数（综合指标）"""
        # 意义 = 成长贡献 + 社交贡献 + 工作贡献的加权平均
        meaning_base = (
            scores.get("growth", 0) * 0.3 +
            scores.get("social", 0) * 0.2 +
            scores.get("work", 0) * 0.2 +
            scores.get("leisure", 0) * 0.15 +
            scores.get("mood", 0) * 0.15
        )
        
        return min(100, max(0, meaning_base))
    
    def get_daily_dimension_summary(
        self,
        date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """获取某日的八维度汇总"""
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
            scores = dimension_totals[dim]
            avg_score = sum(scores) / len(scores) if scores else 50  # 默认 50 分
            result[dim] = {
                "name": dim_info["name"],
                "icon": dim_info["icon"],
                "score": round(avg_score, 1),
                "record_count": len(scores)
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
