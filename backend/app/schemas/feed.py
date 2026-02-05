from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class FeedRequest(BaseModel):
    """投喂请求"""
    text: Optional[str] = None
    image_base64: Optional[str] = None
    category_hint: Optional[str] = None


class FeedResponse(BaseModel):
    """投喂响应"""
    id: str
    category: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    ai_insight: str
    created_at: datetime
    
    # 图片相关字段
    image_saved: bool = False
    image_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    
    # v0.2 新增: 智能标签和维度分析
    tags: Optional[List[str]] = None
    dimension_scores: Optional[Dict[str, float]] = None
    
    class Config:
        from_attributes = True
