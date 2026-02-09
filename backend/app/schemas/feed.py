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
    sub_categories: Optional[List[str]] = None
    meta_data: Optional[Dict[str, Any]] = None
    ai_insight: str
    created_at: datetime
    record_time: Optional[datetime] = None  # 实际发生时间（AI分析得出）
    
    # 图片相关字段
    image_saved: bool = False
    image_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    
    # v0.2 新增: 智能标签和维度分析
    tags: Optional[List[str]] = None
    dimension_scores: Optional[Dict[str, float]] = None
    
    # v0.3: 分步处理状态 — 标记哪些阶段失败了（前端可按需重试）
    # 可能的值: "tags", "dimension_scores", "ai_insight", "image_save", "rag_index"
    failed_phases: List[str] = []
    
    class Config:
        from_attributes = True


class RegenerateRequest(BaseModel):
    """重新生成请求"""
    phases: List[str]  # 要重新生成的阶段: "tags", "dimension_scores", "ai_insight"


class RegenerateResponse(BaseModel):
    """重新生成响应"""
    id: str
    # 更新后的字段（只返回有变化的）
    tags: Optional[List[str]] = None
    dimension_scores: Optional[Dict[str, float]] = None
    ai_insight: Optional[str] = None
    # 仍然失败的阶段
    failed_phases: List[str] = []
