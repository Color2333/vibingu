"""智能标签 API - 标签管理和分析"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict

from app.database import get_db
from app.models import LifeStream

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("/cloud")
async def get_tag_cloud(
    days: int = Query(30, ge=1, le=365, description="统计天数"),
    limit: int = Query(50, ge=10, le=100, description="返回数量"),
    db: Session = Depends(get_db),
):
    """
    获取标签云数据
    
    返回最常用的标签及其使用频率
    """
    start_date = datetime.now() - timedelta(days=days)
    
    records = db.query(LifeStream).filter(
        LifeStream.created_at >= start_date,
        LifeStream.tags.isnot(None)
    ).all()
    
    # 统计标签频率
    tag_counts: Dict[str, int] = defaultdict(int)
    
    for record in records:
        if record.tags:
            for tag in record.tags:
                tag_counts[tag] += 1
    
    # 排序并限制数量
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    # 计算权重 (用于可视化)
    max_count = sorted_tags[0][1] if sorted_tags else 1
    
    return {
        "period_days": days,
        "total_tags": len(tag_counts),
        "tags": [
            {
                "tag": tag,
                "count": count,
                "weight": round(count / max_count * 100, 1),
                "category": tag.split("/")[0].lstrip("#") if "/" in tag else "其他"
            }
            for tag, count in sorted_tags
        ]
    }


@router.get("/hierarchy")
async def get_tag_hierarchy(
    days: int = Query(30, ge=1, le=365, description="统计天数"),
    db: Session = Depends(get_db),
):
    """
    获取标签层级结构
    
    按分类组织标签
    """
    start_date = datetime.now() - timedelta(days=days)
    
    records = db.query(LifeStream).filter(
        LifeStream.created_at >= start_date,
        LifeStream.tags.isnot(None)
    ).all()
    
    # 按分类组织标签
    hierarchy: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    
    for record in records:
        if record.tags:
            for tag in record.tags:
                if "/" in tag:
                    parts = tag.lstrip("#").split("/", 1)
                    category = parts[0]
                    sub_tag = parts[1] if len(parts) > 1 else ""
                    hierarchy[category][sub_tag] += 1
                else:
                    hierarchy["其他"][tag.lstrip("#")] += 1
    
    # 转换为列表格式
    result = []
    for category, sub_tags in sorted(hierarchy.items(), key=lambda x: sum(x[1].values()), reverse=True):
        sorted_subs = sorted(sub_tags.items(), key=lambda x: x[1], reverse=True)
        result.append({
            "category": category,
            "count": sum(sub_tags.values()),
            "children": [
                {"name": name, "count": count}
                for name, count in sorted_subs[:20]  # 每个分类最多显示20个子标签
            ]
        })
    
    return {
        "period_days": days,
        "categories": result
    }


@router.get("/search")
async def search_by_tags(
    tags: str = Query(..., description="标签列表，逗号分隔"),
    match_all: bool = Query(False, description="是否要求匹配所有标签"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
    db: Session = Depends(get_db),
):
    """
    按标签搜索记录
    
    - **tags**: 标签列表，如 "#时间/早晨,#饮食/咖啡"
    - **match_all**: 如果为 True，返回包含所有标签的记录；否则返回包含任一标签的记录
    """
    search_tags = [t.strip() for t in tags.split(",") if t.strip()]
    
    if not search_tags:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="请提供有效的标签")
    
    records = db.query(LifeStream).filter(
        LifeStream.tags.isnot(None)
    ).order_by(LifeStream.created_at.desc()).limit(1000).all()
    
    # 过滤匹配的记录
    matched = []
    for record in records:
        if record.tags:
            if match_all:
                if all(tag in record.tags for tag in search_tags):
                    matched.append(record)
            else:
                if any(tag in record.tags for tag in search_tags):
                    matched.append(record)
        
        if len(matched) >= limit:
            break
    
    return {
        "search_tags": search_tags,
        "match_all": match_all,
        "count": len(matched),
        "records": [
            {
                "id": str(r.id),
                "category": r.category,
                "raw_content": r.raw_content,
                "tags": r.tags,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "ai_insight": r.ai_insight,
            }
            for r in matched
        ]
    }


@router.get("/trends")
async def get_tag_trends(
    tag: str = Query(..., description="要查看趋势的标签"),
    days: int = Query(30, ge=7, le=365, description="统计天数"),
    db: Session = Depends(get_db),
):
    """
    获取特定标签的使用趋势
    """
    start_date = datetime.now() - timedelta(days=days)
    
    records = db.query(LifeStream).filter(
        LifeStream.created_at >= start_date,
        LifeStream.tags.isnot(None)
    ).all()
    
    # 按天统计
    daily_counts: Dict[str, int] = defaultdict(int)
    
    for record in records:
        if record.tags and tag in record.tags:
            date_str = record.created_at.strftime("%Y-%m-%d")
            daily_counts[date_str] += 1
    
    # 生成完整的日期序列
    trend = []
    current = datetime.now() - timedelta(days=days)
    end = datetime.now()
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        trend.append({
            "date": date_str,
            "count": daily_counts.get(date_str, 0)
        })
        current += timedelta(days=1)
    
    total_count = sum(daily_counts.values())
    
    return {
        "tag": tag,
        "period_days": days,
        "total_count": total_count,
        "average": round(total_count / days, 2),
        "trend": trend
    }


@router.get("/related")
async def get_related_tags(
    tag: str = Query(..., description="查找相关标签的源标签"),
    limit: int = Query(20, ge=5, le=50, description="返回数量"),
    db: Session = Depends(get_db),
):
    """
    获取经常一起出现的相关标签
    """
    records = db.query(LifeStream).filter(
        LifeStream.tags.isnot(None)
    ).all()
    
    # 统计共现频率
    cooccurrence: Dict[str, int] = defaultdict(int)
    tag_count = 0
    
    for record in records:
        if record.tags and tag in record.tags:
            tag_count += 1
            for other_tag in record.tags:
                if other_tag != tag:
                    cooccurrence[other_tag] += 1
    
    # 排序
    sorted_related = sorted(cooccurrence.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    return {
        "source_tag": tag,
        "source_tag_count": tag_count,
        "related_tags": [
            {
                "tag": related_tag,
                "count": count,
                "percentage": round(count / tag_count * 100, 1) if tag_count > 0 else 0
            }
            for related_tag, count in sorted_related
        ]
    }
