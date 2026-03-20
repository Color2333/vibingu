"""对话式 AI 助手 API（LLM 增强版，支持流式输出 + 服务端持久化）"""

import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.chat import ChatConversation, ChatMessage
from app.services.chat_assistant import get_chat_assistant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# =====================================================
# Pydantic schemas
# =====================================================

class ChatRequest(BaseModel):
    """聊天请求（支持对话历史）"""
    message: str = Field(..., min_length=1, max_length=2000, description="聊天消息，不能为空，最多2000字符")
    history: Optional[List[Dict[str, str]]] = None


class StreamChatRequest(BaseModel):
    """流式聊天请求（带 conversation_id）"""
    message: str = Field(..., min_length=1, max_length=2000, description="聊天消息，不能为空，最多2000字符")
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """聊天响应"""
    type: str
    content: str


class ConversationCreate(BaseModel):
    """创建会话"""
    title: Optional[str] = "新对话"


class ConversationUpdate(BaseModel):
    """更新会话"""
    title: str = Field(..., min_length=1, max_length=200, description="会话标题，不能为空")


class MessageOut(BaseModel):
    """消息输出"""
    id: str
    role: str
    content: str
    created_at: str


class ConversationOut(BaseModel):
    """会话列表项"""
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(BaseModel):
    """会话详情（含消息）"""
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[MessageOut]


# =====================================================
# 会话 CRUD
# =====================================================

@router.get("/conversations")
async def list_conversations(db: Session = Depends(get_db)):
    """获取会话列表（按 updated_at 倒排）"""
    try:
        convs = (
            db.query(ChatConversation)
            .filter(ChatConversation.is_deleted == False)
            .order_by(ChatConversation.updated_at.desc())
            .all()
        )
        result = []
        for c in convs:
            msg_count = (
                db.query(ChatMessage)
                .filter(ChatMessage.conversation_id == c.id, ChatMessage.role == "user")
                .count()
            )
            result.append(ConversationOut(
                id=c.id,
                title=c.title,
                created_at=c.created_at.isoformat(),
                updated_at=c.updated_at.isoformat(),
                message_count=msg_count,
            ))
        return {"conversations": result}
    except SQLAlchemyError as e:
        logger.error(f"获取会话列表失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="数据库操作失败，请稍后重试")


@router.post("/conversations")
async def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    """创建新会话"""
    try:
        conv = ChatConversation(title=body.title or "新对话")
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return {
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat(),
        }
    except SQLAlchemyError as e:
        logger.error(f"创建会话失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="创建会话失败，请稍后重试")


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """获取单个会话及其消息"""
    try:
        conv = (
            db.query(ChatConversation)
            .filter(ChatConversation.id == conversation_id, ChatConversation.is_deleted == False)
            .first()
        )
        if not conv:
            raise HTTPException(status_code=404, detail="会话不存在")

        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        return ConversationDetail(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at.isoformat(),
            updated_at=conv.updated_at.isoformat(),
            messages=[
                MessageOut(
                    id=m.id,
                    role=m.role,
                    content=m.content,
                    created_at=m.created_at.isoformat(),
                )
                for m in messages
            ],
        )
    except SQLAlchemyError as e:
        logger.error(f"获取会话失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="数据库操作失败，请稍后重试")


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
):
    """更新会话标题"""
    try:
        conv = (
            db.query(ChatConversation)
            .filter(ChatConversation.id == conversation_id, ChatConversation.is_deleted == False)
            .first()
        )
        if not conv:
            raise HTTPException(status_code=404, detail="会话不存在")
        conv.title = body.title
        conv.updated_at = datetime.now()
        db.commit()
        return {"ok": True}
    except SQLAlchemyError as e:
        logger.error(f"更新会话失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="更新会话失败，请稍后重试")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """软删除会话"""
    try:
        conv = (
            db.query(ChatConversation)
            .filter(ChatConversation.id == conversation_id, ChatConversation.is_deleted == False)
            .first()
        )
        if not conv:
            raise HTTPException(status_code=404, detail="会话不存在")
        conv.is_deleted = True
        conv.updated_at = datetime.now()
        db.commit()
        return {"ok": True}
    except SQLAlchemyError as e:
        logger.error(f"删除会话失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="删除会话失败，请稍后重试")


# =====================================================
# 聊天消息（流式 + 持久化）
# =====================================================

@router.post("/stream")
async def stream_message(request: StreamChatRequest, db: Session = Depends(get_db)):
    """
    流式发送消息给 AI 助手（SSE），同时在服务端持久化消息。

    - 如果不提供 conversation_id，自动创建新会话
    - 用户消息在流开始前写入 DB
    - AI 回复在流结束后写入 DB
    """
    conversation_id = request.conversation_id
    message = request.message

    # 1) 获取或创建会话
    if conversation_id:
        try:
            conv = (
                db.query(ChatConversation)
                .filter(ChatConversation.id == conversation_id, ChatConversation.is_deleted == False)
                .first()
            )
            if not conv:
                raise HTTPException(status_code=404, detail="会话不存在")
        except SQLAlchemyError as e:
            logger.error(f"查询会话失败: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="数据库操作失败，请稍后重试")
    else:
        # 自动创建
        try:
            title = message[:30] + ("..." if len(message) > 30 else "")
            conv = ChatConversation(title=title)
            db.add(conv)
            db.commit()
            db.refresh(conv)
            conversation_id = conv.id
        except SQLAlchemyError as e:
            logger.error(f"创建会话失败: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="创建会话失败，请稍后重试")

    # 2) 保存用户消息
    try:
        user_msg = ChatMessage(
            conversation_id=conversation_id,
            role="user",
            content=message,
        )
        db.add(user_msg)
        db.commit()
    except SQLAlchemyError as e:
        logger.error(f"保存用户消息失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="保存消息失败，请稍后重试")

    # 3) 从 DB 读取历史消息作为 context
    try:
        history_msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
    except SQLAlchemyError as e:
        logger.error(f"读取历史消息失败: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="读取历史消息失败，请稍后重试")

    # 转换为 history 格式（不包含刚才添加的 user message 中最后一条，因为 chat_stream 会自己加）
    # 排除最后一条(就是刚保存的 user message)
    history = []
    for m in history_msgs[:-1]:
        history.append({"role": m.role, "content": m.content})

    # 4) 如果是首条消息，更新会话标题
    is_first_message = len(history_msgs) == 1
    if is_first_message:
        try:
            conv.title = message[:30] + ("..." if len(message) > 30 else "")
            conv.updated_at = datetime.now()
            db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新会话标题失败: {e}")
            db.rollback()
            # 标题更新失败不是致命错误，继续处理

    # 5) 提取生成器中需要的值（避免 session 关闭后访问 ORM 属性）
    conv_title = conv.title
    is_new_conv = not request.conversation_id

    # 6) 创建流式包装器：累积 AI 回复并在流结束后存入 DB
    assistant = get_chat_assistant()

    async def stream_and_persist():
        accumulated = ""
        new_conv_sent = False
        ai_error = None

        try:
            async for chunk in assistant.chat_stream(
                message=message,
                history=history,
            ):
                # 如果是新会话，在第一个 chunk 前先发送 conversation_id
                if not new_conv_sent:
                    meta = json.dumps({
                        "conversation_id": conversation_id,
                        "is_new": is_new_conv,
                        "title": conv_title,
                    }, ensure_ascii=False)
                    yield f"data: {meta}\n\n"
                    new_conv_sent = True

                # 解析 chunk 中的 content 来累积
                if chunk.startswith("data: "):
                    try:
                        data = json.loads(chunk[6:].strip())
                        if data.get("content") and not data.get("done"):
                            accumulated += data["content"]
                    except (json.JSONDecodeError, KeyError):
                        pass

                yield chunk
        except Exception as e:
            ai_error = str(e)
            logger.error(f"AI 流生成失败: {e}")
            error_data = json.dumps({"error": "AI 响应失败，请稍后重试"}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
        finally:
            # 流结束后保存 assistant 回复到 DB
            if accumulated and not ai_error:
                try:
                    # 使用新的 session 因为原 session 可能已关闭
                    from app.database import SessionLocal
                    save_db = SessionLocal()
                    try:
                        assistant_msg = ChatMessage(
                            conversation_id=conversation_id,
                            role="assistant",
                            content=accumulated,
                        )
                        save_db.add(assistant_msg)
                        # 更新会话的 updated_at
                        save_conv = save_db.query(ChatConversation).filter(
                            ChatConversation.id == conversation_id
                        ).first()
                        if save_conv:
                            save_conv.updated_at = datetime.now()
                        save_db.commit()
                        logger.info(f"已保存 AI 回复到会话 {conversation_id}, 长度={len(accumulated)}")
                    except SQLAlchemyError as se:
                        logger.error(f"保存 AI 回复到数据库失败: {se}")
                        save_db.rollback()
                    finally:
                        save_db.close()
                except Exception as e:
                    logger.error(f"保存 AI 回复失败: {e}")
            elif ai_error:
                # 发送错误结束标记
                error_end = json.dumps({"done": True, "error": ai_error}, ensure_ascii=False)
                yield f"data: {error_end}\n\n"
            else:
                # 发送正常结束标记
                done_data = json.dumps({"done": True}, ensure_ascii=False)
                yield f"data: {done_data}\n\n"

    return StreamingResponse(
        stream_and_persist(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# =====================================================
# 兼容旧接口
# =====================================================

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    发送消息给 AI 助手（非流式，兼容旧前端）
    """
    try:
        assistant = get_chat_assistant()
        response = await assistant.chat(
            message=request.message,
            history=request.history,
        )
        return ChatResponse(
            type=response.get("type", "text"),
            content=response.get("content", ""),
        )
    except Exception as e:
        logger.error(f"AI 对话失败: {e}")
        raise HTTPException(status_code=500, detail="AI 服务暂时不可用，请稍后重试")


@router.get("/suggestions")
async def get_suggestions():
    """获取推荐问题"""
    return {
        "suggestions": [
            {"text": "今天怎么样？", "icon": "📊"},
            {"text": "本周总结", "icon": "📈"},
            {"text": "最近状态趋势", "icon": "📉"},
            {"text": "我的睡眠情况", "icon": "😴"},
            {"text": "给我一些建议", "icon": "💡"},
            {"text": "最好的一天是哪天？", "icon": "🏆"},
        ],
    }
