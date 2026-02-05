"""Token 用量统计 API"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timedelta

from app.services.token_tracker import get_tracker

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


@router.get("/stats")
async def get_token_stats(
    period: str = Query("today", description="统计周期: today, week, month, all")
):
    """获取 Token 用量统计"""
    tracker = get_tracker()
    
    if period == "today":
        stats = tracker.get_today_stats()
    elif period == "week":
        stats = tracker.get_week_stats()
    elif period == "month":
        stats = tracker.get_month_stats()
    else:
        stats = tracker.get_usage_stats()
    
    return {
        "period": period,
        **stats
    }


@router.get("/summary")
async def get_token_summary():
    """获取 Token 用量概览 (今日/本周/本月)"""
    tracker = get_tracker()
    
    today = tracker.get_today_stats()
    week = tracker.get_week_stats()
    month = tracker.get_month_stats()
    
    return {
        "today": {
            "tokens": today["total_tokens"],
            "cost": today["total_cost"],
            "requests": today["request_count"]
        },
        "week": {
            "tokens": week["total_tokens"],
            "cost": week["total_cost"],
            "requests": week["request_count"]
        },
        "month": {
            "tokens": month["total_tokens"],
            "cost": month["total_cost"],
            "requests": month["request_count"]
        }
    }


@router.get("/trend")
async def get_token_trend(
    days: int = Query(30, ge=1, le=365, description="天数")
):
    """获取 Token 用量趋势"""
    tracker = get_tracker()
    trend = tracker.get_daily_trend(days)
    
    return {
        "days": days,
        "trend": trend
    }


@router.get("/by-model")
async def get_usage_by_model(
    period: str = Query("month", description="统计周期: today, week, month, all")
):
    """按模型统计用量"""
    tracker = get_tracker()
    
    if period == "today":
        stats = tracker.get_today_stats()
    elif period == "week":
        stats = tracker.get_week_stats()
    elif period == "month":
        stats = tracker.get_month_stats()
    else:
        stats = tracker.get_usage_stats()
    
    return {
        "period": period,
        "by_model": stats.get("by_model", {})
    }


@router.get("/by-task")
async def get_usage_by_task(
    period: str = Query("month", description="统计周期: today, week, month, all")
):
    """按任务类型统计用量"""
    tracker = get_tracker()
    
    if period == "today":
        stats = tracker.get_today_stats()
    elif period == "week":
        stats = tracker.get_week_stats()
    elif period == "month":
        stats = tracker.get_month_stats()
    else:
        stats = tracker.get_usage_stats()
    
    return {
        "period": period,
        "by_task": stats.get("by_task", {})
    }
