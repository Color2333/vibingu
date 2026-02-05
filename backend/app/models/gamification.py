"""游戏化系统模型

等级、经验值、徽章、挑战
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Enum, Text
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class BadgeType(enum.Enum):
    """徽章类型"""
    # 记录相关
    FIRST_RECORD = "first_record"           # 第一次记录
    WEEK_STREAK = "week_streak"             # 连续记录7天
    MONTH_STREAK = "month_streak"           # 连续记录30天
    CENTURY = "century"                     # 记录100条
    THOUSAND = "thousand"                   # 记录1000条
    
    # 类别相关
    SLEEP_MASTER = "sleep_master"           # 睡眠达人 - 记录30条睡眠
    FITNESS_LOVER = "fitness_lover"         # 运动达人 - 记录30条运动
    FOODIE = "foodie"                       # 美食家 - 记录50条饮食
    SOCIAL_BUTTERFLY = "social_butterfly"   # 社交达人 - 记录20条社交
    BOOKWORM = "bookworm"                   # 书虫 - 记录20条成长
    
    # 状态相关
    HIGH_VIBE = "high_vibe"                 # 高光时刻 - 日均分数>80
    BALANCED = "balanced"                   # 平衡大师 - 8维度均>60
    CONSISTENT = "consistent"               # 稳定如山 - 连续7天分数波动<10
    
    # 时间相关
    EARLY_BIRD = "early_bird"               # 早起鸟 - 7天内5次早于7点记录
    NIGHT_OWL = "night_owl"                 # 夜猫子 - 7天内5次晚于22点记录
    
    # 特殊
    EXPLORER = "explorer"                   # 探索者 - 使用所有功能
    ANALYZER = "analyzer"                   # 分析师 - 查看10次洞察
    PREDICTOR = "predictor"                 # 预言家 - 查看20次预测


class UserLevel(Base):
    """用户等级"""
    __tablename__ = "user_level"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=True)
    
    # 经验值
    total_xp = Column(Integer, default=0)
    current_level = Column(Integer, default=1)
    xp_to_next_level = Column(Integer, default=100)
    
    # 统计
    total_records = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_record_date = Column(DateTime, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class UserBadge(Base):
    """用户获得的徽章"""
    __tablename__ = "user_badge"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=True)
    
    badge_type = Column(String(50), nullable=False)
    earned_at = Column(DateTime, server_default=func.now())
    
    # 徽章详情
    title = Column(String(100))
    description = Column(String(500))
    icon = Column(String(50))  # emoji 或图标名
    rarity = Column(String(20), default="common")  # common, rare, epic, legendary


class Challenge(Base):
    """挑战任务"""
    __tablename__ = "challenge"
    
    id = Column(String(36), primary_key=True)
    
    # 基本信息
    title = Column(String(100), nullable=False)
    description = Column(String(500))
    challenge_type = Column(String(20))  # weekly, monthly, special
    
    # 目标
    target_category = Column(String(50), nullable=True)  # 如 SLEEP, ACTIVITY
    target_count = Column(Integer, default=1)
    target_metric = Column(String(50), nullable=True)  # 如 records, score_avg
    
    # 奖励
    xp_reward = Column(Integer, default=50)
    badge_reward = Column(String(50), nullable=True)
    
    # 时间
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    # 状态
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class UserChallengeProgress(Base):
    """用户挑战进度"""
    __tablename__ = "user_challenge_progress"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=True)
    challenge_id = Column(String(36), nullable=False)
    
    # 进度
    current_progress = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ========== 等级配置 ==========

# 等级经验值需求（累计）
LEVEL_XP_REQUIREMENTS = {
    1: 0,
    2: 100,
    3: 250,
    4: 500,
    5: 850,
    6: 1300,
    7: 1900,
    8: 2700,
    9: 3700,
    10: 5000,
    11: 6500,
    12: 8500,
    13: 11000,
    14: 14000,
    15: 18000,
    16: 23000,
    17: 29000,
    18: 36000,
    19: 45000,
    20: 55000,  # 最高等级
}

# 等级称号
LEVEL_TITLES = {
    1: "新手记录者",
    2: "初级观察者",
    3: "生活记录员",
    4: "数据收集者",
    5: "习惯养成者",
    6: "自我观察者",
    7: "生活分析师",
    8: "模式发现者",
    9: "健康追踪者",
    10: "生活优化师",
    11: "数据大师",
    12: "习惯专家",
    13: "洞察达人",
    14: "生命科学家",
    15: "平衡大师",
    16: "自我认知者",
    17: "生活艺术家",
    18: "人生设计师",
    19: "智慧生活家",
    20: "生命掌控者",
}

# 经验值奖励配置
XP_REWARDS = {
    "record": 10,           # 每条记录
    "daily_first": 20,      # 每日首次记录
    "streak_day": 15,       # 连续记录天数奖励
    "complete_challenge": 50,  # 完成挑战
    "earn_badge": 30,       # 获得徽章
    "high_score_day": 25,   # 高分日（>80）
    "balanced_day": 20,     # 平衡日（8维度均>50）
}

# 徽章配置
BADGE_CONFIG = {
    BadgeType.FIRST_RECORD.value: {
        "title": "起步",
        "description": "完成第一次记录",
        "icon": "🌱",
        "rarity": "common",
    },
    BadgeType.WEEK_STREAK.value: {
        "title": "一周坚持",
        "description": "连续记录7天",
        "icon": "🔥",
        "rarity": "common",
    },
    BadgeType.MONTH_STREAK.value: {
        "title": "月度达人",
        "description": "连续记录30天",
        "icon": "💪",
        "rarity": "rare",
    },
    BadgeType.CENTURY.value: {
        "title": "百日征程",
        "description": "累计记录100条",
        "icon": "💯",
        "rarity": "rare",
    },
    BadgeType.THOUSAND.value: {
        "title": "千日修行",
        "description": "累计记录1000条",
        "icon": "🏆",
        "rarity": "legendary",
    },
    BadgeType.SLEEP_MASTER.value: {
        "title": "睡眠大师",
        "description": "记录30条睡眠数据",
        "icon": "😴",
        "rarity": "common",
    },
    BadgeType.FITNESS_LOVER.value: {
        "title": "运动达人",
        "description": "记录30条运动数据",
        "icon": "🏃",
        "rarity": "common",
    },
    BadgeType.FOODIE.value: {
        "title": "美食家",
        "description": "记录50条饮食数据",
        "icon": "🍽️",
        "rarity": "common",
    },
    BadgeType.SOCIAL_BUTTERFLY.value: {
        "title": "社交达人",
        "description": "记录20条社交活动",
        "icon": "🦋",
        "rarity": "common",
    },
    BadgeType.BOOKWORM.value: {
        "title": "书虫",
        "description": "记录20条学习成长",
        "icon": "📚",
        "rarity": "common",
    },
    BadgeType.HIGH_VIBE.value: {
        "title": "高光时刻",
        "description": "某日平均分数超过80",
        "icon": "⭐",
        "rarity": "rare",
    },
    BadgeType.BALANCED.value: {
        "title": "平衡大师",
        "description": "8个维度分数均超过60",
        "icon": "☯️",
        "rarity": "epic",
    },
    BadgeType.CONSISTENT.value: {
        "title": "稳定如山",
        "description": "连续7天分数波动小于10",
        "icon": "🏔️",
        "rarity": "rare",
    },
    BadgeType.EARLY_BIRD.value: {
        "title": "早起鸟",
        "description": "7天内5次早于7点记录",
        "icon": "🐦",
        "rarity": "common",
    },
    BadgeType.NIGHT_OWL.value: {
        "title": "夜猫子",
        "description": "7天内5次晚于22点记录",
        "icon": "🦉",
        "rarity": "common",
    },
    BadgeType.EXPLORER.value: {
        "title": "探索者",
        "description": "体验所有功能",
        "icon": "🧭",
        "rarity": "rare",
    },
    BadgeType.ANALYZER.value: {
        "title": "分析师",
        "description": "查看10次深度洞察",
        "icon": "📊",
        "rarity": "common",
    },
    BadgeType.PREDICTOR.value: {
        "title": "预言家",
        "description": "查看20次 AI 预测",
        "icon": "🔮",
        "rarity": "rare",
    },
}
