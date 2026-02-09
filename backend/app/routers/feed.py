"""
Feed API - 智能多模态数据投喂
集成三阶段 AI Agent 流程
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, AsyncGenerator
from pydantic import BaseModel
import base64
import os
import json
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import LifeStream, InputType, Category
from app.services.image_classifier import ImageClassifier
from app.services.data_extractor import DataExtractor
from app.services.image_storage import ImageStorage
from app.services.tagger import get_tagger
from app.services.dimension_analyzer import get_dimension_analyzer
from app.services.gamification import get_gamification_service
from app.schemas.feed import FeedResponse, RegenerateRequest, RegenerateResponse
from app.routers.auth import verify_token
from app.routers.settings import get_nickname

# 延迟加载 RAG 服务（避免启动时的循环导入）
_rag_service = None

def get_rag():
    global _rag_service
    if _rag_service is None:
        try:
            from app.services.rag import get_rag_service
            _rag_service = get_rag_service()
        except Exception as e:
            logger.warning(f"RAG 服务加载失败: {e}")
    return _rag_service

router = APIRouter(prefix="/api/feed", tags=["feed"])

# 初始化服务
image_classifier = ImageClassifier()
data_extractor = DataExtractor()
image_storage = ImageStorage(upload_dir="uploads")
tagger = get_tagger()
dimension_analyzer = get_dimension_analyzer()


# ========== Pydantic Models ==========
class RecordChatRequest(BaseModel):
    """记录对话请求"""
    message: str
    history: Optional[List[dict]] = None  # [{"role": "user/assistant", "content": "..."}]


class RecordChatResponse(BaseModel):
    """记录对话响应"""
    reply: str
    suggestions: Optional[List[str]] = None


def _generate_follow_up_suggestions(category: str) -> List[str]:
    """根据分类生成跟进问题建议"""
    base_suggestions = ["这条记录对我有什么启示？", "有什么改进建议吗？"]
    
    category_suggestions = {
        "SLEEP": ["我的睡眠质量如何？", "如何改善睡眠？"],
        "DIET": ["这顿饭营养均衡吗？", "有什么饮食建议？"],
        "ACTIVITY": ["这次运动效果怎么样？", "还能做什么运动？"],
        "MOOD": ["这种情绪是怎么产生的？", "如何保持好心情？"],
        "SCREEN": ["屏幕时间合理吗？", "如何减少屏幕依赖？"],
        "SOCIAL": ["这次社交有什么收获？", "如何提升社交质量？"],
        "WORK": ["工作效率如何？", "如何提高工作状态？"],
        "GROWTH": ["学到了什么？", "如何持续成长？"],
        "LEISURE": ["这次休闲放松了吗？", "还有什么休闲方式推荐？"],
    }
    
    return category_suggestions.get(category, base_suggestions)[:3]


# ========== Routes ==========

@router.post("", response_model=FeedResponse)
async def create_feed(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    category_hint: Optional[str] = Form(None),
    client_time: Optional[str] = Form(None),  # 客户端实时时间
    db: Session = Depends(get_db),
):
    """
    智能多模态数据投喂
    
    三阶段处理流程：
    1. Phase 1: 图片分类 - 判断图片类型和是否值得保存
    2. Phase 2: 数据提取 - 根据类型提取结构化数据
    3. Phase 3: 存储决策 - 决定是否保存原图
    
    - **text**: 文本输入（可选）
    - **image**: 图片文件（可选）
    - **category_hint**: 分类提示（可选）
    """
    if not text and not image:
        raise HTTPException(status_code=400, detail="请提供文本或图片输入")
    
    # 初始化变量
    input_type = InputType.TEXT.value
    image_base64 = None
    image_type = None
    should_save_image = False
    image_path = None
    thumbnail_path = None
    classification_result = None
    failed_phases: list[str] = []  # 追踪失败的阶段
    
    # ===== Phase 1: 图片分类 =====
    if image:
        # 文件大小限制：最大 10MB
        content = await image.read()
        MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=413, detail=f"图片大小超过限制（最大 {MAX_IMAGE_SIZE // 1024 // 1024}MB）")
        image_base64 = base64.b64encode(content).decode("utf-8")
        
        try:
            classification_result = await image_classifier.classify(
                image_base64=image_base64,
                text_hint=text or category_hint,
            )
            image_type = classification_result["image_type"]
            should_save_image = classification_result["should_save_image"]
        except Exception as e:
            logger.warning(f"[Phase 1] 图片分类失败，使用默认分类: {e}")
            classification_result = None
            image_type = "other"
            should_save_image = True
        
        if image_type in ["screenshot", "activity_screenshot", "sleep_screenshot"]:
            input_type = InputType.SCREENSHOT.value
        else:
            input_type = InputType.IMAGE.value
    
    # ===== Phase 2: 数据提取（核心，失败则自动重试一次） =====
    nickname = get_nickname(db)
    extract_result = {}
    ai_insight_failed = False
    for attempt in range(2):
        try:
            if image_base64:
                extract_result = await data_extractor.extract(
                    image_type=image_type or "other",
                    image_base64=image_base64,
                    text=text,
                    content_hint=classification_result.get("content_hint") if classification_result else None,
                    client_time=client_time,
                    nickname=nickname,
                )
            else:
                extract_result = await data_extractor.extract(
                    image_type="other",
                    text=text,
                    client_time=client_time,
                    nickname=nickname,
                )
            break  # 成功则跳出重试
        except Exception as e:
            if attempt == 0:
                logger.warning(f"[Phase 2] 数据提取失败，自动重试: {e}")
            else:
                logger.warning(f"[Phase 2] 数据提取重试仍失败，使用基础数据: {e}")
                ai_insight_failed = True
                failed_phases.append("ai_insight")
                # fallback 分类优先级: category_hint → 图片分类器建议 → MOOD
                fallback_category = "MOOD"
                if category_hint:
                    try:
                        fallback_category = Category(category_hint.upper()).value
                    except ValueError:
                        pass
                elif classification_result:
                    cat_s = classification_result.get("category_suggestion")
                    if cat_s:
                        try:
                            fallback_category = Category(cat_s.upper()).value
                        except ValueError:
                            pass
                extract_result = {
                    "category": fallback_category,
                    "meta_data": {"_ai_error": "AI 分析暂时不可用，数据已保存"},
                    "reply_text": text or "已记录（AI 分析暂时不可用）",
                }
    
    # ===== Phase 3: 存储决策 =====
    if should_save_image and image_base64:
        try:
            image_path, thumbnail_path = await image_storage.save_image(
                image_base64=image_base64,
                image_type=image_type or "other",
                compress=True,
                create_thumbnail=True,
            )
        except Exception as e:
            logger.error(f"[Phase 3] 图片保存失败: {e}")
            failed_phases.append("image_save")
            image_path = None
            thumbnail_path = None
    
    # 确定分类：AI 分类优先 → category_hint 次之 → 图片分类器建议 → 默认 MOOD
    category = extract_result.get("category")
    if not category:
        if category_hint:
            try:
                category = Category(category_hint.upper()).value
            except ValueError:
                pass
        if not category and classification_result:
            cat_suggestion = classification_result.get("category_suggestion")
            if cat_suggestion:
                try:
                    category = Category(cat_suggestion.upper()).value
                except ValueError:
                    pass
        if not category:
            category = "MOOD"
    
    # 合并元数据
    meta_data = extract_result.get("meta_data", {})
    if classification_result:
        meta_data["_classification"] = {
            "image_type": classification_result["image_type"],
            "confidence": classification_result["confidence"],
            "should_save": classification_result["should_save_image"],
        }
    
    # ===== Phase 4: 智能标签生成（失败则自动重试一次） =====
    tags = []
    for attempt in range(2):
        try:
            tags = await tagger.generate_tags(
                text=text,
                category=category,
                meta_data=meta_data,
                record_id=None,
            )
            if tags:
                break
        except Exception as e:
            if attempt == 0:
                logger.warning(f"[Phase 4] 标签生成失败，自动重试: {e}")
            else:
                logger.warning(f"[Phase 4] 标签生成重试仍失败: {e}")
                failed_phases.append("tags")
    if not tags and "tags" not in failed_phases:
        failed_phases.append("tags")
    
    # ===== Phase 5: 八维度评分（LLM 驱动，规则引擎 fallback） =====
    dimension_scores = extract_result.get("dimension_scores")
    if dimension_scores:
        logger.info(f"[Phase 5] 使用 LLM 维度评分: {dimension_scores}")
    else:
        try:
            dimension_scores = dimension_analyzer.calculate_dimension_scores(
                category=category or "MOOD",
                meta_data=meta_data,
                tags=tags,
            )
            logger.info(f"[Phase 5] Fallback 到规则引擎评分")
        except Exception as e:
            logger.warning(f"[Phase 5] 维度分析失败: {e}")
            failed_phases.append("dimension_scores")
            dimension_scores = {}
    
    # 确定记录发生时间
    record_time = extract_result.get("record_time")
    
    # 存入数据库
    life_stream = LifeStream(
        input_type=input_type,
        category=category,
        raw_content=text or (classification_result.get("content_hint") if classification_result else None),
        meta_data=meta_data,
        ai_insight=extract_result.get("reply_text"),
        image_type=image_type,
        image_path=image_path,
        thumbnail_path=thumbnail_path,
        image_saved=image_path is not None,
        tags=tags,
        dimension_scores=dimension_scores,
        record_time=record_time,
    )
    
    db.add(life_stream)
    try:
        db.commit()
        db.refresh(life_stream)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据保存失败: {e}")
    
    if failed_phases:
        logger.info(f"[结果] 记录已保存 (id={life_stream.id})，部分阶段失败: {failed_phases}")
    
    # ===== Phase 6: 游戏化奖励 =====
    try:
        gamification = get_gamification_service()
        gamification.update_streak()
        gamification.update_challenge_progress(None, category)
        gamification.check_and_award_badges()
    except Exception as e:
        logger.warning(f"[Phase 6] 游戏化更新失败: {e}")
    
    # ===== Phase 7: RAG 索引 =====
    try:
        rag = get_rag()
        if rag:
            rag.index_record(life_stream)
    except Exception as e:
        logger.warning(f"[Phase 7] RAG 索引失败: {e}")
        failed_phases.append("rag_index")
    
    return FeedResponse(
        id=str(life_stream.id),
        category=category,
        meta_data=meta_data,
        ai_insight=extract_result.get("reply_text", "已记录"),
        created_at=life_stream.created_at,
        record_time=life_stream.record_time or life_stream.created_at,
        image_saved=life_stream.image_saved,
        image_path=f"/api/feed/image/{image_path}" if image_path else None,
        thumbnail_path=f"/api/feed/image/{thumbnail_path}" if thumbnail_path else None,
        tags=tags,
        dimension_scores=dimension_scores,
        failed_phases=failed_phases,
    )


# ========== SSE 流式进度端点 ==========

def _sse_event(event_type: str, data: dict) -> str:
    """格式化 SSE 事件"""
    payload = json.dumps({**data, "type": event_type}, ensure_ascii=False)
    return f"data: {payload}\n\n"


@router.post("/stream")
async def create_feed_stream(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    category_hint: Optional[str] = Form(None),
    client_time: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    SSE 流式版本的 create_feed — 每完成一个阶段就推送事件给前端。
    
    事件类型:
    - phase: 阶段进度 {"phase": "xxx", "status": "start"|"done"|"error"}
    - result: 最终结果 (等同于 FeedResponse)
    - error: 致命错误
    """
    if not text and not image:
        # 对于非流式场景，直接返回错误
        async def error_gen():
            yield _sse_event("error", {"message": "请提供文本或图片输入"})
        return StreamingResponse(error_gen(), media_type="text/event-stream")
    
    # 预先读取图片（在生成器外部，因为 UploadFile 在生成器内可能已关闭）
    image_content = None
    if image:
        image_content = await image.read()
        MAX_IMAGE_SIZE = 10 * 1024 * 1024
        if len(image_content) > MAX_IMAGE_SIZE:
            async def size_error():
                yield _sse_event("error", {"message": f"图片大小超过限制（最大 10MB）"})
            return StreamingResponse(size_error(), media_type="text/event-stream")

    async def event_generator() -> AsyncGenerator[str, None]:
        nonlocal db
        
        input_type = InputType.TEXT.value
        image_base64 = None
        image_type = None
        should_save_image = False
        image_path = None
        thumbnail_path = None
        classification_result = None
        failed_phases: list[str] = []
        
        # ===== Phase 1: 图片分类 =====
        if image_content:
            yield _sse_event("phase", {"phase": "classify", "status": "start", "label": "图片分类"})
            image_base64 = base64.b64encode(image_content).decode("utf-8")
            
            try:
                classification_result = await image_classifier.classify(
                    image_base64=image_base64,
                    text_hint=text or category_hint,
                )
                image_type = classification_result["image_type"]
                should_save_image = classification_result["should_save_image"]
            except Exception as e:
                logger.warning(f"[Stream Phase 1] 图片分类失败: {e}")
                classification_result = None
                image_type = "other"
                should_save_image = True
            
            if image_type in ["screenshot", "activity_screenshot", "sleep_screenshot"]:
                input_type = InputType.SCREENSHOT.value
            else:
                input_type = InputType.IMAGE.value
            
            yield _sse_event("phase", {"phase": "classify", "status": "done"})
        
        # ===== Phase 2: 数据提取 =====
        yield _sse_event("phase", {"phase": "extract", "status": "start", "label": "AI 分析与提取"})
        nickname = get_nickname(db)
        extract_result = {}
        for attempt in range(2):
            try:
                if image_base64:
                    extract_result = await data_extractor.extract(
                        image_type=image_type or "other",
                        image_base64=image_base64,
                        text=text,
                        content_hint=classification_result.get("content_hint") if classification_result else None,
                        client_time=client_time,
                        nickname=nickname,
                    )
                else:
                    extract_result = await data_extractor.extract(
                        image_type="other",
                        text=text,
                        client_time=client_time,
                        nickname=nickname,
                    )
                break
            except Exception as e:
                if attempt == 0:
                    logger.warning(f"[Stream Phase 2] 数据提取失败，自动重试: {e}")
                    yield _sse_event("phase", {"phase": "extract", "status": "retry"})
                else:
                    logger.warning(f"[Stream Phase 2] 重试仍失败: {e}")
                    failed_phases.append("ai_insight")
                    # fallback 分类优先级: category_hint → 图片分类器建议 → MOOD
                    fallback_category = "MOOD"
                    if category_hint:
                        try:
                            fallback_category = Category(category_hint.upper()).value
                        except ValueError:
                            pass
                    elif classification_result:
                        cat_s = classification_result.get("category_suggestion")
                        if cat_s:
                            try:
                                fallback_category = Category(cat_s.upper()).value
                            except ValueError:
                                pass
                    extract_result = {
                        "category": fallback_category,
                        "meta_data": {"_ai_error": "AI 分析暂时不可用，数据已保存"},
                        "reply_text": text or "已记录（AI 分析暂时不可用）",
                    }
        yield _sse_event("phase", {"phase": "extract", "status": "done"})
        
        # ===== Phase 3: 图片存储 =====
        if should_save_image and image_base64:
            yield _sse_event("phase", {"phase": "save_image", "status": "start", "label": "保存图片"})
            try:
                image_path, thumbnail_path = await image_storage.save_image(
                    image_base64=image_base64,
                    image_type=image_type or "other",
                    compress=True,
                    create_thumbnail=True,
                )
            except Exception as e:
                logger.error(f"[Stream Phase 3] 图片保存失败: {e}")
                failed_phases.append("image_save")
                image_path = None
                thumbnail_path = None
            yield _sse_event("phase", {"phase": "save_image", "status": "done"})
        
        # 确定分类：AI 分类优先 → category_hint 次之 → 图片分类器建议 → 默认 MOOD
        category = extract_result.get("category")
        if not category:
            if category_hint:
                try:
                    category = Category(category_hint.upper()).value
                except ValueError:
                    pass
            if not category and classification_result:
                cat_suggestion = classification_result.get("category_suggestion")
                if cat_suggestion:
                    try:
                        category = Category(cat_suggestion.upper()).value
                    except ValueError:
                        pass
            if not category:
                category = "MOOD"
        
        meta_data = extract_result.get("meta_data", {})
        if classification_result:
            meta_data["_classification"] = {
                "image_type": classification_result["image_type"],
                "confidence": classification_result["confidence"],
                "should_save": classification_result["should_save_image"],
            }
        
        # ===== Phase 4: 标签生成 =====
        yield _sse_event("phase", {"phase": "tags", "status": "start", "label": "生成标签"})
        tags = []
        for attempt in range(2):
            try:
                tags = await tagger.generate_tags(
                    text=text,
                    category=category,
                    meta_data=meta_data,
                    record_id=None,
                )
                if tags:
                    break
            except Exception as e:
                if attempt == 0:
                    logger.warning(f"[Stream Phase 4] 标签生成失败，重试: {e}")
                    yield _sse_event("phase", {"phase": "tags", "status": "retry"})
                else:
                    logger.warning(f"[Stream Phase 4] 重试仍失败: {e}")
                    failed_phases.append("tags")
        if not tags and "tags" not in failed_phases:
            failed_phases.append("tags")
        yield _sse_event("phase", {"phase": "tags", "status": "done"})
        
        # ===== Phase 5: 维度评分 =====
        yield _sse_event("phase", {"phase": "score", "status": "start", "label": "维度评分"})
        dimension_scores = extract_result.get("dimension_scores")
        if dimension_scores:
            logger.info(f"[Stream Phase 5] 使用 LLM 维度评分")
        else:
            try:
                dimension_scores = dimension_analyzer.calculate_dimension_scores(
                    category=category or "MOOD",
                    meta_data=meta_data,
                    tags=tags,
                )
            except Exception as e:
                logger.warning(f"[Stream Phase 5] 维度分析失败: {e}")
                failed_phases.append("dimension_scores")
                dimension_scores = {}
        yield _sse_event("phase", {"phase": "score", "status": "done"})
        
        # ===== Phase 6: 保存到数据库 =====
        yield _sse_event("phase", {"phase": "save", "status": "start", "label": "保存记录"})
        record_time = extract_result.get("record_time")
        
        life_stream = LifeStream(
            input_type=input_type,
            category=category,
            raw_content=text or (classification_result.get("content_hint") if classification_result else None),
            meta_data=meta_data,
            ai_insight=extract_result.get("reply_text"),
            image_type=image_type,
            image_path=image_path,
            thumbnail_path=thumbnail_path,
            image_saved=image_path is not None,
            tags=tags,
            dimension_scores=dimension_scores,
            record_time=record_time,
        )
        
        db.add(life_stream)
        try:
            db.commit()
            db.refresh(life_stream)
        except Exception as e:
            db.rollback()
            yield _sse_event("error", {"message": f"数据保存失败: {e}"})
            return
        yield _sse_event("phase", {"phase": "save", "status": "done"})
        
        # ===== Phase 7: 游戏化 + RAG（后台，不阻塞前端） =====
        try:
            gamification = get_gamification_service()
            gamification.update_streak()
            gamification.update_challenge_progress(None, category)
            gamification.check_and_award_badges()
        except Exception as e:
            logger.warning(f"[Stream Phase 7] 游戏化更新失败: {e}")
        
        try:
            rag = get_rag()
            if rag:
                rag.index_record(life_stream)
        except Exception as e:
            logger.warning(f"[Stream Phase 7] RAG 索引失败: {e}")
            failed_phases.append("rag_index")
        
        if failed_phases:
            logger.info(f"[Stream 结果] 记录已保存 (id={life_stream.id})，部分阶段失败: {failed_phases}")
        
        # ===== 最终结果 =====
        result = {
            "id": str(life_stream.id),
            "category": category,
            "meta_data": meta_data,
            "ai_insight": extract_result.get("reply_text", "已记录"),
            "created_at": life_stream.created_at.isoformat() if life_stream.created_at else None,
            "record_time": (life_stream.record_time or life_stream.created_at).isoformat() if (life_stream.record_time or life_stream.created_at) else None,
            "image_saved": life_stream.image_saved,
            "image_path": f"/api/feed/image/{image_path}" if image_path else None,
            "thumbnail_path": f"/api/feed/image/{thumbnail_path}" if thumbnail_path else None,
            "tags": tags,
            "dimension_scores": dimension_scores,
            "failed_phases": failed_phases,
        }
        yield _sse_event("result", result)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁止 Nginx 缓冲
        },
    )


# ========== 重新生成端点 ==========

@router.post("/{record_id}/regenerate", response_model=RegenerateResponse)
async def regenerate_phases(
    record_id: str,
    request: RegenerateRequest,
    db: Session = Depends(get_db),
    _user=Depends(verify_token),
):
    """
    对已保存的记录，按需重新生成失败的部分。
    
    支持的 phases: "tags", "dimension_scores", "ai_insight"
    """
    record = db.query(LifeStream).filter(
        LifeStream.id == record_id,
        LifeStream.is_deleted != True,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    still_failed: list[str] = []
    updated_tags = None
    updated_scores = None
    updated_insight = None
    
    # 重新生成标签
    if "tags" in request.phases:
        try:
            new_tags = await tagger.generate_tags(
                text=record.raw_content,
                category=record.category,
                meta_data=record.meta_data or {},
                record_id=record_id,
            )
            if new_tags:
                record.tags = new_tags
                updated_tags = new_tags
                logger.info(f"[Regenerate] 标签重新生成成功 (id={record_id}): {new_tags}")
            else:
                still_failed.append("tags")
        except Exception as e:
            logger.warning(f"[Regenerate] 标签重新生成失败 (id={record_id}): {e}")
            still_failed.append("tags")
    
    # 重新生成维度评分
    if "dimension_scores" in request.phases:
        try:
            new_scores = dimension_analyzer.calculate_dimension_scores(
                category=record.category or "MOOD",
                meta_data=record.meta_data or {},
                tags=record.tags or [],
            )
            if new_scores:
                record.dimension_scores = new_scores
                updated_scores = new_scores
                logger.info(f"[Regenerate] 维度评分重新生成成功 (id={record_id})")
            else:
                still_failed.append("dimension_scores")
        except Exception as e:
            logger.warning(f"[Regenerate] 维度评分重新生成失败 (id={record_id}): {e}")
            still_failed.append("dimension_scores")
    
    # 重新生成 AI 洞察
    if "ai_insight" in request.phases:
        try:
            extract_result = await data_extractor.extract(
                image_type=record.image_type or "other",
                text=record.raw_content,
                client_time=record.created_at.isoformat() if record.created_at else None,
                nickname=get_nickname(db),
            )
            new_insight = extract_result.get("reply_text")
            if new_insight and new_insight != "已记录":
                record.ai_insight = new_insight
                updated_insight = new_insight
                # 同时更新 meta_data 和 dimension_scores（如果之前也失败了）
                if extract_result.get("meta_data"):
                    record.meta_data = extract_result["meta_data"]
                if extract_result.get("dimension_scores") and not record.dimension_scores:
                    record.dimension_scores = extract_result["dimension_scores"]
                    updated_scores = extract_result["dimension_scores"]
                logger.info(f"[Regenerate] AI 洞察重新生成成功 (id={record_id})")
            else:
                still_failed.append("ai_insight")
        except Exception as e:
            logger.warning(f"[Regenerate] AI 洞察重新生成失败 (id={record_id}): {e}")
            still_failed.append("ai_insight")
    
    # 保存更新
    try:
        db.commit()
        db.refresh(record)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新保存失败: {e}")
    
    return RegenerateResponse(
        id=record_id,
        tags=updated_tags,
        dimension_scores=updated_scores,
        ai_insight=updated_insight,
        failed_phases=still_failed,
    )


# ========== 静态路由（必须在动态路由之前） ==========

@router.get("/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    获取投喂历史
    
    - **limit**: 返回数量限制
    - **offset**: 偏移量
    - **category**: 筛选分类
    """
    # 按提交时间排序（最新提交的在前），排除已删除的记录
    query = db.query(LifeStream).filter(
        LifeStream.is_deleted != True
    ).order_by(LifeStream.created_at.desc())
    
    if category:
        query = query.filter(LifeStream.category == category.upper())
    
    records = query.offset(offset).limit(limit).all()
    
    return [
        {
            "id": str(r.id),
            "input_type": r.input_type,
            "category": r.category,
            "raw_content": r.raw_content,
            "meta_data": r.meta_data,
            "ai_insight": r.ai_insight,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "record_time": r.record_time.isoformat() if r.record_time else (r.created_at.isoformat() if r.created_at else None),
            "image_saved": r.image_saved,
            "image_type": r.image_type,
            "image_path": f"/api/feed/image/{r.image_path}" if r.image_path else None,
            "thumbnail_path": f"/api/feed/image/{r.thumbnail_path}" if r.thumbnail_path else None,
            "tags": r.tags,
            "dimension_scores": r.dimension_scores,
            "is_public": r.is_public or False,
        }
        for r in records
    ]


@router.get("/public")
async def get_public_records(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    获取公开的记录（无需登录）
    """
    query = db.query(LifeStream).filter(
        LifeStream.is_public == True,
        LifeStream.is_deleted != True
    ).order_by(LifeStream.created_at.desc())
    
    records = query.offset(offset).limit(limit).all()
    
    return [
        {
            "id": str(r.id),
            "input_type": r.input_type,
            "category": r.category,
            "raw_content": r.raw_content,
            "meta_data": r.meta_data,
            "ai_insight": r.ai_insight,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "record_time": r.record_time.isoformat() if r.record_time else (r.created_at.isoformat() if r.created_at else None),
            "image_saved": r.image_saved,
            "image_type": r.image_type,
            "image_path": f"/api/feed/image/{r.image_path}" if r.image_path else None,
            "thumbnail_path": f"/api/feed/image/{r.thumbnail_path}" if r.thumbnail_path else None,
            "tags": r.tags,
            "dimension_scores": r.dimension_scores,
        }
        for r in records
    ]


@router.get("/public/stats")
async def get_public_stats(db: Session = Depends(get_db)):
    """
    获取公开记录的统计数据（无需登录）
    """
    from sqlalchemy import func
    from collections import Counter
    
    # 获取所有公开记录
    records = db.query(LifeStream).filter(
        LifeStream.is_public == True,
        LifeStream.is_deleted != True
    ).all()
    
    if not records:
        return {
            "total_records": 0,
            "total_days": 0,
            "category_distribution": {},
            "avg_score": None,
            "recent_streak": 0,
            "top_tags": [],
        }
    
    # 统计数据
    category_count = Counter()
    tag_count = Counter()
    dates = set()
    scores = []
    
    for r in records:
        category_count[r.category] += 1
        
        # 日期统计
        if r.record_time:
            dates.add(r.record_time.date())
        elif r.created_at:
            dates.add(r.created_at.date())
        
        # 标签统计
        if r.tags:
            for tag in r.tags:
                tag_count[tag] += 1
        
        # 分数统计
        if r.meta_data:
            score = r.meta_data.get('health_score') or r.meta_data.get('score')
            if score is not None:
                scores.append(score)
    
    # 计算平均分
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    
    # Top 标签
    top_tags = [tag for tag, _ in tag_count.most_common(10)]
    
    return {
        "total_records": len(records),
        "total_days": len(dates),
        "category_distribution": dict(category_count),
        "avg_score": avg_score,
        "recent_streak": 0,  # 可以后续计算连续记录天数
        "top_tags": top_tags,
    }


@router.get("/image/{path:path}")
async def get_image(path: str):
    """
    获取存储的图片
    
    - **path**: 图片路径
    """
    # 安全校验：防止路径遍历攻击
    if ".." in path or path.startswith("/") or path.startswith("\\"):
        raise HTTPException(status_code=400, detail="非法路径")
    
    # 解析真实路径并确保在 uploads 目录内
    uploads_dir = os.path.realpath("uploads")
    full_path = os.path.realpath(os.path.join("uploads", path))
    
    if not full_path.startswith(uploads_dir):
        raise HTTPException(status_code=403, detail="禁止访问")
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="图片不存在")
    
    # 只允许图片类型
    allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(full_path)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
    return FileResponse(full_path, media_type=media_types.get(ext, "image/jpeg"))


@router.get("/stats")
async def get_feed_stats(db: Session = Depends(get_db)):
    """
    获取投喂统计信息
    """
    total = db.query(LifeStream).count()
    with_images = db.query(LifeStream).filter(LifeStream.image_saved == True).count()
    
    storage_stats = image_storage.get_storage_stats()
    
    return {
        "total_records": total,
        "records_with_images": with_images,
        "storage": storage_stats,
    }


# ========== 动态路由 ==========

@router.get("/{record_id}")
async def get_record_detail(
    record_id: str,
    db: Session = Depends(get_db),
):
    """
    获取单条记录详情
    
    - **record_id**: 记录 ID
    """
    record = db.query(LifeStream).filter(LifeStream.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    return {
        "id": str(record.id),
        "input_type": record.input_type,
        "category": record.category,
        "raw_content": record.raw_content,
        "meta_data": record.meta_data,
        "ai_insight": record.ai_insight,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "record_time": record.record_time.isoformat() if record.record_time else (record.created_at.isoformat() if record.created_at else None),
        "image_saved": record.image_saved,
        "image_type": record.image_type,
        "image_path": f"/api/feed/image/{record.image_path}" if record.image_path else None,
        "thumbnail_path": f"/api/feed/image/{record.thumbnail_path}" if record.thumbnail_path else None,
        "tags": record.tags,
        "dimension_scores": record.dimension_scores,
    }


@router.post("/{record_id}/chat", response_model=RecordChatResponse)
async def chat_with_record(
    record_id: str,
    request: RecordChatRequest,
    db: Session = Depends(get_db),
):
    """
    与单条记录进行 AI 对话
    
    - **record_id**: 记录 ID
    - **message**: 用户消息
    - **history**: 对话历史（可选）
    """
    from app.services.ai_client import get_ai_client
    
    record = db.query(LifeStream).filter(LifeStream.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    # 构建记录上下文
    actual_time = record.record_time or record.created_at
    record_context = f"""
这是一条生活记录的详情：
- 分类: {record.category}
- 发生时间: {actual_time.strftime('%Y-%m-%d %H:%M') if actual_time else '未知'}
- 提交时间: {record.created_at.strftime('%Y-%m-%d %H:%M') if record.created_at else '未知'}
- 原始内容: {record.raw_content or '无'}
- AI 洞察: {record.ai_insight or '无'}
- 详细分析: {record.meta_data.get('analysis', '无') if record.meta_data else '无'}
- 建议: {', '.join(record.meta_data.get('suggestions', [])) if record.meta_data and record.meta_data.get('suggestions') else '无'}
- 标签: {', '.join(record.tags) if record.tags else '无'}
"""
    
    # 构建对话
    messages = [
        {
            "role": "system",
            "content": f"""你是一个专注于健康和生活方式的 AI 助手。用户正在查看他们的一条生活记录，并想与你讨论这条记录。
请基于记录内容回答用户的问题，给出有建设性的建议和洞察。
保持回复简洁友好，使用中文回答。

{record_context}"""
        }
    ]
    
    # 添加历史对话
    if request.history:
        for msg in request.history[-6:]:  # 最多保留最近6条
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
    
    # 添加当前消息
    messages.append({
        "role": "user",
        "content": request.message
    })
    
    try:
        ai_client = get_ai_client()
        response = await ai_client.chat_completion(
            messages=messages,
            model=ai_client.models["text"],
            task_type="record_chat",
            task_description=f"与记录 {record_id} 对话",
            record_id=record_id,
        )
        reply = response.get("content", "抱歉，我暂时无法回答这个问题。")
        
        # 生成建议问题
        suggestions = _generate_follow_up_suggestions(record.category)
        
        return RecordChatResponse(
            reply=reply,
            suggestions=suggestions
        )
    except Exception as e:
        logger.error(f"AI 对话失败: {e}")
        return RecordChatResponse(
            reply="抱歉，AI 服务暂时不可用，请稍后再试。",
            suggestions=None
        )


@router.delete("/{record_id}")
async def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(verify_token),
):
    """
    删除记录（软删除）- 需要认证
    
    - **record_id**: 记录 ID
    """
    record = db.query(LifeStream).filter(LifeStream.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record.is_deleted = True
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")
    
    # 同步从 RAG 知识库中移除
    try:
        rag = get_rag()
        if rag:
            rag.remove_record(record_id)
    except Exception as e:
        logger.warning(f"删除记录后清除 RAG 索引失败 (id={record_id}): {e}")
    
    return {"success": True, "message": "记录已删除"}


class VisibilityUpdate(BaseModel):
    """可见性更新请求"""
    is_public: bool


@router.patch("/{record_id}/visibility")
async def update_visibility(
    record_id: str,
    update: VisibilityUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_token),
):
    """
    更新记录可见性 - 需要认证
    
    - **record_id**: 记录 ID
    - **is_public**: 是否公开
    """
    record = db.query(LifeStream).filter(LifeStream.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record.is_public = update.is_public
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新失败: {e}")
    
    return {"success": True, "is_public": record.is_public}
