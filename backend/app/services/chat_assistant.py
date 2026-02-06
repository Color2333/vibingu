"""对话式 AI 助手（LLM 增强版）

所有回答通过 LLM 生成，数据库查询结果 + RAG 检索结果作为上下文。
支持多轮对话历史。
"""
import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from datetime import datetime, timedelta
from collections import defaultdict
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.database import SessionLocal
from app.models import LifeStream
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ChatAssistant:
    """对话式 AI 助手（LLM 驱动）"""

    def __init__(self):
        self.db: Session = SessionLocal()
        self._rag_service = None
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        self.model = settings.smart_model  # glm-4.7

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

    # =====================================================
    # 公共入口
    # =====================================================

    async def chat(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        处理用户消息并返回 LLM 生成的回复。

        流程:
        1. 根据消息关键词查询数据库，获取结构化数据上下文
        2. 通过 RAG 检索相关记录（语义搜索）
        3. 将两部分上下文拼接后交给 LLM 生成自然回答
        """
        if not self.client:
            return self._fallback_no_ai(message)

        try:
            # 1) 数据库结构化上下文
            db_context = self._gather_db_context(message)

            # 2) RAG 语义检索上下文
            rag_context = self._gather_rag_context(message)

            # 3) 构建 LLM 消息（system prompt 精简，数据放入 user message）
            has_history = bool(history and len(history) > 0)
            system_prompt = self._build_system_prompt(db_context, rag_context)
            user_prompt = self._build_user_prompt(message, db_context, rag_context, has_history=has_history)
            messages = [{"role": "system", "content": system_prompt}]

            # 加入对话历史（最多保留 3 轮，节省 token）
            if history:
                # 截断每条历史消息长度
                for msg in history[-3:]:
                    content = msg.get("content", "")
                    if len(content) > 300:
                        content = content[:300] + "..."
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": content,
                    })

            messages.append({"role": "user", "content": user_prompt})

            # 4) 调用 LLM
            logger.info(f"AI 助手调用 LLM, 模型={self.model}, 消息数={len(messages)}")
            
            # 使用并发控制器
            from app.services.ai_client import _concurrency_limiter
            acquired, actual_model = await _concurrency_limiter.acquire_with_upgrade(self.model, timeout=90.0)
            if not acquired:
                logger.warning(f"模型 {self.model} 并发已满")
                return self._fallback_db_only(message)
            
            try:
                response = await self.client.chat.completions.create(
                    model=actual_model,
                    messages=messages,
                    max_tokens=4000,
                    temperature=0.7,
                )
            finally:
                _concurrency_limiter.release(actual_model)
            
            choice = response.choices[0]
            answer = choice.message.content
            finish_reason = choice.finish_reason
            
            logger.info(f"LLM 响应: finish_reason={finish_reason}, content_length={len(answer) if answer else 0}, content_preview={repr(answer[:100]) if answer else 'None'}")

            if not answer or not answer.strip():
                logger.warning(f"LLM 返回空内容 (finish_reason={finish_reason})，尝试降级")
                return self._fallback_db_only(message)

            logger.info(f"AI 助手回复成功, 长度={len(answer)}")
            return {"type": "markdown", "content": answer}

        except Exception as e:
            logger.error(f"AI 助手生成回答失败: {e}", exc_info=True)
            # 降级到纯数据库查询回答
            return self._fallback_db_only(message)

    # =====================================================
    # 流式输出
    # =====================================================

    async def chat_stream(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ):
        """
        流式处理用户消息，逐 token yield。
        每次 yield 一个 SSE 格式的 data chunk。
        """
        if not self.client:
            yield f"data: {json.dumps({'content': '⚠️ AI 服务未配置', 'done': True}, ensure_ascii=False)}\n\n"
            return

        try:
            import json as _json

            db_context = self._gather_db_context(message)
            rag_context = self._gather_rag_context(message)

            has_history = bool(history and len(history) > 0)
            system_prompt = self._build_system_prompt(db_context, rag_context)
            user_prompt = self._build_user_prompt(message, db_context, rag_context, has_history=has_history)
            messages = [{"role": "system", "content": system_prompt}]

            if history:
                for msg in history[-3:]:
                    content = msg.get("content", "")
                    if len(content) > 300:
                        content = content[:300] + "..."
                    messages.append({"role": msg.get("role", "user"), "content": content})

            messages.append({"role": "user", "content": user_prompt})

            from app.services.ai_client import _concurrency_limiter
            acquired, actual_model = await _concurrency_limiter.acquire_with_upgrade(self.model, timeout=90.0)
            if not acquired:
                yield f"data: {_json.dumps({'content': 'AI 模型繁忙，请稍后重试', 'done': True}, ensure_ascii=False)}\n\n"
                return

            try:
                stream = await self.client.chat.completions.create(
                    model=actual_model,
                    messages=messages,
                    max_tokens=4000,
                    temperature=0.7,
                    stream=True,
                )

                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        yield f"data: {_json.dumps({'content': token, 'done': False}, ensure_ascii=False)}\n\n"

                # 发送结束标记
                yield f"data: {_json.dumps({'content': '', 'done': True}, ensure_ascii=False)}\n\n"

            finally:
                _concurrency_limiter.release(actual_model)

        except Exception as e:
            import json as _json
            logger.error(f"流式回复失败: {e}")
            yield f"data: {_json.dumps({'content': f'回复出错: {str(e)}', 'done': True}, ensure_ascii=False)}\n\n"

    # =====================================================
    # 上下文构建
    # =====================================================

    def _gather_db_context(self, message: str) -> str:
        """根据消息关键词从数据库获取结构化统计数据"""
        parts: List[str] = []
        msg = message.lower()

        # --- 总是提供基础概览 ---
        parts.append(self._get_overview_context())

        # --- 按关键词补充详细上下文 ---
        if any(kw in msg for kw in ["今天", "今日", "today"]):
            parts.append(self._get_today_context())

        if any(kw in msg for kw in ["本周", "这周", "这一周", "最近一周", "week"]):
            parts.append(self._get_week_context())

        if any(kw in msg for kw in ["本月", "这个月", "month"]):
            parts.append(self._get_month_context())

        if any(kw in msg for kw in ["睡眠", "睡觉", "休息", "作息", "sleep"]):
            parts.append(self._get_sleep_context())

        if any(kw in msg for kw in ["心情", "情绪", "心态", "感觉", "mood"]):
            parts.append(self._get_mood_context())

        if any(kw in msg for kw in ["运动", "锻炼", "健身", "活动", "exercise"]):
            parts.append(self._get_activity_context())

        if any(kw in msg for kw in ["趋势", "变化", "trend"]):
            parts.append(self._get_trend_context())

        if any(kw in msg for kw in ["最好", "最佳", "最高", "best"]):
            parts.append(self._get_best_day_context())

        if any(kw in msg for kw in ["最差", "最低", "worst"]):
            parts.append(self._get_worst_day_context())

        return "\n\n".join(p for p in parts if p)

    def _gather_rag_context(self, message: str) -> str:
        """通过 RAG 语义检索相关记录"""
        if not self.rag_service:
            return ""
        try:
            results = self.rag_service.search(message, n_results=5)
            if not results:
                return ""
            lines = []
            for i, r in enumerate(results, 1):
                date = r["metadata"].get("date", "")
                cat = r["metadata"].get("category", "")
                lines.append(f"[语义检索 {i}] ({date} {cat}) {r['document']}")
            return "\n".join(lines)
        except Exception as e:
            logger.warning(f"RAG 检索失败: {e}")
            return ""

    def _build_system_prompt(self, db_context: str, rag_context: str) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M %A")
        prompt = f"""你是 Vibing u 的 AI 生活助手。当前: {now}

规则: 基于数据回答，Markdown格式，含emoji，简洁有洞察，中文回答，不编造数据。"""
        return prompt

    def _build_user_prompt(self, message: str, db_context: str, rag_context: str, has_history: bool = False) -> str:
        """将数据上下文放入 user message 而不是 system prompt，避免 token 超限"""
        # 有历史对话时压缩上下文，避免 token 超限
        max_ctx = 800 if has_history else 1500
        max_rag = 500 if has_history else 800
        
        db_ctx = db_context[:max_ctx] if len(db_context) > max_ctx else db_context
        rag_ctx = rag_context[:max_rag] if len(rag_context) > max_rag else rag_context
        
        parts = [f"我的问题: {message}", "", "== 数据 ==", db_ctx]
        if rag_ctx:
            parts.extend(["", "== 相关记录 ==", rag_ctx])
        parts.append("\n请回答。")
        return "\n".join(parts)

    # =====================================================
    # 数据库查询 helpers
    # =====================================================

    def _get_overview_context(self) -> str:
        """基础概览"""
        total = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False
        ).count()
        week_start = datetime.now() - timedelta(days=7)
        week_count = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= week_start,
        ).count()

        cats = self.db.query(
            LifeStream.category, func.count(LifeStream.id)
        ).filter(
            LifeStream.is_deleted == False
        ).group_by(LifeStream.category).all()

        cat_str = ", ".join(f"{c}: {n}条" for c, n in cats if c)
        return f"[概览] 总记录 {total} 条, 最近7天 {week_count} 条。各类别: {cat_str}"

    def _get_today_context(self) -> str:
        today = datetime.now().date()
        start = datetime.combine(today, datetime.min.time())
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[今日] 今天还没有记录"

        cats = defaultdict(int)
        insights = []
        for r in records:
            if r.category:
                cats[r.category] += 1
            if r.ai_insight:
                insights.append(f"  - [{r.category}] {r.ai_insight[:80]}")

        cat_str = ", ".join(f"{c}: {n}" for c, n in cats.items())
        result = f"[今日] 共 {len(records)} 条。类别: {cat_str}"
        if insights:
            result += "\nAI 洞察:\n" + "\n".join(insights[:5])
        return result

    def _get_week_context(self) -> str:
        start = datetime.now() - timedelta(days=7)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[本周] 无记录"

        daily = defaultdict(int)
        daily_scores = defaultdict(list)
        for r in records:
            if r.created_at:
                day = r.created_at.strftime("%m/%d")
                daily[day] += 1
                if r.dimension_scores:
                    avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                    daily_scores[day].append(avg)

        lines = [f"[本周] 共 {len(records)} 条"]
        for day in sorted(daily.keys()):
            avg = sum(daily_scores[day]) / len(daily_scores[day]) if daily_scores[day] else None
            score_str = f" 平均 {avg:.0f}分" if avg else ""
            lines.append(f"  {day}: {daily[day]}条{score_str}")
        return "\n".join(lines)

    def _get_month_context(self) -> str:
        start = datetime.now() - timedelta(days=30)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[本月] 无记录"

        cats = defaultdict(int)
        total_score, score_n = 0, 0
        for r in records:
            if r.category:
                cats[r.category] += 1
            if r.dimension_scores:
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                total_score += avg
                score_n += 1

        avg_score = total_score / score_n if score_n else None
        cat_str = ", ".join(f"{c}: {n}" for c, n in sorted(cats.items(), key=lambda x: x[1], reverse=True))
        score_str = f", 平均状态分 {avg_score:.1f}" if avg_score else ""
        return f"[本月] 共 {len(records)} 条{score_str}。类别: {cat_str}"

    def _get_sleep_context(self) -> str:
        start = datetime.now() - timedelta(days=14)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.category == "SLEEP",
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[睡眠] 最近14天无睡眠记录"

        lines = [f"[睡眠] 最近14天共 {len(records)} 条"]
        for r in records:
            date = r.created_at.strftime("%m/%d") if r.created_at else "?"
            meta = r.meta_data or {}
            duration = meta.get("duration_hours") or meta.get("total_hours")
            sleep_t = meta.get("sleep_time", "")
            wake_t = meta.get("wake_time", "")
            insight = (r.ai_insight or "")[:60]
            info = f"  {date}: "
            if duration:
                info += f"{duration}h "
            if sleep_t:
                info += f"入睡{sleep_t} "
            if wake_t:
                info += f"醒来{wake_t} "
            if insight:
                info += f"- {insight}"
            lines.append(info)
        return "\n".join(lines)

    def _get_mood_context(self) -> str:
        start = datetime.now() - timedelta(days=14)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.category == "MOOD",
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[心情] 最近14天无心情记录"

        lines = [f"[心情] 最近14天共 {len(records)} 条"]
        for r in records:
            date = r.created_at.strftime("%m/%d") if r.created_at else "?"
            tags = ", ".join(r.tags[:3]) if r.tags else ""
            insight = (r.ai_insight or "")[:60]
            lines.append(f"  {date}: {tags} - {insight}" if insight else f"  {date}: {tags}")
        return "\n".join(lines)

    def _get_activity_context(self) -> str:
        start = datetime.now() - timedelta(days=14)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.category == "ACTIVITY",
            LifeStream.created_at >= start,
        ).all()
        if not records:
            return "[运动] 最近14天无运动记录"

        lines = [f"[运动] 最近14天共 {len(records)} 条"]
        for r in records:
            date = r.created_at.strftime("%m/%d") if r.created_at else "?"
            insight = (r.ai_insight or "")[:60]
            lines.append(f"  {date}: {insight}")
        return "\n".join(lines)

    def _get_trend_context(self) -> str:
        start = datetime.now() - timedelta(days=14)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= start,
        ).order_by(LifeStream.created_at).all()
        if len(records) < 3:
            return "[趋势] 数据不足"

        daily_scores = defaultdict(list)
        for r in records:
            if r.created_at and r.dimension_scores:
                day = r.created_at.strftime("%m/%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[day].append(avg)

        if not daily_scores:
            return "[趋势] 无评分数据"

        lines = ["[趋势] 每日平均状态分:"]
        for day in sorted(daily_scores.keys()):
            avg = sum(daily_scores[day]) / len(daily_scores[day])
            bar = "█" * int(avg / 10) + "░" * (10 - int(avg / 10))
            lines.append(f"  {day}: {bar} {avg:.0f}")
        return "\n".join(lines)

    def _get_best_day_context(self) -> str:
        return self._get_extreme_day_context(best=True)

    def _get_worst_day_context(self) -> str:
        return self._get_extreme_day_context(best=False)

    def _get_extreme_day_context(self, best: bool) -> str:
        start = datetime.now() - timedelta(days=30)
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted == False,
            LifeStream.created_at >= start,
        ).all()

        daily_scores = defaultdict(list)
        for r in records:
            if r.created_at and r.dimension_scores:
                day = r.created_at.strftime("%Y-%m-%d")
                avg = sum(r.dimension_scores.values()) / len(r.dimension_scores)
                daily_scores[day].append(avg)

        if not daily_scores:
            return f"[{'最佳' if best else '最差'}日] 数据不足"

        averaged = {d: sum(s) / len(s) for d, s in daily_scores.items()}
        target = max(averaged, key=averaged.get) if best else min(averaged, key=averaged.get)
        label = "最佳" if best else "最差"
        return f"[{label}日] 最近30天{label}日: {target} 平均分 {averaged[target]:.1f}"

    # =====================================================
    # 降级逻辑
    # =====================================================

    def _fallback_no_ai(self, message: str) -> Dict[str, Any]:
        """无 AI Key 时的降级回复"""
        ctx = self._gather_db_context(message)
        return {
            "type": "markdown",
            "content": f"⚠️ AI 服务暂时不可用，以下是原始数据供参考：\n\n```\n{ctx}\n```",
        }

    def _fallback_db_only(self, message: str) -> Dict[str, Any]:
        """LLM 调用失败时降级到纯数据展示"""
        ctx = self._gather_db_context(message)
        return {
            "type": "markdown",
            "content": f"AI 分析暂时不可用，为你查询到以下数据：\n\n```\n{ctx}\n```\n\n请稍后重试。",
        }


# 全局单例
_assistant: Optional[ChatAssistant] = None


def get_chat_assistant() -> ChatAssistant:
    """获取 ChatAssistant 单例"""
    global _assistant
    if _assistant is None:
        _assistant = ChatAssistant()
    return _assistant
