from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database - 支持 SQLite (本地开发) 或 PostgreSQL (生产)
    database_url: str = ""
    
    # PostgreSQL 配置 (可选，用于生产环境)
    postgres_user: str = "vibingu"
    postgres_password: str = "vibingu_secret"
    postgres_db: str = "vibingu"
    postgres_host: str = ""  # 留空则使用 SQLite
    postgres_port: int = 5432
    
    # AI Provider 配置
    # 支持 OpenAI 或 智谱AI (ZhipuAI)
    ai_provider: str = "zhipu"  # "openai" 或 "zhipu"
    
    # OpenAI 配置
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    
    # 智谱AI 配置
    zhipu_api_key: str = ""
    zhipu_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    
    # 模型配置 (默认使用智谱AI模型)
    # 智谱AI 可用模型:
    #   视觉: glm-4.6v (付费) / glm-4.6v-flash (免费)
    #   文本: glm-4.7 (付费) / glm-4.7-flash (免费)
    #   嵌入: embedding-3
    vision_model: str = "glm-4.6v"              # 图像解析 (付费，高质量)
    text_model: str = "glm-4.7"                 # 文本解析 (付费，高质量)
    smart_model: str = "glm-4.7"                # 决策助手 (付费，高质量)
    simple_vision_model: str = "glm-4.6v-flash" # 简单视觉任务 (免费)
    simple_text_model: str = "glm-4.7-flash"    # 简单文本任务 (免费)
    embedding_model: str = "embedding-3"        # 嵌入模型
    
    def get_ai_api_key(self) -> str:
        """获取当前 AI 提供商的 API Key"""
        if self.ai_provider == "zhipu":
            return self.zhipu_api_key
        return self.openai_api_key
    
    def get_ai_base_url(self) -> str:
        """获取当前 AI 提供商的 Base URL"""
        if self.ai_provider == "zhipu":
            return self.zhipu_base_url
        return self.openai_base_url
    
    # 认证密码（ADMIN_PASSWORD 或 AUTH_PASSWORD 均可）
    admin_password: str = ""
    auth_password: str = ""
    
    def get_auth_password(self) -> str:
        """获取管理员密码，优先 ADMIN_PASSWORD，其次 AUTH_PASSWORD"""
        return self.admin_password or self.auth_password or ""
    
    # Server
    debug: bool = True
    
    # CORS Origins (comma-separated string for Docker)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # ChromaDB
    chroma_persist_dir: str = ""
    
    # Upload directory
    upload_dir: str = ""
    
    def get_cors_origins(self) -> List[str]:
        """获取 CORS origins 列表"""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    def get_chroma_persist_dir(self) -> str:
        """获取 ChromaDB 持久化目录"""
        if self.chroma_persist_dir:
            return self.chroma_persist_dir
        return str(Path(__file__).parent.parent / "chroma_db")
    
    def get_upload_dir(self) -> str:
        """获取上传目录"""
        if self.upload_dir:
            return self.upload_dir
        return str(Path(__file__).parent.parent / "uploads")
    
    def get_database_url(self) -> str:
        """获取数据库 URL，优先使用环境变量，否则使用 SQLite"""
        if self.database_url:
            return self.database_url
        
        # 检查是否配置了 PostgreSQL (需要 host 非空)
        if self.postgres_host and self.postgres_host.strip():
            # 尝试使用 PostgreSQL
            return (
                f"postgresql://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        
        # 默认使用 SQLite
        db_path = Path(__file__).parent.parent / "vibingu.db"
        return f"sqlite:///{db_path}"
    
    class Config:
        env_file = ".env"  # 当前目录或 backend 目录的 .env
        env_file_encoding = "utf-8"
        extra = "ignore"  # 忽略 .env 中的额外字段


@lru_cache()
def get_settings() -> Settings:
    return Settings()
