"""RAG API - 个人知识库"""

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.services.rag import get_rag_service

router = APIRouter(prefix="/api/rag", tags=["rag"])


class AskRequest(BaseModel):
    """问答请求"""
    question: str
    n_context: int = 5


class SearchRequest(BaseModel):
    """搜索请求"""
    query: str
    n_results: int = 5
    category: Optional[str] = None


@router.get("/stats")
async def get_stats():
    """
    获取 RAG 系统统计信息
    """
    rag = get_rag_service()
    return rag.get_stats()


@router.post("/index/all")
async def index_all_records(background_tasks: BackgroundTasks):
    """
    索引所有记录到向量数据库
    
    注意：这个操作可能需要一些时间，会在后台执行
    """
    rag = get_rag_service()
    
    # 直接执行（如果记录不多的话）
    result = rag.index_all_records()
    
    return {
        "status": "completed",
        **result
    }


@router.post("/index/recent")
async def index_recent_records(
    days: int = Query(7, ge=1, le=365, description="最近天数")
):
    """
    索引最近的记录
    """
    rag = get_rag_service()
    result = rag.index_recent_records(days)
    
    return {
        "status": "completed",
        **result
    }


@router.post("/search")
async def search(request: SearchRequest):
    """
    语义搜索
    
    在个人生活记录中搜索相关内容
    """
    rag = get_rag_service()
    results = rag.search(
        query=request.query,
        n_results=request.n_results,
        category=request.category
    )
    
    return {
        "query": request.query,
        "results": results,
        "count": len(results)
    }


@router.get("/search")
async def search_get(
    q: str = Query(..., description="搜索查询"),
    n: int = Query(5, ge=1, le=20, description="返回数量"),
    category: Optional[str] = Query(None, description="类别过滤")
):
    """
    语义搜索 (GET 方式)
    """
    rag = get_rag_service()
    results = rag.search(query=q, n_results=n, category=category)
    
    return {
        "query": q,
        "results": results,
        "count": len(results)
    }


@router.post("/ask")
async def ask_question(request: AskRequest):
    """
    RAG 问答
    
    基于个人生活数据回答问题
    """
    rag = get_rag_service()
    result = rag.ask(
        question=request.question,
        n_context=request.n_context
    )
    
    return result


@router.get("/ask")
async def ask_get(
    q: str = Query(..., description="问题"),
    n: int = Query(5, ge=1, le=10, description="上下文数量")
):
    """
    RAG 问答 (GET 方式)
    """
    rag = get_rag_service()
    result = rag.ask(question=q, n_context=n)
    
    return result


@router.get("/similar-days")
async def find_similar_days(
    date: Optional[str] = Query(None, description="目标日期 YYYY-MM-DD"),
    n: int = Query(5, ge=1, le=10, description="返回数量")
):
    """
    找出相似的日子
    
    基于某一天的记录，找出历史上相似的日子
    """
    target_date = None
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    
    rag = get_rag_service()
    results = rag.find_similar_days(date=target_date, n_results=n)
    
    return {
        "target_date": date or datetime.now().strftime("%Y-%m-%d"),
        "similar_days": results,
        "count": len(results)
    }


@router.delete("/index")
async def clear_index():
    """
    清空向量索引
    
    删除所有已索引的向量数据（不影响原始记录）
    """
    rag = get_rag_service()
    result = rag.clear_index()
    
    return {
        "status": "cleared",
        **result
    }
