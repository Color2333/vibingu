"""聊天会话与消息持久化模型"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Index
from app.database import Base


class ChatConversation(Base):
    """聊天会话表"""

    __tablename__ = "chat_conversation"
    __table_args__ = (
        Index("ix_chat_conversation_updated_at", "updated_at"),
        Index("ix_chat_conversation_is_deleted", "is_deleted"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="会话ID")
    user_id = Column(String(36), nullable=True, comment="用户ID(预留多用户)")
    title = Column(String(200), nullable=False, default="新对话", comment="会话标题")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="最后更新时间")
    is_deleted = Column(Boolean, default=False, comment="是否已删除（软删除）")

    def __repr__(self):
        return f"<ChatConversation(id={self.id}, title={self.title})>"


class ChatMessage(Base):
    """聊天消息表"""

    __tablename__ = "chat_message"
    __table_args__ = (
        Index("ix_chat_message_conversation_id", "conversation_id"),
        Index("ix_chat_message_created_at", "created_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="消息ID")
    conversation_id = Column(
        String(36),
        ForeignKey("chat_conversation.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属会话ID",
    )
    role = Column(String(20), nullable=False, comment="消息角色: user / assistant")
    content = Column(Text, nullable=False, default="", comment="消息内容")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role={self.role}, conv={self.conversation_id})>"
