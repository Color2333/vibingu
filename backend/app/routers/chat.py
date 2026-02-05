"""对话式 AI 助手 API"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from app.services.chat_assistant import get_chat_assistant

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str  # "user" or "assistant"
    content: str
    type: str = "text"  # "text" or "markdown"


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str


class ChatResponse(BaseModel):
    """聊天响应"""
    type: str
    content: str


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    发送消息给 AI 助手
    
    支持的查询：
    - 今日/本周/本月总结
    - 最佳/最差日子
    - 睡眠/心情/运动分析
    - 趋势分析
    - 个性化建议
    """
    assistant = get_chat_assistant()
    response = assistant.chat(request.message)
    
    return ChatResponse(
        type=response.get("type", "text"),
        content=response.get("content", "")
    )


@router.get("/suggestions")
async def get_suggestions():
    """
    获取推荐问题
    
    返回用户可能想问的问题列表
    """
    return {
        "suggestions": [
            {"text": "今天怎么样？", "icon": "📊"},
            {"text": "本周总结", "icon": "📈"},
            {"text": "最近状态趋势", "icon": "📉"},
            {"text": "我的睡眠情况", "icon": "😴"},
            {"text": "给我一些建议", "icon": "💡"},
            {"text": "最好的一天是哪天？", "icon": "🏆"},
        ]
    }
