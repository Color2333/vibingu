from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, date


class LifeStreamItem(BaseModel):
    """生活流记录项"""
    id: str
    input_type: str
    category: Optional[str] = None
    raw_content: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    ai_insight: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DailySummaryResponse(BaseModel):
    """每日汇总响应"""
    date: date
    vibe_score: Optional[int] = None
    energy_level: Optional[int] = None
    sleep_duration: Optional[float] = None
    screen_time: Optional[float] = None
    wake_time: Optional[datetime] = None
    bed_time: Optional[datetime] = None
    daily_summary_text: Optional[str] = None
    
    class Config:
        from_attributes = True
