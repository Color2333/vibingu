"""智能标签服务 - Tagger Agent

增强版功能:
1. AI 驱动的语义标签生成
2. 标签关系发现和推荐
3. 标签趋势分析
4. 智能标签补全
"""
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import json

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import get_settings
from app.database import SessionLocal
from app.models import LifeStream

logger = logging.getLogger(__name__)

settings = get_settings()


class TaggerAgent:
    """智能标签生成器
    
    功能:
    - 基于内容语义生成标签
    - 发现标签之间的关联关系
    - 推荐常用/相关标签
    - 分析标签使用趋势
    """
    
    def __init__(self):
        from app.services.ai_client import get_ai_client
        self.ai_client = get_ai_client()
        
        # 标签层级结构 (8维度对应 PERMA-V 模型)
        self.tag_hierarchy = {
            # 身体维度 (Body/Vitality)
            "身体": ["睡眠", "运动", "休息", "疲劳", "精力充沛", "健身", "跑步", "散步", "瑜伽"],
            # 饮食子维度
            "饮食": ["早餐", "午餐", "晚餐", "零食", "咖啡", "茶", "酒", "水果", "外卖", "自己做"],
            # 情绪维度 (Mood/Positive Emotion)
            "心情": ["开心", "平静", "焦虑", "烦躁", "沮丧", "兴奋", "满足", "感恩", "压力", "放松"],
            # 社交维度 (Social/Relationships)
            "社交": ["独处", "家人", "朋友", "同事", "约会", "聚会", "通话", "聊天"],
            # 效能维度 (Work/Engagement)
            "工作": ["会议", "专注", "创作", "沟通", "学习", "拖延", "高效", "加班", "摸鱼"],
            # 成长维度 (Growth/Competence)
            "成长": ["阅读", "学习", "技能", "反思", "思考", "输出", "课程", "新知识"],
            # 意义维度 (Meaning)
            "意义": ["目标", "计划", "复盘", "感悟", "价值", "贡献"],
            # 数字维度 (Digital Wellness)
            "数字": ["屏幕时间", "社交媒体", "游戏", "刷手机", "数字排毒"],
            # 休闲维度 (Leisure)
            "休闲": ["电影", "音乐", "游戏", "旅行", "爱好", "娱乐", "逛街", "宅家"],
            # 时间标签
            "时间": ["早晨", "上午", "中午", "下午", "傍晚", "晚间", "深夜", "凌晨"],
            # 习惯追踪
            "习惯": ["好习惯", "坏习惯", "打卡", "挑战", "突破", "坚持"],
        }
        
        # 标签权重 (用于推荐排序)
        self._tag_weights: Dict[str, float] = {}
        
        # 标签共现矩阵缓存
        self._co_occurrence: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._co_occurrence_loaded = False
    
    async def generate_tags(
        self,
        text: Optional[str] = None,
        category: Optional[str] = None,
        meta_data: Optional[Dict] = None,
        record_id: Optional[str] = None,
        include_recommendations: bool = False,
    ) -> List[str]:
        """
        为记录生成智能标签
        
        Args:
            text: 原始文本内容
            category: 记录分类
            meta_data: 记录元数据
            record_id: 关联的记录 ID
            include_recommendations: 是否包含推荐标签
            
        Returns:
            标签列表，格式为 "#类别/标签名"
        """
        try:
            tags = await self._ai_generate_tags(text, category, meta_data, record_id)
            
            # 如果需要推荐，添加相关标签
            if include_recommendations and tags:
                related = await self.get_related_tags(tags[:3])
                for tag in related[:2]:
                    if tag not in tags:
                        tags.append(tag)
            
            return tags[:8]  # 最多8个标签
            
        except Exception as e:
            logger.warning(f"AI 标签生成错误: {e}")
            return self._rule_based_tags(text, category, meta_data)
    
    async def _ai_generate_tags(
        self,
        text: Optional[str],
        category: Optional[str],
        meta_data: Optional[Dict],
        record_id: Optional[str],
    ) -> List[str]:
        """使用 AI 生成标签"""
        
        current_hour = datetime.now().hour
        time_period = self._get_time_period(current_hour)
        
        # 获取最近常用标签作为参考
        recent_tags = await self.get_trending_tags(days=7, limit=10)
        recent_tags_str = ", ".join(recent_tags) if recent_tags else "无"
        
        system_prompt = f"""你是一个智能标签生成器。根据用户的生活记录，生成相关的标签。

标签格式：#类别/标签名

可用类别（基于 PERMA-V 生活维度模型）：
- 身体: 睡眠、运动、休息、疲劳、精力充沛等
- 饮食: 早餐、午餐、晚餐、零食、咖啡等
- 心情: 开心、平静、焦虑、满足、压力等
- 社交: 独处、家人、朋友、同事等
- 工作: 会议、专注、创作、学习等
- 成长: 阅读、学习、技能、反思等
- 意义: 目标、计划、复盘、感悟等
- 数字: 屏幕时间、社交媒体等
- 休闲: 电影、音乐、游戏、旅行等
- 时间: 早晨、上午、中午、下午、晚间、深夜
- 习惯: 好习惯、打卡、突破等

用户最近常用标签：{recent_tags_str}

规则：
1. 生成 3-6 个最相关、最有信息量的标签
2. 必须包含时间标签
3. 优先使用已有类别，但可以创建新的有意义的标签
4. 标签应该有助于未来检索和分析

只返回 JSON 数组，如：["#时间/早晨", "#饮食/咖啡", "#心情/平静"]"""

        user_content = f"""当前时间段：{time_period}
分类：{category or "未知"}
内容：{text or "无"}
元数据：{json.dumps(meta_data, ensure_ascii=False) if meta_data else "无"}

请生成标签，只输出JSON数组："""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=300,
                task_type="generate_tags",
                task_description=f"Tags for: {category}",
                record_id=record_id,
                json_response=True,
            )
            
            content = result["content"]
            
            # 处理返回格式
            if isinstance(content, dict):
                return content.get("tags", [])
            elif isinstance(content, list):
                return content
            else:
                return self._rule_based_tags(text, category, meta_data)
                
        except Exception as e:
            logger.warning(f"AI 标签生成失败: {e}")
            return self._rule_based_tags(text, category, meta_data)
    
    async def get_related_tags(self, tags: List[str], limit: int = 5) -> List[str]:
        """获取相关标签（基于共现分析）"""
        await self._load_co_occurrence()
        
        related_scores: Dict[str, float] = defaultdict(float)
        
        for tag in tags:
            if tag in self._co_occurrence:
                for related_tag, count in self._co_occurrence[tag].items():
                    if related_tag not in tags:
                        related_scores[related_tag] += count
        
        # 按分数排序
        sorted_tags = sorted(related_scores.items(), key=lambda x: x[1], reverse=True)
        return [tag for tag, _ in sorted_tags[:limit]]
    
    async def get_trending_tags(self, days: int = 7, limit: int = 20) -> List[str]:
        """获取热门标签"""
        db = SessionLocal()
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).all()
            
            tag_counts: Dict[str, int] = defaultdict(int)
            
            for record in records:
                if record.tags:
                    for tag in record.tags:
                        tag_counts[tag] += 1
            
            # 按使用次数排序
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
            return [tag for tag, _ in sorted_tags[:limit]]
            
        finally:
            db.close()
    
    async def get_tag_statistics(self, days: int = 30) -> Dict[str, Any]:
        """获取标签统计信息"""
        db = SessionLocal()
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).all()
            
            # 统计各维度标签使用
            category_counts: Dict[str, int] = defaultdict(int)
            tag_counts: Dict[str, int] = defaultdict(int)
            daily_counts: Dict[str, int] = defaultdict(int)
            
            for record in records:
                if record.tags:
                    date_key = record.created_at.strftime("%Y-%m-%d") if record.created_at else "unknown"
                    for tag in record.tags:
                        tag_counts[tag] += 1
                        daily_counts[date_key] += 1
                        
                        # 提取类别
                        if "/" in tag:
                            category = tag.split("/")[0].replace("#", "")
                            category_counts[category] += 1
            
            # 找出最活跃的日期
            most_active_day = max(daily_counts.items(), key=lambda x: x[1]) if daily_counts else (None, 0)
            
            return {
                "period_days": days,
                "total_tags_used": sum(tag_counts.values()),
                "unique_tags": len(tag_counts),
                "top_tags": sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10],
                "category_distribution": dict(category_counts),
                "most_active_day": {"date": most_active_day[0], "count": most_active_day[1]},
                "avg_tags_per_day": round(sum(tag_counts.values()) / max(len(daily_counts), 1), 1),
            }
            
        finally:
            db.close()
    
    async def analyze_tag_patterns(self) -> Dict[str, Any]:
        """分析标签使用模式"""
        await self._load_co_occurrence()
        
        # 找出最常共现的标签对
        co_pairs: List[Tuple[str, str, int]] = []
        
        for tag1, related in self._co_occurrence.items():
            for tag2, count in related.items():
                if tag1 < tag2:  # 避免重复
                    co_pairs.append((tag1, tag2, count))
        
        co_pairs.sort(key=lambda x: x[2], reverse=True)
        
        return {
            "top_co_occurrences": [
                {"tag1": p[0], "tag2": p[1], "count": p[2]}
                for p in co_pairs[:15]
            ],
            "insight": self._generate_pattern_insight(co_pairs[:10])
        }
    
    def _generate_pattern_insight(self, pairs: List[Tuple[str, str, int]]) -> str:
        """生成模式洞察"""
        if not pairs:
            return "数据不足，暂无模式洞察"
        
        insights = []
        
        for tag1, tag2, count in pairs[:3]:
            cat1 = tag1.split("/")[0].replace("#", "") if "/" in tag1 else ""
            cat2 = tag2.split("/")[0].replace("#", "") if "/" in tag2 else ""
            
            if cat1 != cat2:
                insights.append(f"{cat1}和{cat2}活动经常一起发生")
        
        return "；".join(insights) if insights else "标签使用比较均匀"
    
    async def _load_co_occurrence(self):
        """加载标签共现矩阵"""
        if self._co_occurrence_loaded:
            return
        
        db = SessionLocal()
        try:
            # 获取最近 90 天的数据
            start_date = datetime.now() - timedelta(days=90)
            
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).all()
            
            for record in records:
                if record.tags and len(record.tags) > 1:
                    # 统计标签共现
                    for i, tag1 in enumerate(record.tags):
                        for tag2 in record.tags[i+1:]:
                            self._co_occurrence[tag1][tag2] += 1
                            self._co_occurrence[tag2][tag1] += 1
            
            self._co_occurrence_loaded = True
            
        finally:
            db.close()
    
    def _rule_based_tags(
        self,
        text: Optional[str],
        category: Optional[str],
        meta_data: Optional[Dict],
    ) -> List[str]:
        """基于规则的标签生成（fallback）"""
        tags = []
        
        # 时间标签
        current_hour = datetime.now().hour
        time_tag = f"#时间/{self._get_time_period(current_hour)}"
        tags.append(time_tag)
        
        # 分类标签
        category_map = {
            "SLEEP": "#身体/睡眠",
            "DIET": "#饮食/进食",
            "ACTIVITY": "#身体/运动",
            "MOOD": "#心情/记录",
            "SOCIAL": "#社交/互动",
            "WORK": "#工作/任务",
            "GROWTH": "#成长/学习",
            "LEISURE": "#休闲/娱乐",
            "SCREEN": "#数字/屏幕",
        }
        if category and category in category_map:
            tags.append(category_map[category])
        
        # 从文本提取关键词
        if text:
            keywords = {
                "咖啡": "#饮食/咖啡",
                "跑步": "#身体/跑步",
                "健身": "#身体/健身",
                "书": "#休闲/阅读",
                "电影": "#休闲/电影",
                "游戏": "#休闲/游戏",
                "开心": "#心情/开心",
                "累": "#身体/疲劳",
                "会议": "#工作/会议",
                "学习": "#成长/学习",
            }
            for kw, tag in keywords.items():
                if kw in text and tag not in tags:
                    tags.append(tag)
        
        return tags[:6]  # 最多返回6个标签
    
    def _get_time_period(self, hour: int) -> str:
        """根据小时判断时间段"""
        if 5 <= hour < 9:
            return "早晨"
        elif 9 <= hour < 12:
            return "上午"
        elif 12 <= hour < 14:
            return "中午"
        elif 14 <= hour < 17:
            return "下午"
        elif 17 <= hour < 19:
            return "傍晚"
        elif 19 <= hour < 22:
            return "晚间"
        elif 22 <= hour < 24:
            return "深夜"
        else:
            return "凌晨"


# 全局单例
_tagger: Optional[TaggerAgent] = None


def get_tagger() -> TaggerAgent:
    """获取 TaggerAgent 单例"""
    global _tagger
    if _tagger is None:
        _tagger = TaggerAgent()
    return _tagger
