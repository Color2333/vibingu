import uuid
import enum
import json
from sqlalchemy import Column, String, Text, DateTime, Enum, TypeDecorator, Boolean
from sqlalchemy.sql import func
from app.database import Base


class InputType(str, enum.Enum):
    """输入类型枚举"""
    IMAGE = "IMAGE"
    TEXT = "TEXT"
    AUDIO = "AUDIO"
    SCREENSHOT = "SCREENSHOT"


class ImageType(str, enum.Enum):
    """图片类型枚举"""
    SCREENSHOT = "screenshot"
    FOOD = "food"
    ACTIVITY_SCREENSHOT = "activity_screenshot"
    ACTIVITY_PHOTO = "activity_photo"
    SCENERY = "scenery"
    SELFIE = "selfie"
    OTHER = "other"


class Category(str, enum.Enum):
    """分类枚举 - 八维度模型"""
    # 核心维度 (PERMA+ 扩展)
    SLEEP = "SLEEP"          # 睡眠 → 身体维度
    DIET = "DIET"            # 饮食 → 身体维度
    ACTIVITY = "ACTIVITY"    # 运动/活动 → 身体维度
    MOOD = "MOOD"            # 情绪 → 心情维度
    SOCIAL = "SOCIAL"        # 社交 → 关系维度
    WORK = "WORK"            # 工作 → 成就维度
    GROWTH = "GROWTH"        # 学习/成长 → 意义维度
    LEISURE = "LEISURE"      # 休闲 → 心流维度
    SCREEN = "SCREEN"        # 屏幕时间 → 数字维度


class JSONType(TypeDecorator):
    """跨数据库兼容的 JSON 类型"""
    impl = Text
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value, ensure_ascii=False)
        return None
    
    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None


class LifeStream(Base):
    """全维生活流表 - 核心数据集表，存储所有的照片、对话、记录"""
    
    __tablename__ = "life_stream"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="唯一标识")
    user_id = Column(String(36), nullable=True, comment="用户ID(为未来多用户预留)")
    created_at = Column(DateTime, server_default=func.now(), comment="发生时间")
    input_type = Column(String(20), nullable=False, comment="输入类型")
    category = Column(String(20), nullable=True, comment="分类")
    raw_content = Column(Text, nullable=True, comment="文字内容或图片URL")
    meta_data = Column(JSONType, nullable=True, comment="AI解析后的所有细节")
    ai_insight = Column(Text, nullable=True, comment="AI当时给出的一句话点评")
    
    # 图片相关字段
    image_type = Column(String(30), nullable=True, comment="图片类型")
    image_path = Column(String(255), nullable=True, comment="图片存储路径")
    thumbnail_path = Column(String(255), nullable=True, comment="缩略图路径")
    image_saved = Column(Boolean, default=False, comment="是否保存了原图")
    
    # 智能标签
    tags = Column(JSONType, nullable=True, comment="AI生成的标签数组")
    
    # 八维度得分 (0-100)
    dimension_scores = Column(JSONType, nullable=True, comment="维度得分")
    
    def __repr__(self):
        return f"<LifeStream(id={self.id}, category={self.category}, created_at={self.created_at})>"
