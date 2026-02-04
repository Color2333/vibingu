from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database - 支持 SQLite (本地开发) 或 PostgreSQL (生产)
    database_url: str = ""
    
    # PostgreSQL 配置 (可选，用于生产环境)
    postgres_user: str = "vibingu"
    postgres_password: str = "vibingu_secret"
    postgres_db: str = "vibingu"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    
    # OpenAI
    openai_api_key: str = ""
    
    # Server
    debug: bool = True
    
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
        env_file = "../.env"  # 指向项目根目录的 .env
        env_file_encoding = "utf-8"
        extra = "ignore"  # 忽略 .env 中的额外字段


@lru_cache()
def get_settings() -> Settings:
    return Settings()
