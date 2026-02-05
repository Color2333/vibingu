"""Token 用量记录模型"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class ModelType(enum.Enum):
    """AI 模型类型"""
    # OpenAI 模型
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_35_TURBO = "gpt-3.5-turbo"
    TEXT_EMBEDDING = "text-embedding-3-small"
    # 智谱AI 模型 (付费)
    GLM_4_7 = "glm-4.7"
    GLM_4_6V = "glm-4.6v"
    # 智谱AI 模型 (免费)
    GLM_4_7_FLASH = "glm-4.7-flash"
    GLM_4_6V_FLASH = "glm-4.6v-flash"
    EMBEDDING_3 = "embedding-3"
    OTHER = "other"


class TaskType(enum.Enum):
    """任务类型"""
    PARSE_INPUT = "parse_input"          # 解析输入
    CLASSIFY_IMAGE = "classify_image"    # 图片分类
    EXTRACT_DATA = "extract_data"        # 数据提取
    GENERATE_TAGS = "generate_tags"      # 生成标签
    GENERATE_INSIGHT = "generate_insight" # 生成洞察
    RAG_QUERY = "rag_query"              # RAG 查询
    EMBEDDING = "embedding"              # 向量嵌入
    OTHER = "other"


class TokenUsage(Base):
    """Token 用量记录表"""
    __tablename__ = "token_usage"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # 模型信息
    model = Column(String(50), nullable=False)  # 使用的模型
    model_type = Column(String(20), nullable=False)  # 模型类型枚举
    
    # Token 统计
    prompt_tokens = Column(Integer, default=0)  # 输入 tokens
    completion_tokens = Column(Integer, default=0)  # 输出 tokens
    total_tokens = Column(Integer, default=0)  # 总 tokens
    
    # 成本估算 (美元)
    estimated_cost = Column(Float, default=0.0)
    
    # 任务信息
    task_type = Column(String(30), nullable=False)  # 任务类型
    task_description = Column(String(200))  # 任务描述
    
    # 关联信息
    related_record_id = Column(String(50))  # 关联的 life_stream 记录 ID
    
    def __repr__(self):
        return f"<TokenUsage {self.id}: {self.model} - {self.total_tokens} tokens>"


# Token 价格配置 (每 1K tokens，美元)
# 智谱AI 价格已按汇率换算为美元 (1 RMB ≈ 0.14 USD)
TOKEN_PRICES = {
    # OpenAI 模型
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "text-embedding-3-small": {"input": 0.00002, "output": 0},
    # 智谱AI 模型 (付费)
    "glm-4.7": {"input": 0.007, "output": 0.007},              # ¥0.05/1K tokens
    "glm-4.6v": {"input": 0.007, "output": 0.007},             # ¥0.05/1K tokens (视觉)
    # 智谱AI 模型 (免费)
    "glm-4.7-flash": {"input": 0, "output": 0},                # 免费
    "glm-4.6v-flash": {"input": 0, "output": 0},               # 免费 (视觉)
    "embedding-3": {"input": 0.00007, "output": 0},            # ¥0.0005/1K tokens
}


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """计算预估成本"""
    # 查找价格，支持模型名称的部分匹配
    prices = None
    for model_key, model_prices in TOKEN_PRICES.items():
        if model_key in model:
            prices = model_prices
            break
    
    if not prices:
        prices = {"input": 0.001, "output": 0.002}  # 默认价格
    
    input_cost = (prompt_tokens / 1000) * prices["input"]
    output_cost = (completion_tokens / 1000) * prices["output"]
    return round(input_cost + output_cost, 6)
