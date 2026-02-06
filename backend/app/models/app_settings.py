"""
应用设置表 — 单用户键值存储

用于存储用户个性化配置（昵称、偏好等）。
单用户架构下只有一行数据。
"""

from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
from app.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    key = Column(String(64), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
