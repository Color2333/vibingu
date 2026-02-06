"""对话式 AI 助手 API（LLM 增强版，支持流式输出）"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict

from app.services.chat_assistant import get_chat_assistant

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """聊天请求（支持对话历史）"""
    message: str
    history: Optional[List[Dict[str, str]]] = None


class ChatResponse(BaseModel):
    """聊天响应"""
    type: str
    content: str


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    发送消息给 AI 助手（非流式，兼容旧前端）
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


@router.post("/stream")
async def stream_message(request: ChatRequest):
    """
    流式发送消息给 AI 助手（SSE）

    返回 Server-Sent Events 流，每个 event 的 data 是 JSON:
    {"content": "token文本", "done": false}
    最后一条: {"content": "", "done": true}
    """
    assistant = get_chat_assistant()
    return StreamingResponse(
        assistant.chat_stream(
            message=request.message,
            history=request.history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
