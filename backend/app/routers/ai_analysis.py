"""
AI 分析 API - 基于 AI 的数据分析和洞察
"""

from fastapi import APIRouter, Query
from typing import Optional
from pydantic import BaseModel

from app.services.ai_analyzer import get_ai_analyzer

router = APIRouter(prefix="/api/ai", tags=["ai-analysis"])


class DeepInsightRequest(BaseModel):
    """深度洞察请求"""
    question: str


@router.get("/weekly-analysis")
async def get_weekly_analysis():
    """
    获取 AI 周度分析报告
    
    基于过去 7 天的数据生成综合分析
    """
    analyzer = get_ai_analyzer()
    return await analyzer.analyze_weekly_data()


@router.get("/trends")
async def get_trend_analysis(
    days: int = Query(30, ge=7, le=90, description="分析天数")
):
    """
    获取 AI 趋势分析
    
    分析指定天数内的数据趋势和模式
    """
    analyzer = get_ai_analyzer()
    return await analyzer.analyze_trends(days)


@router.get("/daily-digest")
async def get_daily_digest():
    """
    获取今日 AI 综合洞察

    合并了健康提醒、异常检测、智能建议为一次 LLM 调用
    """
    analyzer = get_ai_analyzer()
    return await analyzer.generate_daily_digest()


@router.get("/suggestions")
async def get_smart_suggestions():
    """
    获取 AI 智能建议
    
    基于历史数据生成个性化建议
    """
    analyzer = get_ai_analyzer()
    return await analyzer.generate_smart_suggestions()


@router.post("/insight")
async def get_deep_insight(request: DeepInsightRequest):
    """
    深度洞察
    
    基于用户问题进行数据分析
    """
    analyzer = get_ai_analyzer()
    return await analyzer.deep_insight(request.question)
