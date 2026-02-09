from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import date, datetime

from app.database import get_db
from app.models import LifeStream, DailySummary, Category
from app.schemas.history import LifeStreamItem, DailySummaryResponse

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/feed/history", response_model=List[LifeStreamItem])
async def get_feed_history(
    limit: int = Query(20, ge=1, le=100, description="返回记录数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    category: Optional[str] = Query(None, description="按分类筛选"),
    db: Session = Depends(get_db),
):
    """
    获取投喂历史记录
    
    - **limit**: 返回记录数量，默认20
    - **offset**: 偏移量，用于分页
    - **category**: 按分类筛选（SLEEP, DIET, SCREEN, ACTIVITY, MOOD）
    """
    query = db.query(LifeStream).order_by(desc(LifeStream.created_at))
    
    if category:
        cat_upper = category.upper()
        from sqlalchemy import or_
        query = query.filter(
            or_(
                LifeStream.category == cat_upper,
                LifeStream.sub_categories.like(f'%"{cat_upper}"%'),
            )
        )
    
    records = query.offset(offset).limit(limit).all()
    
    return [
        LifeStreamItem(
            id=str(record.id),
            input_type=record.input_type,
            category=record.category,
            raw_content=record.raw_content,
            meta_data=record.meta_data,
            ai_insight=record.ai_insight,
            created_at=record.created_at,
        )
        for record in records
    ]


@router.get("/daily/{date_str}", response_model=DailySummaryResponse)
async def get_daily_summary(
    date_str: str,
    db: Session = Depends(get_db),
):
    """
    获取某日汇总
    
    - **date_str**: 日期字符串，格式 YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    
    summary = db.query(DailySummary).filter(DailySummary.date == target_date).first()
    
    if not summary:
        # 返回空的汇总
        return DailySummaryResponse(
            date=target_date,
            vibe_score=None,
            energy_level=None,
            sleep_duration=None,
            screen_time=None,
            daily_summary_text=None,
        )
    
    return DailySummaryResponse(
        date=summary.date,
        vibe_score=summary.vibe_score,
        energy_level=summary.energy_level,
        sleep_duration=summary.sleep_duration,
        screen_time=summary.screen_time,
        wake_time=summary.wake_time,
        bed_time=summary.bed_time,
        daily_summary_text=summary.daily_summary_text,
    )
