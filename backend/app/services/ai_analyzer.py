"""
AI 分析器 - 基于历史数据生成深度洞察
"""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from collections import defaultdict

from app.config import get_settings
from app.database import SessionLocal
from app.models import LifeStream
from app.services.json_utils import safe_extract_json
from app.services.ai_client import get_ai_client, AIClientError

logger = logging.getLogger(__name__)
settings = get_settings()


class AIAnalyzer:
    """AI 驱动的数据分析器"""
    
    def __init__(self):
        # 使用统一的 AI 客户端（带 Token 追踪）
        try:
            self.ai_client = get_ai_client()
            self.has_ai = self.ai_client.client is not None
        except Exception:
            self.ai_client = None
            self.has_ai = False
    
    def _get_db(self) -> Session:
        return SessionLocal()
    
    async def analyze_weekly_data(self) -> Dict[str, Any]:
        """
        分析过去一周的数据，生成 AI 洞察
        """
        db = self._get_db()
        try:
            start_date = datetime.now() - timedelta(days=7)
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).order_by(LifeStream.created_at.desc()).all()
            
            if not records:
                return {
                    "has_data": False,
                    "summary": "暂无数据，开始记录你的生活吧！",
                    "insights": [],
                    "suggestions": []
                }
            
            # 汇总数据
            summary_data = self._summarize_records(records)
            
            if not self.has_ai:
                return self._mock_analysis(summary_data)
            
            # AI 分析
            return await self._ai_analyze_weekly(summary_data)
        finally:
            db.close()
    
    async def analyze_trends(self, days: int = 30) -> Dict[str, Any]:
        """
        分析趋势，找出模式和变化
        """
        db = self._get_db()
        try:
            start_date = datetime.now() - timedelta(days=days)
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).order_by(LifeStream.created_at).all()
            
            if len(records) < 7:
                return {
                    "has_data": False,
                    "message": "数据不足，至少需要7条记录进行趋势分析",
                    "trends": []
                }
            
            summary_data = self._summarize_records(records)
            
            if not self.has_ai:
                return self._mock_trend_analysis(summary_data)
            
            return await self._ai_analyze_trends(summary_data, days)
        finally:
            db.close()
    
    async def generate_smart_suggestions(self) -> Dict[str, Any]:
        """
        生成智能建议
        """
        db = self._get_db()
        try:
            # 获取最近的数据
            start_date = datetime.now() - timedelta(days=14)
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).order_by(LifeStream.created_at.desc()).all()
            
            if not records:
                return {
                    "suggestions": ["开始记录你的生活，AI 将为你提供个性化建议"],
                    "focus_area": None
                }
            
            summary_data = self._summarize_records(records)
            
            if not self.has_ai:
                return self._mock_suggestions(summary_data)
            
            return await self._ai_generate_suggestions(summary_data)
        finally:
            db.close()
    
    async def generate_daily_digest(self) -> Dict[str, Any]:
        """
        生成今日 AI 综合洞察（合并了健康提醒 + 异常检测 + 建议）
        """
        db = self._get_db()
        try:
            # 获取今日数据
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_records = db.query(LifeStream).filter(
                LifeStream.created_at >= today_start,
                LifeStream.is_deleted == False,
            ).order_by(LifeStream.created_at.desc()).all()

            # 获取近 7 天数据做对比
            week_start = datetime.now() - timedelta(days=7)
            week_records = db.query(LifeStream).filter(
                LifeStream.created_at >= week_start,
                LifeStream.is_deleted == False,
            ).order_by(LifeStream.created_at.desc()).all()

            if not today_records and not week_records:
                return {
                    "has_data": False,
                    "status_summary": "还没有记录，开始记录你的生活吧！",
                    "findings": [],
                    "suggestions": [],
                    "encouragement": "每一次记录都是对自己的关注",
                }

            today_summary = self._summarize_records(today_records) if today_records else {}
            week_summary = self._summarize_records(week_records) if week_records else {}

            # 收集今日维度分数
            today_dimensions = []
            for r in today_records:
                if r.dimension_scores and isinstance(r.dimension_scores, dict):
                    today_dimensions.append({
                        "category": r.category,
                        "scores": r.dimension_scores,
                        "insight": (r.ai_insight or "")[:80],
                    })

            if not self.has_ai:
                return self._mock_daily_digest(today_summary, week_summary)

            return await self._ai_daily_digest(today_summary, week_summary, today_dimensions)
        finally:
            db.close()

    async def _ai_daily_digest(
        self,
        today: Dict,
        week: Dict,
        dimensions: List[Dict],
    ) -> Dict[str, Any]:
        """LLM 生成综合每日洞察"""
        prompt = f"""你是 Vibing u 的私人生活分析师。请基于用户今日和本周的数据，生成一份简洁的综合洞察报告。

【今日数据】
- 记录数: {today.get('total_records', 0)}
- 分类: {json.dumps(today.get('categories', {}), ensure_ascii=False)}
- 心情: {today.get('moods', [])[:5] or '未记录'}
- 睡眠: {json.dumps(today.get('sleep_data', [])[:2], ensure_ascii=False) or '未记录'}
- 屏幕: {json.dumps(today.get('screen_data', [])[:2], ensure_ascii=False) or '未记录'}
- 运动: {json.dumps(today.get('activity_data', [])[:2], ensure_ascii=False) or '未记录'}
- 维度评分: {json.dumps(dimensions[:5], ensure_ascii=False) if dimensions else '无'}

【近7天参照】
- 总记录: {week.get('total_records', 0)}
- 分类分布: {json.dumps(week.get('categories', {}), ensure_ascii=False)}
- 标签: {list(week.get('tags', {}).keys())[:10]}

请以 JSON 格式输出：
{{
    "status_summary": "一句话概括今日整体状态（15-30字，要有温度）",
    "status_emoji": "一个代表今日状态的 emoji",
    "findings": [
        {{
            "type": "positive/warning/neutral",
            "icon": "emoji",
            "title": "发现标题（5-10字）",
            "detail": "具体说明（20-40字），基于数据"
        }}
    ],
    "suggestions": [
        {{
            "icon": "emoji",
            "action": "具体建议（10-20字）",
            "reason": "原因（10-15字）"
        }}
    ],
    "encouragement": "一句温暖的鼓励（15-25字）"
}}

要求：
1. findings 2-4 条，正面/警告/中性混合，必须基于实际数据
2. suggestions 2-3 条，具体可行
3. 语气温暖但不空洞，像朋友一样
4. 如果今日数据少，可以结合本周数据分析"""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "生成今日洞察报告，只输出JSON。"}
                ],
                max_tokens=6000,
                task_type="daily_digest",
                task_description="今日 AI 洞察",
                json_response=True,
            )

            content = result["content"]
            if not content:
                return self._mock_daily_digest(today, week)

            if isinstance(content, dict):
                content["has_data"] = True
                return content

            parsed = safe_extract_json(content, "daily_digest")
            if parsed and isinstance(parsed, dict):
                parsed["has_data"] = True
                return parsed
            return self._mock_daily_digest(today, week)

        except Exception as e:
            logger.error(f"Daily digest 生成错误: {e}")
            return self._mock_daily_digest(today, week)

    def _mock_daily_digest(self, today: Dict, week: Dict) -> Dict[str, Any]:
        """无 AI 时的 fallback"""
        total = today.get("total_records", 0)
        cats = today.get("categories", {})
        findings = []

        if cats.get("SLEEP"):
            findings.append({"type": "positive", "icon": "😴", "title": "睡眠已记录", "detail": f"今天记录了 {cats['SLEEP']} 条睡眠数据"})
        if cats.get("ACTIVITY"):
            findings.append({"type": "positive", "icon": "🏃", "title": "运动打卡", "detail": f"今天运动了 {cats['ACTIVITY']} 次"})
        if not cats.get("ACTIVITY") and week.get("categories", {}).get("ACTIVITY", 0) < 2:
            findings.append({"type": "warning", "icon": "⚡", "title": "运动不足", "detail": "本周运动次数较少，建议增加活动量"})

        return {
            "has_data": total > 0 or week.get("total_records", 0) > 0,
            "status_summary": f"今天已记录 {total} 条数据" if total else "今天还没有记录",
            "status_emoji": "📊" if total else "🌅",
            "findings": findings or [{"type": "neutral", "icon": "📝", "title": "开始记录", "detail": "记录生活数据，解锁 AI 洞察"}],
            "suggestions": [{"icon": "💡", "action": "记录今天的生活", "reason": "数据越多分析越准确"}],
            "encouragement": "每一次记录都是对自己的关注",
        }

    async def deep_insight(self, question: str) -> Dict[str, Any]:
        """
        基于用户问题进行深度洞察
        """
        db = self._get_db()
        try:
            # 获取相关数据
            start_date = datetime.now() - timedelta(days=30)
            records = db.query(LifeStream).filter(
                LifeStream.created_at >= start_date
            ).order_by(LifeStream.created_at.desc()).limit(100).all()
            
            if not records:
                return {
                    "answer": "暂无数据可供分析，请先记录一些生活数据。",
                    "confidence": "low"
                }
            
            summary_data = self._summarize_records(records)
            
            if not self.has_ai:
                return {"answer": "AI 服务未配置，无法回答问题", "confidence": "low"}
            
            return await self._ai_deep_insight(question, summary_data)
        finally:
            db.close()
    
    def _summarize_records(self, records: List[LifeStream]) -> Dict[str, Any]:
        """汇总记录数据"""
        summary = {
            "total_records": len(records),
            "date_range": {
                "start": records[-1].created_at.isoformat() if records else None,
                "end": records[0].created_at.isoformat() if records else None
            },
            "categories": defaultdict(int),
            "daily_counts": defaultdict(int),
            "hourly_distribution": defaultdict(int),
            "moods": [],
            "sleep_data": [],
            "screen_data": [],
            "activity_data": [],
            "diet_data": [],
            "ai_insights": [],
            "tags": defaultdict(int),
        }
        
        for r in records:
            # 分类统计
            if r.category:
                summary["categories"][r.category] += 1
            
            # 每日统计
            if r.created_at:
                day_key = r.created_at.strftime("%Y-%m-%d")
                summary["daily_counts"][day_key] += 1
                summary["hourly_distribution"][r.created_at.hour] += 1
            
            # 标签统计
            if r.tags:
                for tag in r.tags:
                    summary["tags"][tag] += 1
            
            # AI 洞察收集
            if r.ai_insight:
                summary["ai_insights"].append({
                    "date": r.created_at.isoformat() if r.created_at else None,
                    "category": r.category,
                    "insight": r.ai_insight[:200]
                })
            
            # 分类数据提取
            if r.category == "MOOD" and r.meta_data:
                mood = r.meta_data.get("mood")
                if mood:
                    summary["moods"].append(mood)
            
            if r.category == "SLEEP" and r.meta_data:
                summary["sleep_data"].append({
                    "date": r.created_at.isoformat() if r.created_at else None,
                    "duration": r.meta_data.get("duration_hours"),
                    "quality": r.meta_data.get("quality"),
                    "score": r.meta_data.get("score"),
                })
            
            if r.category == "SCREEN" and r.meta_data:
                top_apps = r.meta_data.get("top_apps") or []
                summary["screen_data"].append({
                    "date": r.created_at.isoformat() if r.created_at else None,
                    "total_time": r.meta_data.get("total_screen_time"),
                    "total_minutes": r.meta_data.get("total_minutes"),
                    "top_apps": top_apps[:3] if top_apps else [],
                    "health_score": r.meta_data.get("health_score"),
                })
            
            if r.category == "ACTIVITY" and r.meta_data:
                summary["activity_data"].append({
                    "date": r.created_at.isoformat() if r.created_at else None,
                    "type": r.meta_data.get("activity_type"),
                    "duration": r.meta_data.get("duration_minutes"),
                    "calories": r.meta_data.get("calories_burned"),
                })
            
            if r.category == "DIET" and r.meta_data:
                food_items = r.meta_data.get("food_items") or []
                summary["diet_data"].append({
                    "date": r.created_at.isoformat() if r.created_at else None,
                    "foods": food_items,
                    "calories": r.meta_data.get("total_calories"),
                    "is_healthy": r.meta_data.get("is_healthy"),
                })
        
        # 转换为普通字典
        summary["categories"] = dict(summary["categories"])
        summary["daily_counts"] = dict(summary["daily_counts"])
        summary["hourly_distribution"] = dict(summary["hourly_distribution"])
        summary["tags"] = dict(sorted(summary["tags"].items(), key=lambda x: x[1], reverse=True)[:20])
        
        return summary
    
    async def _ai_analyze_weekly(self, data: Dict) -> Dict[str, Any]:
        """AI 周度分析"""
        prompt = f"""你是 Vibing u 的数据分析师，擅长从生活记录中发现有价值的洞察。

以下是用户过去一周的生活数据汇总：
- 总记录数: {data['total_records']}
- 时间范围: {data['date_range']['start']} 到 {data['date_range']['end']}
- 分类分布: {json.dumps(data['categories'], ensure_ascii=False)}
- 心情记录: {data['moods'][:10] if data['moods'] else '无'}
- 睡眠数据: {json.dumps(data['sleep_data'][:5], ensure_ascii=False) if data['sleep_data'] else '无'}
- 屏幕时间: {json.dumps(data['screen_data'][:5], ensure_ascii=False) if data['screen_data'] else '无'}
- 运动数据: {json.dumps(data['activity_data'][:5], ensure_ascii=False) if data['activity_data'] else '无'}
- 高频标签: {json.dumps(list(data['tags'].items())[:10], ensure_ascii=False)}

请生成一份温暖、有洞察力的周度分析报告，以 JSON 格式输出：
{{
    "summary": "一句话总结本周状态（20-40字）",
    "highlights": ["亮点1", "亮点2", "亮点3"],
    "concerns": ["需要关注的问题1", "问题2"],
    "insights": [
        {{"title": "洞察标题", "content": "具体洞察内容（30-50字）", "emoji": "相关emoji"}},
        {{"title": "洞察标题", "content": "具体洞察内容", "emoji": "emoji"}}
    ],
    "suggestions": [
        {{"action": "具体建议", "reason": "原因", "priority": "high/medium/low"}}
    ],
    "mood_trend": "up/down/stable",
    "overall_score": 75
}}

注意：
1. 分析要有温度，像朋友一样关心用户
2. 洞察要具体，基于数据而非泛泛而谈
3. 建议要可行，能立即执行"""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "请分析我的数据，只输出JSON，不要其他内容。"}
                ],
                max_tokens=6000,
                task_type="weekly_analysis",
                task_description="AI 周度分析",
                json_response=True,
            )
            
            content = result["content"]
            
            if not content:
                logger.warning("AI 返回空内容")
                return self._mock_analysis(data)
            
            if isinstance(content, dict):
                content["has_data"] = True
                return content
            
            # 如果返回的是字符串，尝试解析
            parsed = safe_extract_json(content, "weekly_analysis")
            if parsed and isinstance(parsed, dict):
                parsed["has_data"] = True
                return parsed
            return self._mock_analysis(data)
                
        except AIClientError as e:
            logger.error(f"AI 分析错误: {e}")
            return self._mock_analysis(data)
        except Exception as e:
            logger.error(f"AI 分析错误: {e}")
            return self._mock_analysis(data)
    
    async def _ai_analyze_trends(self, data: Dict, days: int) -> Dict[str, Any]:
        """AI 趋势分析"""
        prompt = f"""分析用户过去 {days} 天的生活数据趋势。

数据汇总：
- 总记录: {data['total_records']}
- 每日记录分布: {json.dumps(data['daily_counts'], ensure_ascii=False)}
- 分类分布: {json.dumps(data['categories'], ensure_ascii=False)}
- 时段分布: {json.dumps(data['hourly_distribution'], ensure_ascii=False)}
- 睡眠: {len(data['sleep_data'])} 条
- 运动: {len(data['activity_data'])} 条
- 屏幕: {len(data['screen_data'])} 条

请以 JSON 格式输出趋势分析：
{{
    "overall_trend": "improving/declining/stable",
    "trend_description": "整体趋势描述（30-50字）",
    "patterns": [
        {{"name": "模式名称", "description": "描述", "impact": "positive/negative/neutral"}}
    ],
    "correlations": [
        {{"factor1": "因素1", "factor2": "因素2", "relationship": "关系描述"}}
    ],
    "predictions": [
        {{"area": "领域", "prediction": "预测内容", "confidence": "high/medium/low"}}
    ],
    "action_items": ["建议1", "建议2"]
}}"""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "分析趋势，只输出JSON，不要其他内容。"}
                ],
                max_tokens=5000,
                task_type="trend_analysis",
                task_description="AI 趋势分析",
                json_response=True,
            )
            
            content = result["content"]
            if not content:
                return self._mock_trend_analysis(data)
            
            if isinstance(content, dict):
                content["has_data"] = True
                content["period_days"] = days
                return content
            
            parsed = safe_extract_json(content, "trend_analysis")
            if parsed and isinstance(parsed, dict):
                parsed["has_data"] = True
                parsed["period_days"] = days
                return parsed
            return self._mock_trend_analysis(data)
                
        except Exception as e:
            logger.error(f"AI 趋势分析错误: {e}")
            return self._mock_trend_analysis(data)
    
    async def _ai_generate_suggestions(self, data: Dict) -> Dict[str, Any]:
        """AI 生成建议"""
        prompt = f"""基于用户的生活数据，生成个性化的智能建议。

数据概览：
- 分类: {json.dumps(data['categories'], ensure_ascii=False)}
- 心情: {data['moods'][:5] if data['moods'] else '无'}
- 睡眠: {len(data['sleep_data'])} 条记录
- 运动: {len(data['activity_data'])} 条记录
- 屏幕: {len(data['screen_data'])} 条记录
- 标签: {list(data['tags'].keys())[:10]}

请生成 3-5 条具体、可执行的建议，JSON 格式：
{{
    "focus_area": "当前最需要关注的领域",
    "focus_reason": "原因（20字内）",
    "suggestions": [
        {{
            "title": "建议标题",
            "description": "具体描述和行动步骤（30-50字）",
            "category": "sleep/activity/screen/mood/diet/social",
            "difficulty": "easy/medium/hard",
            "impact": "high/medium/low",
            "emoji": "相关emoji"
        }}
    ],
    "encouragement": "一句鼓励的话"
}}"""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "给我一些建议，只输出JSON，不要其他内容。"}
                ],
                max_tokens=5000,
                task_type="smart_suggestions",
                task_description="AI 智能建议",
                json_response=True,
            )
            
            content = result["content"]
            if not content:
                return self._mock_suggestions(data)
            
            if isinstance(content, dict):
                return content
            
            parsed = safe_extract_json(content, "suggestions")
            if parsed and isinstance(parsed, dict):
                return parsed
            return self._mock_suggestions(data)
                
        except Exception as e:
            logger.error(f"AI 建议生成错误: {e}")
            return self._mock_suggestions(data)
    
    async def _ai_deep_insight(self, question: str, data: Dict) -> Dict[str, Any]:
        """AI 深度洞察"""
        prompt = f"""你是用户的私人生活数据分析师。用户问了一个问题，请基于他的历史数据回答。

用户数据：
- 总记录: {data['total_records']}
- 分类: {json.dumps(data['categories'], ensure_ascii=False)}
- 最近的 AI 洞察: {json.dumps(data['ai_insights'][:5], ensure_ascii=False)}
- 标签: {list(data['tags'].keys())[:15]}
- 心情: {data['moods'][:10] if data['moods'] else '无'}
- 睡眠数据: {json.dumps(data['sleep_data'][:3], ensure_ascii=False) if data['sleep_data'] else '无'}
- 屏幕数据: {json.dumps(data['screen_data'][:3], ensure_ascii=False) if data['screen_data'] else '无'}

用户问题: {question}

请以 JSON 格式回答：
{{
    "answer": "详细回答（100-200字）",
    "confidence": "high/medium/low",
    "data_points": ["支持结论的数据点1", "数据点2"],
    "follow_up_questions": ["可能的追问1", "追问2"]
}}"""

        try:
            result = await self.ai_client.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"{question}\n\n只输出JSON格式，不要其他内容。"}
                ],
                model=settings.smart_model,  # 深度洞察使用高级模型
                max_tokens=6000,
                task_type="deep_insight",
                task_description="AI 深度洞察",
                json_response=True,
            )
            
            content = result["content"]
            if not content:
                return {"answer": "AI 未返回内容", "confidence": "low"}
            
            if isinstance(content, dict):
                return content
            
            parsed = safe_extract_json(content, "deep_insight")
            if parsed and isinstance(parsed, dict):
                return parsed
            return {"answer": content, "confidence": "low"}
                
        except Exception as e:
            logger.error(f"AI 深度洞察错误: {e}")
            return {"answer": f"分析出错: {str(e)}", "confidence": "low"}
    
    def _mock_analysis(self, data: Dict) -> Dict[str, Any]:
        """模拟分析（无 AI 时）"""
        categories = data.get("categories", {})
        total = data.get("total_records", 0)
        
        insights = []
        if categories.get("SLEEP", 0) > 0:
            insights.append({"title": "睡眠追踪", "content": f"本周记录了 {categories['SLEEP']} 次睡眠", "emoji": "😴"})
        if categories.get("ACTIVITY", 0) > 0:
            insights.append({"title": "运动记录", "content": f"本周运动 {categories['ACTIVITY']} 次", "emoji": "🏃"})
        
        return {
            "has_data": True,
            "summary": f"本周共记录 {total} 条生活数据",
            "highlights": ["保持了记录习惯"],
            "concerns": [],
            "insights": insights,
            "suggestions": [{"action": "继续保持记录习惯", "reason": "数据越多分析越准确", "priority": "high"}],
            "mood_trend": "stable",
            "overall_score": 60
        }
    
    def _mock_trend_analysis(self, data: Dict) -> Dict[str, Any]:
        """模拟趋势分析"""
        return {
            "has_data": True,
            "overall_trend": "stable",
            "trend_description": "数据量较少，趋势分析需要更多数据支持",
            "patterns": [],
            "correlations": [],
            "predictions": [],
            "action_items": ["增加日常记录频率", "记录更多类型的数据"]
        }
    
    def _mock_suggestions(self, data: Dict) -> Dict[str, Any]:
        """模拟建议"""
        categories = data.get("categories", {})
        
        suggestions = []
        if categories.get("SLEEP", 0) < 3:
            suggestions.append({
                "title": "记录睡眠",
                "description": "每天记录睡眠情况，帮助分析作息规律",
                "category": "sleep",
                "difficulty": "easy",
                "impact": "high",
                "emoji": "😴"
            })
        if categories.get("ACTIVITY", 0) < 2:
            suggestions.append({
                "title": "增加运动",
                "description": "每周至少运动3次，每次30分钟以上",
                "category": "activity",
                "difficulty": "medium",
                "impact": "high",
                "emoji": "🏃"
            })
        
        if not suggestions:
            suggestions.append({
                "title": "继续保持",
                "description": "你的记录习惯很好，继续坚持！",
                "category": "mood",
                "difficulty": "easy",
                "impact": "medium",
                "emoji": "✨"
            })
        
        return {
            "focus_area": "整体健康",
            "focus_reason": "均衡发展各维度",
            "suggestions": suggestions,
            "encouragement": "每一次记录都是对自己的关注 ❤️"
        }


# 全局单例
_analyzer: Optional[AIAnalyzer] = None


def get_ai_analyzer() -> AIAnalyzer:
    """获取 AI 分析器单例"""
    global _analyzer
    if _analyzer is None:
        _analyzer = AIAnalyzer()
    return _analyzer
