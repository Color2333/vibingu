"""Token 用量追踪服务"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import SessionLocal
from app.models.token_usage import TokenUsage, calculate_cost, TaskType


class TokenTracker:
    """Token 用量追踪器"""
    
    def __init__(self):
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    def record(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        task_type: str,
        task_description: Optional[str] = None,
        related_record_id: Optional[str] = None
    ) -> TokenUsage:
        """记录一次 token 使用"""
        total_tokens = prompt_tokens + completion_tokens
        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        
        # 确定模型类型 (支持 OpenAI 和 智谱AI)
        # 规则：先判断 embedding → 再判断 flash(免费) → 再判断 v(视觉) → 付费文本
        model_lower = model.lower()
        model_type = "other"
        if "embedding" in model_lower:
            model_type = "embedding"      # 嵌入模型 (embedding-3, text-embedding-3-small)
        elif "flash" in model_lower:
            if "v" in model_lower.split("flash")[0]:
                model_type = "vision_free" # 免费视觉 (glm-4.6v-flash)
            else:
                model_type = "text_free"   # 免费文本 (glm-4.7-flash)
        elif "4.6v" in model_lower or "4v" in model_lower:
            model_type = "vision"          # 付费视觉 (glm-4.6v)
        elif "gpt-4o-mini" in model_lower or "gpt-3.5" in model_lower:
            model_type = "text"            # 轻量文本 (gpt-4o-mini, gpt-3.5-turbo)
        elif "gpt-4o" in model_lower or ("glm-4" in model_lower and "flash" not in model_lower):
            model_type = "smart"           # 高级文本 (gpt-4o, glm-4.7)
        
        usage = TokenUsage(
            model=model,
            model_type=model_type,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost=cost,
            task_type=task_type,
            task_description=task_description,
            related_record_id=related_record_id
        )
        
        self.db.add(usage)
        self.db.commit()
        self.db.refresh(usage)
        
        return usage
    
    def get_usage_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """获取指定时间范围的用量统计"""
        query = self.db.query(TokenUsage)
        
        if start_date:
            query = query.filter(TokenUsage.created_at >= start_date)
        if end_date:
            query = query.filter(TokenUsage.created_at < end_date)
        
        records = query.all()
        
        if not records:
            return {
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_cost": 0,
                "request_count": 0,
                "by_model": {},
                "by_model_name": {},
                "by_task": {}
            }
        
        # 聚合统计
        total_tokens = sum(r.total_tokens for r in records)
        total_prompt = sum(r.prompt_tokens for r in records)
        total_completion = sum(r.completion_tokens for r in records)
        total_cost = sum(r.estimated_cost for r in records)
        
        # 按模型类型统计
        by_model: Dict[str, Dict] = {}
        for r in records:
            if r.model_type not in by_model:
                by_model[r.model_type] = {"tokens": 0, "cost": 0, "count": 0}
            by_model[r.model_type]["tokens"] += r.total_tokens
            by_model[r.model_type]["cost"] += r.estimated_cost
            by_model[r.model_type]["count"] += 1
        
        # 按具体模型名统计
        by_model_name: Dict[str, Dict] = {}
        for r in records:
            name = r.model or "unknown"
            if name not in by_model_name:
                by_model_name[name] = {"tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost": 0, "count": 0, "model_type": r.model_type}
            by_model_name[name]["tokens"] += r.total_tokens
            by_model_name[name]["prompt_tokens"] += r.prompt_tokens
            by_model_name[name]["completion_tokens"] += r.completion_tokens
            by_model_name[name]["cost"] += r.estimated_cost
            by_model_name[name]["count"] += 1
        
        # 按任务类型统计
        by_task: Dict[str, Dict] = {}
        for r in records:
            if r.task_type not in by_task:
                by_task[r.task_type] = {"tokens": 0, "cost": 0, "count": 0}
            by_task[r.task_type]["tokens"] += r.total_tokens
            by_task[r.task_type]["cost"] += r.estimated_cost
            by_task[r.task_type]["count"] += 1
        
        return {
            "total_tokens": total_tokens,
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "total_cost": round(total_cost, 4),
            "request_count": len(records),
            "by_model": by_model,
            "by_model_name": by_model_name,
            "by_task": by_task
        }
    
    def get_today_stats(self) -> Dict[str, Any]:
        """获取今日用量统计"""
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        return self.get_usage_stats(today, tomorrow)
    
    def get_week_stats(self) -> Dict[str, Any]:
        """获取本周用量统计"""
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today - timedelta(days=today.weekday())
        return self.get_usage_stats(week_start)
    
    def get_month_stats(self) -> Dict[str, Any]:
        """获取本月用量统计"""
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)
        return self.get_usage_stats(month_start)
    
    def get_recent_records(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取最近的 Token 使用记录"""
        records = (
            self.db.query(TokenUsage)
            .order_by(TokenUsage.created_at.desc())
            .limit(limit)
            .all()
        )
        
        task_labels = {
            "parse_input": "解析输入",
            "classify_image": "图片分类",
            "extract_data": "数据提取",
            "generate_tags": "生成标签",
            "generate_insight": "生成洞察",
            "rag_query": "RAG 查询",
            "embedding": "向量嵌入",
            "chat": "AI 对话",
            "daily_digest": "每日摘要",
            "score_dimensions": "维度评分",
            "other": "其他",
        }
        
        return [
            {
                "id": r.id,
                "time": r.created_at.strftime("%m-%d %H:%M") if r.created_at else "",
                "model": r.model,
                "model_type": r.model_type,
                "task": task_labels.get(r.task_type, r.task_type),
                "task_type": r.task_type,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "cost": round(r.estimated_cost, 6),
            }
            for r in records
        ]
    
    def get_daily_trend(self, days: int = 30) -> List[Dict[str, Any]]:
        """获取每日用量趋势"""
        end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start_date = end_date - timedelta(days=days)
        
        result = []
        current = start_date
        
        while current < end_date:
            next_day = current + timedelta(days=1)
            stats = self.get_usage_stats(current, next_day)
            result.append({
                "date": current.strftime("%Y-%m-%d"),
                "tokens": stats["total_tokens"],
                "cost": stats["total_cost"],
                "requests": stats["request_count"]
            })
            current = next_day
        
        return result


# 全局单例
_tracker: Optional[TokenTracker] = None


def get_tracker() -> TokenTracker:
    """获取 TokenTracker 单例"""
    global _tracker
    if _tracker is None:
        _tracker = TokenTracker()
    return _tracker


def record_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    task_type: str,
    task_description: Optional[str] = None,
    related_record_id: Optional[str] = None
) -> TokenUsage:
    """便捷函数：记录 token 使用"""
    tracker = get_tracker()
    return tracker.record(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        task_type=task_type,
        task_description=task_description,
        related_record_id=related_record_id
    )
