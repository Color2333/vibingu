"""时间智能分析 API

增强版 v0.2:
- AI 驱动的时间洞察
- 最佳状态条件分析
- 智能提醒生成
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.services.time_intelligence import get_time_intelligence

router = APIRouter(prefix="/api/time", tags=["time-intelligence"])


@router.get("/circadian")
async def get_circadian_rhythm(
    days: int = Query(30, ge=7, le=365, description="分析天数")
):
    """
    获取昼夜节律分析
    
    返回24小时活动分布、高峰/低谷时段、生物钟类型
    """
    ti = get_time_intelligence()
    return ti.analyze_circadian_rhythm(days)


@router.get("/weekly")
async def get_weekly_pattern(
    weeks: int = Query(8, ge=2, le=52, description="分析周数")
):
    """
    获取周周期模式
    
    返回星期几的活动分布、工作日vs周末对比
    """
    ti = get_time_intelligence()
    return ti.analyze_weekly_pattern(weeks)


@router.get("/monthly")
async def get_monthly_pattern(
    months: int = Query(6, ge=1, le=24, description="分析月数")
):
    """
    获取月度周期模式
    
    返回月初/月中/月末对比、季节性趋势
    """
    ti = get_time_intelligence()
    return ti.analyze_monthly_pattern(months)


@router.get("/bio-clock")
async def get_bio_clock_profile():
    """
    获取个人生物钟画像
    
    综合分析最佳工作时段、睡眠窗口、运动时间等
    """
    ti = get_time_intelligence()
    return ti.get_bio_clock_profile()


@router.get("/hourly")
async def get_hourly_distribution(
    days: int = Query(30, ge=7, le=365, description="分析天数")
):
    """
    获取24小时活动分布（用于环形图）
    """
    ti = get_time_intelligence()
    return ti.get_hourly_distribution(days)


@router.get("/heatmap")
async def get_heatmap_data(
    year: Optional[int] = Query(None, description="年份，默认当前年")
):
    """
    获取年度热力图数据
    
    返回每天的活动计数和平均分数
    """
    ti = get_time_intelligence()
    return ti.get_heatmap_data(year)


@router.get("/emotion-trend")
async def get_emotion_trend(
    days: int = Query(30, ge=7, le=365, description="分析天数")
):
    """
    获取情绪趋势数据（用于河流图/面积图）
    
    返回每天各维度的得分趋势
    """
    ti = get_time_intelligence()
    return ti.get_emotion_trend(days)


@router.get("/mood-distribution")
async def get_mood_distribution(
    days: int = Query(30, ge=7, le=365, description="分析天数")
):
    """
    获取心情分布数据
    
    统计各心情状态的出现频率
    """
    ti = get_time_intelligence()
    return ti.get_mood_distribution(days)


@router.get("/ai-insights")
async def get_ai_time_insights(
    days: int = Query(30, ge=7, le=90, description="分析天数")
):
    """
    获取 AI 驱动的时间智能洞察
    
    综合分析时间模式，生成个性化建议
    """
    ti = get_time_intelligence()
    return await ti.get_ai_time_insights(days)


@router.get("/best-conditions")
async def get_best_state_conditions(
    days: int = Query(60, ge=30, le=180, description="分析天数")
):
    """
    分析最佳状态的条件
    
    找出高效日的共同特征
    """
    ti = get_time_intelligence()
    return await ti.analyze_best_state_conditions(days)


@router.get("/smart-reminders")
async def get_smart_reminders():
    """
    获取智能提醒
    
    基于用户的时间模式生成个性化提醒
    """
    ti = get_time_intelligence()
    return await ti.get_smart_reminders()
