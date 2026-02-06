"""对话式 AI 助手 API（LLM 增强版）"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict

from app.services.chat_assistant import get_chat_assistant

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str  # "user" or "assistant"
    content: str
    type: str = "text"  # "text" or "markdown"


class ChatRequest(BaseModel):
    """聊天请求（支持对话历史）"""
    message: str
    history: Optional[List[Dict[str, str]]] = None  # [{"role": "user", "content": "..."}, ...]


class ChatResponse(BaseModel):
    """聊天响应"""
    type: str
    content: str


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    发送消息给 AI 助手

    - 自动查询用户数据作为上下文
    - 通过 RAG 语义检索相关记录
    - LLM 生成自然、有洞察力的回答
    - 支持多轮对话历史
    """
    assistant = get_chat_assistant()
    response = await assistant.chat(
        message=request.message,
        history=request.history,
    )

    return ChatResponse(
        type=response.get("type", "text"),
        content=response.get("content", ""),
    )


@router.get("/suggestions")
async def get_suggestions():
    """
    获取推荐问题
    """
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
