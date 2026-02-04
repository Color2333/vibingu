from sqlalchemy import Column, Date, Float, Integer, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class DailySummary(Base):
    """每日状态总表 - 用于宏观分析的每日切片"""
    
    __tablename__ = "daily_summary"
    
    date = Column(Date, primary_key=True, comment="日期")
    wake_time = Column(DateTime, nullable=True, comment="起床时间")
    bed_time = Column(DateTime, nullable=True, comment="入睡时间")
    sleep_duration = Column(Float, nullable=True, comment="睡眠时长(小时)")
    screen_time = Column(Float, nullable=True, comment="屏幕总时长(小时)")
    vibe_score = Column(Integer, nullable=True, comment="当日Vibing指数(0-100)")
    energy_level = Column(Integer, nullable=True, comment="主观能量值(1-10)")
    daily_summary_text = Column(Text, nullable=True, comment="AI生成的当天日记摘要")
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<DailySummary(date={self.date}, vibe_score={self.vibe_score})>"
