import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

database_url = settings.get_database_url()

# SQLite 需要特殊配置
connect_args = {}
engine_kwargs = {}

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # SQLite 不支持传统连接池，使用 StaticPool 或 NullPool
    # 但 pool_size / pool_recycle 仍可设置用于其他数据库
    engine_kwargs = {
        "pool_pre_ping": True,
    }
else:
    # PostgreSQL / MySQL 等生产数据库的连接池配置
    engine_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 3600,  # 1 小时回收连接
    }

engine = create_engine(
    database_url,
    echo=False,  # 关闭 SQL 日志输出（生产安全，debug 用 logging 级别控制）
    connect_args=connect_args,
    **engine_kwargs,
)

# SQLite WAL 模式 & 外键支持
if database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
