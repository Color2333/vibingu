"""
分析 API - Vibing Index 和关联分析
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models import LifeStream, DailySummary
from app.services.vibe_calculator import VibeCalculator
from app.services.dimension_analyzer import get_dimension_analyzer, DIMENSIONS

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class VibeScoreResponse(BaseModel):
    """Vibing Index 响应"""
    date: date
    vibe_score: Optional[int] = None
    dimension_averages: Optional[dict] = None  # LLM 模式: 八维度平均分
    sleep_score: Optional[int] = None          # 规则模式 fallback
    diet_score: Optional[int] = None
    screen_score: Optional[int] = None
    activity_score: Optional[int] = None
    insights: List[str] = []
    record_count: int = 0
    scoring_mode: str = "none"  # "llm" / "rules" / "none"


class TrendDataPoint(BaseModel):
    """趋势数据点"""
    date: date
    vibe_score: Optional[int]


class CorrelationResult(BaseModel):
    """关联分析结果"""
    factor: str
    correlation: str
    description: str
    data: dict


def _build_vibe_response(target_date: date, vibe_data: dict) -> VibeScoreResponse:
    """统一构建 VibeScoreResponse，兼容 LLM 和规则引擎两种模式"""
    return VibeScoreResponse(
        date=target_date,
        vibe_score=vibe_data.get("vibe_score"),
        dimension_averages=vibe_data.get("dimension_averages"),
        insights=vibe_data.get("insights", []),
        record_count=vibe_data.get("record_count", 0),
        scoring_mode=vibe_data.get("scoring_mode", "none"),
    )


@router.get("/vibe/today", response_model=VibeScoreResponse)
async def get_today_vibe(
    date_param: Optional[str] = Query(None, alias="date", description="指定日期 YYYY-MM-DD，默认今天"),
    db: Session = Depends(get_db),
):
    """获取今天（或指定日期）的 Vibing Index"""
    if date_param:
        try:
            target_date = datetime.strptime(date_param, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    else:
        target_date = date.today()
    
    calculator = VibeCalculator(db)
    vibe_data = calculator.calculate_daily_vibe(target_date)
    
    # 同时更新 daily_summary
    calculator.update_daily_summary(target_date)
    
    return _build_vibe_response(target_date, vibe_data)


@router.get("/vibe/{date_str}", response_model=VibeScoreResponse)
async def get_vibe_score(
    date_str: str,
    db: Session = Depends(get_db),
):
    """
    获取指定日期的 Vibing Index
    
    - **date_str**: 日期字符串，格式 YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    
    calculator = VibeCalculator(db)
    vibe_data = calculator.calculate_daily_vibe(target_date)
    
    # 同时更新 daily_summary
    calculator.update_daily_summary(target_date)
    
    return _build_vibe_response(target_date, vibe_data)


@router.get("/trend", response_model=List[TrendDataPoint])
async def get_vibe_trend(
    days: int = Query(7, ge=1, le=30, description="获取最近多少天的数据"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD，默认今天"),
    db: Session = Depends(get_db),
):
    """
    获取最近 N 天的 Vibing Index 趋势（以 end_date 为终点倒推 N 天）
    """
    calculator = VibeCalculator(db)
    trend = []
    
    if end_date:
        try:
            base_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            base_date = date.today()
    else:
        base_date = date.today()
    
    for i in range(days):
        target_date = base_date - timedelta(days=i)
        vibe_data = calculator.calculate_daily_vibe(target_date)
        trend.append(TrendDataPoint(
            date=target_date,
            vibe_score=vibe_data["vibe_score"],
        ))
    
    # 按日期正序返回
    trend.reverse()
    return trend


@router.get("/correlation", response_model=List[CorrelationResult])
async def get_correlations(
    date_str: Optional[str] = Query(None, description="指定日期，默认今天"),
    db: Session = Depends(get_db),
):
    """
    获取指定日期的关联分析
    
    分析当天的行为与状态之间的关联，例如：
    - 咖啡因摄入 vs 睡眠质量
    - 屏幕时间 vs 入睡时间
    """
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="日期格式错误")
    else:
        target_date = date.today()
    
    # 获取当天所有记录
    start_time = datetime.combine(target_date, datetime.min.time())
    end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
    
    records = db.query(LifeStream).filter(
        and_(
            LifeStream.created_at >= start_time,
            LifeStream.created_at < end_time
        )
    ).all()
    
    correlations = []
    
    # 分析咖啡因摄入
    diet_records = [r for r in records if r.category == "DIET"]
    total_caffeine = 0
    late_caffeine = False
    
    for r in diet_records:
        if r.meta_data:
            caffeine = r.meta_data.get("caffeine_mg") or r.meta_data.get("caffeine") or 0
            total_caffeine += float(caffeine)
            
            # 检查是否下午2点后摄入咖啡因
            if r.created_at and r.created_at.hour >= 14 and caffeine > 0:
                late_caffeine = True
    
    if total_caffeine > 0:
        correlation = "positive" if total_caffeine < 200 else "negative"
        description = f"今日咖啡因摄入: {total_caffeine}mg"
        if late_caffeine:
            description += " (下午2点后有摄入，可能影响睡眠)"
            correlation = "negative"
        
        correlations.append(CorrelationResult(
            factor="咖啡因",
            correlation=correlation,
            description=description,
            data={"total_mg": total_caffeine, "late_intake": late_caffeine}
        ))
    
    # 分析屏幕时间
    screen_records = [r for r in records if r.category == "SCREEN"]
    total_screen_hours = 0
    
    for r in screen_records:
        if r.meta_data:
            hours = r.meta_data.get("screen_hours") or r.meta_data.get("screen_time") or 0
            total_screen_hours += float(hours)
    
    if total_screen_hours > 0:
        correlation = "positive" if total_screen_hours < 4 else "negative"
        description = f"今日屏幕时间: {total_screen_hours:.1f}小时"
        if total_screen_hours > 6:
            description += " (超过推荐值，注意用眼健康)"
        
        correlations.append(CorrelationResult(
            factor="屏幕时间",
            correlation=correlation,
            description=description,
            data={"total_hours": total_screen_hours}
        ))
    
    # 分析活动量
    activity_records = [r for r in records if r.category == "ACTIVITY"]
    activity_count = len(activity_records)
    
    if activity_count > 0:
        correlations.append(CorrelationResult(
            factor="运动活动",
            correlation="positive",
            description=f"今日活动记录: {activity_count}次",
            data={"count": activity_count}
        ))
    else:
        correlations.append(CorrelationResult(
            factor="运动活动",
            correlation="neutral",
            description="今天还没有运动记录",
            data={"count": 0}
        ))
    
    return correlations


@router.post("/recalculate")
async def recalculate_vibe(
    date_str: Optional[str] = Query(None, description="指定日期，默认今天"),
    db: Session = Depends(get_db),
):
    """
    重新计算并更新指定日期的 Vibing Index
    """
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="日期格式错误")
    else:
        target_date = date.today()
    
    calculator = VibeCalculator(db)
    summary = calculator.update_daily_summary(target_date)
    
    return {
        "date": target_date.isoformat(),
        "vibe_score": summary.vibe_score,
        "message": "已更新"
    }


# ========== v0.2 八维度分析 API ==========

@router.get("/dimensions/meta")
async def get_dimensions_meta():
    """获取八维度定义元数据"""
    return {
        "dimensions": {
            key: {
                "name": value["name"],
                "icon": value["icon"],
                "description": value["description"],
                "weight": value["weight"]
            }
            for key, value in DIMENSIONS.items()
        },
        "total_dimensions": len(DIMENSIONS)
    }


@router.get("/dimensions/today")
async def get_today_dimensions(
    date_param: Optional[str] = Query(None, alias="date", description="指定日期 YYYY-MM-DD，默认今天"),
):
    """获取今日（或指定日期）的八维度分析"""
    target_dt = None
    if date_param:
        try:
            target_dt = datetime.strptime(date_param, "%Y-%m-%d")
        except ValueError:
            pass
    analyzer = get_dimension_analyzer()
    return analyzer.get_daily_dimension_summary(target_dt)


@router.get("/dimensions/radar/today")
async def get_today_radar(
    date_param: Optional[str] = Query(None, alias="date", description="指定日期 YYYY-MM-DD，默认今天"),
):
    """获取今日（或指定日期）八维度雷达图数据"""
    target_dt = None
    if date_param:
        try:
            target_dt = datetime.strptime(date_param, "%Y-%m-%d")
        except ValueError:
            pass
    analyzer = get_dimension_analyzer()
    return analyzer.get_dimension_radar_data(target_dt)


@router.get("/dimensions/radar/{date_str}")
async def get_radar_data(date_str: str):
    """
    获取指定日期的八维度雷达图数据
    
    - **date_str**: 日期字符串，格式 YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    
    analyzer = get_dimension_analyzer()
    return analyzer.get_dimension_radar_data(target_date)


@router.get("/dimensions/{date_str}")
async def get_dimensions(date_str: str):
    """
    获取指定日期的八维度分析
    
    - **date_str**: 日期字符串，格式 YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    
    analyzer = get_dimension_analyzer()
    return analyzer.get_daily_dimension_summary(target_date)
