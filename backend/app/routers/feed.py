"""
Feed API - 智能多模态数据投喂
集成三阶段 AI Agent 流程
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
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
        if image_type in ["screenshot", "activity_screenshot", "sleep_screenshot"]:
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
            client_time=client_time,  # 传递客户端时间
        )
    else:
        # 纯文本输入
        extract_result = await data_extractor.extract(
            image_type="other",
            text=text,
            client_time=client_time,  # 传递客户端时间
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
    
    # 确定记录发生时间
    record_time = extract_result.get("record_time")  # AI 分析得出的实际发生时间
    
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
        record_time=record_time,  # AI 分析的实际发生时间
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
        record_time=life_stream.record_time or life_stream.created_at,  # 实际发生时间
        image_saved=life_stream.image_saved,
        image_path=f"/api/feed/image/{image_path}" if image_path else None,
        thumbnail_path=f"/api/feed/image/{thumbnail_path}" if thumbnail_path else None,
        tags=tags,
        dimension_scores=dimension_scores,
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
    # 按提交时间排序（最新提交的在前）
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
        print(f"AI 对话失败: {e}")
        return RecordChatResponse(
            reply="抱歉，AI 服务暂时不可用，请稍后再试。",
            suggestions=None
        )
