"""
Feed API - 智能多模态数据投喂
集成三阶段 AI Agent 流程
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import base64
import os

from app.database import get_db
from app.models import LifeStream, InputType, Category
from app.services.image_classifier import ImageClassifier
from app.services.data_extractor import DataExtractor
from app.services.image_storage import ImageStorage
from app.services.tagger import get_tagger
from app.services.dimension_analyzer import get_dimension_analyzer
from app.services.gamification import get_gamification_service
from app.schemas.feed import FeedResponse

# 延迟加载 RAG 服务（避免启动时的循环导入）
_rag_service = None

def get_rag():
    global _rag_service
    if _rag_service is None:
        try:
            from app.services.rag import get_rag_service
            _rag_service = get_rag_service()
        except Exception as e:
            print(f"RAG 服务加载失败: {e}")
    return _rag_service

router = APIRouter(prefix="/api/feed", tags=["feed"])

# 初始化服务
image_classifier = ImageClassifier()
data_extractor = DataExtractor()
image_storage = ImageStorage(upload_dir="uploads")
tagger = get_tagger()
dimension_analyzer = get_dimension_analyzer()


@router.post("", response_model=FeedResponse)
async def create_feed(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    category_hint: Optional[str] = Form(None),
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
    
    # ===== Phase 1: 图片分类 =====
    if image:
        content = await image.read()
        image_base64 = base64.b64encode(content).decode("utf-8")
        
        # 调用分类 Agent
        classification_result = await image_classifier.classify(
            image_base64=image_base64,
            text_hint=text or category_hint,
        )
        
        image_type = classification_result["image_type"]
        should_save_image = classification_result["should_save_image"]
        
        # 设置输入类型
        if image_type in ["screenshot", "activity_screenshot"]:
            input_type = InputType.SCREENSHOT.value
        else:
            input_type = InputType.IMAGE.value
    
    # ===== Phase 2: 数据提取 =====
    if image_base64:
        extract_result = await data_extractor.extract(
            image_type=image_type or "other",
            image_base64=image_base64,
            text=text,
            content_hint=classification_result.get("content_hint") if classification_result else None,
        )
    else:
        # 纯文本输入
        extract_result = await data_extractor.extract(
            image_type="other",
            text=text,
        )
    
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
            print(f"图片保存失败: {e}")
            # 保存失败不影响数据记录
            image_path = None
            thumbnail_path = None
    
    # 确定分类
    category = extract_result.get("category")
    if category_hint:
        try:
            category = Category(category_hint.upper()).value
        except ValueError:
            pass
    
    # 合并元数据
    meta_data = extract_result.get("meta_data", {})
    if classification_result:
        meta_data["_classification"] = {
            "image_type": classification_result["image_type"],
            "confidence": classification_result["confidence"],
            "should_save": classification_result["should_save_image"],
        }
    
    # ===== Phase 4: 智能标签生成 =====
    tags = await tagger.generate_tags(
        text=text,
        category=category,
        meta_data=meta_data,
        record_id=None,  # 记录还未创建
    )
    
    # ===== Phase 5: 八维度分析 =====
    dimension_scores = dimension_analyzer.calculate_dimension_scores(
        category=category or "MOOD",
        meta_data=meta_data,
        tags=tags,
    )
    
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
    )
    
    db.add(life_stream)
    db.commit()
    db.refresh(life_stream)
    
    # ===== Phase 6: 游戏化奖励 =====
    try:
        gamification = get_gamification_service()
        # 更新连续记录和经验值
        gamification.update_streak()
        # 更新挑战进度
        gamification.update_challenge_progress(None, category)
        # 检查新徽章
        gamification.check_and_award_badges()
    except Exception as e:
        print(f"游戏化更新失败: {e}")
        # 游戏化失败不影响主流程
    
    # ===== Phase 7: RAG 索引 =====
    try:
        rag = get_rag()
        if rag:
            rag.index_record(life_stream)
    except Exception as e:
        print(f"RAG 索引失败: {e}")
        # RAG 索引失败不影响主流程
    
    return FeedResponse(
        id=str(life_stream.id),
        category=category,
        meta_data=meta_data,
        ai_insight=extract_result.get("reply_text", "已记录"),
        created_at=life_stream.created_at,
        image_saved=life_stream.image_saved,
        image_path=f"/api/feed/image/{image_path}" if image_path else None,
        thumbnail_path=f"/api/feed/image/{thumbnail_path}" if thumbnail_path else None,
        tags=tags,
        dimension_scores=dimension_scores,
    )


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
    query = db.query(LifeStream).order_by(LifeStream.created_at.desc())
    
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
            "image_saved": r.image_saved,
            "image_type": r.image_type,
            "image_path": f"/api/feed/image/{r.image_path}" if r.image_path else None,
            "thumbnail_path": f"/api/feed/image/{r.thumbnail_path}" if r.thumbnail_path else None,
            "tags": r.tags,
            "dimension_scores": r.dimension_scores,
        }
        for r in records
    ]


@router.get("/image/{path:path}")
async def get_image(path: str):
    """
    获取存储的图片
    
    - **path**: 图片路径
    """
    full_path = os.path.join("uploads", path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="图片不存在")
    
    return FileResponse(full_path, media_type="image/jpeg")


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
