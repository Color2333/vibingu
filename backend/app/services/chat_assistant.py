"""对话式 AI 助手

提供自然语言查询功能，帮助用户理解和分析自己的生活数据。
集成 RAG 系统进行智能问答。
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import re
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.database import SessionLocal
from app.models import LifeStream, DailySummary

logger = logging.getLogger(__name__)


class ChatAssistant:
    """对话式 AI 助手"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
        self._rag_service = None
    
    @property
    def rag_service(self):
        """延迟加载 RAG 服务"""
        if self._rag_service is None:
            try:
                from app.services.rag import get_rag_service
                self._rag_service = get_rag_service()
            except Exception as e:
                logger.warning(f"RAG 服务加载失败: {e}")
        return self._rag_service
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def chat(self, message: str) -> Dict[str, Any]:
        """
        处理用户消息并返回回复
        
        目前使用规则匹配 + 数据查询，未来可接入 LLM
        """
        message = message.strip().lower()
        
        # 意图识别
        intent = self._detect_intent(message)
        
        # 根据意图处理
        if intent == "summary_today":
            return self._handle_summary_today()
        elif intent == "summary_week":
            return self._handle_summary_week()
        elif intent == "summary_month":
            return self._handle_summary_month()
        elif intent == "best_day":
            return self._handle_best_day()
        elif intent == "worst_day":
            return self._handle_worst_day()
        elif intent == "sleep_analysis":
            return self._handle_sleep_analysis()
        elif intent == "mood_analysis":
            return self._handle_mood_analysis()
        elif intent == "activity_analysis":
            return self._handle_activity_analysis()
        elif intent == "category_count":
            return self._handle_category_count(message)
        elif intent == "trend":
            return self._handle_trend()
        elif intent == "suggestion":
            return self._handle_suggestion()
        else:
            return self._handle_unknown(message)
    
    def _detect_intent(self, message: str) -> str:
        """识别用户意图"""
        
        # 今日总结
        if any(kw in message for kw in ["今天", "今日", "今天怎么样", "今天状态"]):
            return "summary_today"
        
        # 本周总结
        if any(kw in message for kw in ["本周", "这周", "这一周", "最近一周"]):
            return "summary_week"
        
        # 本月总结
        if any(kw in message for kw in ["本月", "这个月", "这月"]):
            return "summary_month"
        
        # 最佳日子
        if any(kw in message for kw in ["最好", "最佳", "最高分", "状态最好"]):
            return "best_day"
        
        # 最差日子
        if any(kw in message for kw in ["最差", "最低", "最低分", "状态最差"]):
            return "worst_day"
        
        # 睡眠分析
        if any(kw in message for kw in ["睡眠", "睡觉", "休息", "作息"]):
            return "sleep_analysis"
        
        # 心情分析
        if any(kw in message for kw in ["心情", "情绪", "心态", "感觉"]):
            return "mood_analysis"
        
        # 运动分析
        if any(kw in message for kw in ["运动", "锻炼", "健身", "活动"]):
            return "activity_analysis"
        
        # 类别统计
        if any(kw in message for kw in ["多少次", "几次", "统计", "数量"]):
            return "category_count"
        
        # 趋势分析
        if any(kw in message for kw in ["趋势", "变化", "走向"]):
            return "trend"
        
        # 建议
        if any(kw in message for kw in ["建议", "怎么办", "如何", "帮我", "改善"]):
            return "suggestion"
        
        return "unknown"
    
    def _handle_summary_today(self) -> Dict[str, Any]:
        """今日总结"""
        today = datetime.now().date()
        start = datetime.combine(today, datetime.min.time())
        end = datetime.now()
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start,
                LifeStream.created_at < end
            )
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "今天还没有记录任何数据呢，开始记录你的生活吧！✨"
            }
        
        # 统计
        category_counts = defaultdict(int)
        total_score = 0
        score_count = 0
        
        for r in records:
            if r.category:
                category_counts[r.category] += 1
            if r.dimension_scores:
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                total_score += avg
                score_count += 1
        
        avg_score = total_score / score_count if score_count > 0 else None
        
        # 生成回复
        summary_parts = []
        summary_parts.append(f"📊 **今日总结**\n")
        summary_parts.append(f"共记录了 **{len(records)}** 条数据。\n")
        
        if avg_score:
            emoji = "🌟" if avg_score >= 70 else "👍" if avg_score >= 50 else "💪"
            summary_parts.append(f"今日平均状态分数: **{avg_score:.1f}** {emoji}\n")
        
        if category_counts:
            summary_parts.append("\n各类别记录:\n")
            category_names = {
                "SLEEP": "😴 睡眠",
                "DIET": "🍽️ 饮食",
                "ACTIVITY": "🏃 运动",
                "SCREEN": "📱 屏幕",
                "MOOD": "😊 心情",
                "SOCIAL": "👥 社交",
                "WORK": "💼 工作",
                "GROWTH": "📚 成长",
                "LEISURE": "🎮 休闲"
            }
            for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
                name = category_names.get(cat, cat)
                summary_parts.append(f"- {name}: {count}条\n")
        
        return {
            "type": "markdown",
            "content": "".join(summary_parts)
        }
    
    def _handle_summary_week(self) -> Dict[str, Any]:
        """本周总结"""
        start = datetime.now() - timedelta(days=7)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "本周还没有记录数据，开始记录吧！"
            }
        
        # 按天统计
        daily_scores = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%m/%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        # 生成回复
        summary = f"📈 **本周总结** (最近7天)\n\n"
        summary += f"共记录 **{len(records)}** 条数据\n\n"
        
        if daily_scores:
            summary += "每日平均分数:\n"
            for date, scores in sorted(daily_scores.items()):
                avg = sum(scores) / len(scores)
                bar = "█" * int(avg / 10) + "░" * (10 - int(avg / 10))
                summary += f"- {date}: {bar} {avg:.1f}\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_summary_month(self) -> Dict[str, Any]:
        """本月总结"""
        start = datetime.now() - timedelta(days=30)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "本月还没有记录数据。"
            }
        
        # 统计
        total_score = 0
        score_count = 0
        category_counts = defaultdict(int)
        
        for r in records:
            if r.category:
                category_counts[r.category] += 1
            if r.dimension_scores:
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                total_score += avg
                score_count += 1
        
        avg_score = total_score / score_count if score_count > 0 else 0
        
        summary = f"📅 **本月总结** (最近30天)\n\n"
        summary += f"- 总记录数: **{len(records)}** 条\n"
        summary += f"- 平均状态分数: **{avg_score:.1f}**\n"
        summary += f"- 日均记录: **{len(records)/30:.1f}** 条\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_best_day(self) -> Dict[str, Any]:
        """找出最佳日子"""
        start = datetime.now() - timedelta(days=30)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "数据不足，无法分析最佳日子。"
            }
        
        # 按天计算平均分
        daily_scores = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        if not daily_scores:
            return {
                "type": "text",
                "content": "数据不足，无法分析最佳日子。"
            }
        
        # 找最高分的一天
        best_date = None
        best_score = 0
        
        for date, scores in daily_scores.items():
            avg = sum(scores) / len(scores)
            if avg > best_score:
                best_score = avg
                best_date = date
        
        return {
            "type": "markdown",
            "content": f"🏆 **最佳日子**\n\n最近30天里，**{best_date}** 是状态最好的一天！\n\n平均分数达到了 **{best_score:.1f}** 分 🌟"
        }
    
    def _handle_worst_day(self) -> Dict[str, Any]:
        """找出最差日子"""
        start = datetime.now() - timedelta(days=30)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "数据不足，无法分析。"
            }
        
        # 按天计算平均分
        daily_scores = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        if not daily_scores:
            return {
                "type": "text",
                "content": "数据不足。"
            }
        
        # 找最低分的一天
        worst_date = None
        worst_score = 100
        
        for date, scores in daily_scores.items():
            avg = sum(scores) / len(scores)
            if avg < worst_score:
                worst_score = avg
                worst_date = date
        
        return {
            "type": "markdown",
            "content": f"📉 **需要关注的日子**\n\n**{worst_date}** 的状态较低，平均分数 **{worst_score:.1f}** 分。\n\n不过没关系，每个人都有状态不好的时候，重要的是持续关注和调整 💪"
        }
    
    def _handle_sleep_analysis(self) -> Dict[str, Any]:
        """睡眠分析"""
        start = datetime.now() - timedelta(days=14)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start,
                LifeStream.category == "SLEEP"
            )
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "最近两周没有睡眠记录。记录睡眠可以帮助你了解作息规律哦！"
            }
        
        summary = f"😴 **睡眠分析** (最近14天)\n\n"
        summary += f"共记录了 **{len(records)}** 条睡眠数据。\n\n"
        
        # 分析睡眠时间分布
        hour_counts = defaultdict(int)
        for r in records:
            if r.created_at:
                hour_counts[r.created_at.hour] += 1
        
        if hour_counts:
            summary += "记录时间分布:\n"
            for hour in sorted(hour_counts.keys()):
                count = hour_counts[hour]
                summary += f"- {hour}:00 - {(hour+1)%24}:00: {count}次\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_mood_analysis(self) -> Dict[str, Any]:
        """心情分析"""
        start = datetime.now() - timedelta(days=14)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start,
                LifeStream.category == "MOOD"
            )
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "最近两周没有心情记录。记录心情可以帮助你了解情绪变化！"
            }
        
        # 从标签提取情绪关键词
        mood_counts = defaultdict(int)
        
        for r in records:
            if r.tags:
                for tag in r.tags:
                    if "开心" in tag or "快乐" in tag:
                        mood_counts["😊 开心"] += 1
                    elif "平静" in tag or "放松" in tag:
                        mood_counts["😌 平静"] += 1
                    elif "焦虑" in tag or "紧张" in tag:
                        mood_counts["😰 焦虑"] += 1
                    elif "累" in tag or "疲惫" in tag:
                        mood_counts["😴 疲惫"] += 1
        
        summary = f"😊 **心情分析** (最近14天)\n\n"
        summary += f"共记录了 **{len(records)}** 条心情数据。\n\n"
        
        if mood_counts:
            summary += "情绪分布:\n"
            for mood, count in sorted(mood_counts.items(), key=lambda x: x[1], reverse=True):
                summary += f"- {mood}: {count}次\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_activity_analysis(self) -> Dict[str, Any]:
        """运动分析"""
        start = datetime.now() - timedelta(days=14)
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start,
                LifeStream.category == "ACTIVITY"
            )
        ).all()
        
        if not records:
            return {
                "type": "text",
                "content": "最近两周没有运动记录。运动可以帮助提升状态哦！🏃"
            }
        
        # 按天统计
        daily_counts = defaultdict(int)
        for r in records:
            if r.created_at:
                weekday = r.created_at.strftime("%A")
                daily_counts[weekday] += 1
        
        summary = f"🏃 **运动分析** (最近14天)\n\n"
        summary += f"共记录了 **{len(records)}** 次运动。\n"
        summary += f"日均 **{len(records)/14:.1f}** 次\n\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_category_count(self, message: str) -> Dict[str, Any]:
        """类别统计"""
        start = datetime.now() - timedelta(days=30)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        category_counts = defaultdict(int)
        for r in records:
            if r.category:
                category_counts[r.category] += 1
        
        summary = f"📊 **最近30天记录统计**\n\n"
        summary += f"总计: **{len(records)}** 条\n\n"
        
        category_names = {
            "SLEEP": "😴 睡眠",
            "DIET": "🍽️ 饮食",
            "ACTIVITY": "🏃 运动",
            "SCREEN": "📱 屏幕",
            "MOOD": "😊 心情",
            "SOCIAL": "👥 社交",
            "WORK": "💼 工作",
            "GROWTH": "📚 成长",
            "LEISURE": "🎮 休闲"
        }
        
        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            name = category_names.get(cat, cat)
            percentage = count / len(records) * 100 if records else 0
            summary += f"- {name}: {count}条 ({percentage:.1f}%)\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_trend(self) -> Dict[str, Any]:
        """趋势分析"""
        start = datetime.now() - timedelta(days=14)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).order_by(LifeStream.created_at).all()
        
        if len(records) < 3:
            return {
                "type": "text",
                "content": "数据不足，无法分析趋势。"
            }
        
        # 按天计算分数
        daily_scores = defaultdict(list)
        
        for r in records:
            if r.created_at and r.dimension_scores:
                date_key = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[date_key].append(avg)
        
        if len(daily_scores) < 2:
            return {
                "type": "text",
                "content": "数据不足。"
            }
        
        # 计算趋势
        sorted_days = sorted(daily_scores.keys())
        first_half_avg = sum(
            sum(daily_scores[d]) / len(daily_scores[d])
            for d in sorted_days[:len(sorted_days)//2]
        ) / (len(sorted_days) // 2) if sorted_days[:len(sorted_days)//2] else 50
        
        second_half_avg = sum(
            sum(daily_scores[d]) / len(daily_scores[d])
            for d in sorted_days[len(sorted_days)//2:]
        ) / len(sorted_days[len(sorted_days)//2:]) if sorted_days[len(sorted_days)//2:] else 50
        
        diff = second_half_avg - first_half_avg
        
        if diff > 3:
            trend_text = f"📈 **上升趋势**\n\n状态在逐渐变好！后半期平均分比前半期高 **{diff:.1f}** 分。继续保持！🌟"
        elif diff < -3:
            trend_text = f"📉 **下降趋势**\n\n状态有所下滑，后半期平均分比前半期低 **{abs(diff):.1f}** 分。\n\n建议关注睡眠、运动等基础生活习惯。💪"
        else:
            trend_text = f"➡️ **稳定趋势**\n\n状态比较稳定，前后期平均分差异仅 **{abs(diff):.1f}** 分。"
        
        return {
            "type": "markdown",
            "content": trend_text
        }
    
    def _handle_suggestion(self) -> Dict[str, Any]:
        """生成建议"""
        # 分析最近数据给出建议
        start = datetime.now() - timedelta(days=7)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start
        ).all()
        
        suggestions = []
        category_counts = defaultdict(int)
        
        for r in records:
            if r.category:
                category_counts[r.category] += 1
        
        # 检查各类别情况
        if category_counts.get("SLEEP", 0) < 3:
            suggestions.append("😴 建议增加睡眠记录，了解你的作息规律")
        
        if category_counts.get("ACTIVITY", 0) < 2:
            suggestions.append("🏃 建议增加运动，每天30分钟运动可以显著提升状态")
        
        if category_counts.get("SOCIAL", 0) < 1:
            suggestions.append("👥 可以记录一些社交活动，人际连接有助于心理健康")
        
        if category_counts.get("GROWTH", 0) < 1:
            suggestions.append("📚 记录学习和成长活动可以增加生活的意义感")
        
        if not suggestions:
            suggestions.append("✨ 你的记录习惯很好，继续保持！")
            suggestions.append("💡 可以尝试在固定时间记录，形成习惯")
        
        summary = "💡 **个性化建议**\n\n"
        for s in suggestions:
            summary += f"- {s}\n"
        
        return {
            "type": "markdown",
            "content": summary
        }
    
    def _handle_unknown(self, message: str) -> Dict[str, Any]:
        """处理未知意图 - 使用 RAG 进行智能问答"""
        # 尝试使用 RAG 回答
        if self.rag_service:
            try:
                rag_result = self.rag_service.ask(message)
                
                if rag_result.get("has_context") and rag_result.get("answer"):
                    # RAG 成功返回答案
                    content = f"🤖 **AI 回答**\n\n{rag_result['answer']}"
                    
                    # 添加来源信息
                    if rag_result.get("sources"):
                        content += "\n\n---\n*基于以下记录：*\n"
                        for src in rag_result["sources"][:3]:
                            content += f"- {src.get('date', '')} [{src.get('category', '')}]\n"
                    
                    return {
                        "type": "markdown",
                        "content": content
                    }
            except Exception as e:
                logger.error(f"RAG 问答失败: {e}")
        
        # RAG 失败或无法回答，返回帮助信息
        return {
            "type": "markdown",
            "content": """我可以帮你分析以下内容：

- 📊 **今日/本周/本月总结** - 了解你的状态概览
- 🏆 **最佳/最差日子** - 找出状态高峰和低谷
- 😴 **睡眠分析** - 了解作息规律
- 😊 **心情分析** - 分析情绪变化
- 🏃 **运动分析** - 统计运动情况
- 📈 **趋势分析** - 查看状态变化趋势
- 💡 **建议** - 获取个性化建议

你也可以直接问我任何关于你生活数据的问题，比如：
- "我上周的睡眠情况怎么样？"
- "什么时候我的状态最好？"
- "我最近有什么规律？"

试着问我吧！"""
        }


# 全局单例
_assistant: Optional[ChatAssistant] = None


def get_chat_assistant() -> ChatAssistant:
    """获取 ChatAssistant 单例"""
    global _assistant
    if _assistant is None:
        _assistant = ChatAssistant()
    return _assistant
