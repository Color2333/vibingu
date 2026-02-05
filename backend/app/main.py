from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, Base
from app.routers import feed_router, history_router, analytics_router, reports_router, auth_router, tokens_router, tags_router, time_intel_router, predict_router, chat_router, gamification_router, rag_router
from app.routers.ai_analysis import router as ai_analysis_router

settings = get_settings()


def run_migrations():
    """运行数据库迁移（SQLite）"""
    import sqlite3
    import os
    
    db_url = settings.get_database_url()
    if not db_url.startswith("sqlite"):
        return  # 只对 SQLite 执行自动迁移
    
    # 提取数据库路径
    db_path = db_url.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查现有列
        cursor.execute("PRAGMA table_info(life_stream)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # 添加 record_time 列（v0.3）
        if "record_time" not in columns:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN record_time DATETIME")
            print("✅ 自动迁移: 添加 record_time 列")
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ 自动迁移失败: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时创建表（开发环境）
    if settings.debug:
        Base.metadata.create_all(bind=engine)
        run_migrations()  # 运行数据库迁移
    yield
    # 关闭时的清理工作（如需要）


app = FastAPI(
    title="Vibing u API",
    description="数字人生黑匣子 - 记录、分析、优化你的生活状态",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS 配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(feed_router)
app.include_router(history_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(auth_router)
app.include_router(tokens_router)
app.include_router(tags_router)
app.include_router(time_intel_router)
app.include_router(predict_router)
app.include_router(chat_router)
app.include_router(gamification_router)
app.include_router(rag_router)
app.include_router(ai_analysis_router)


@app.get("/")
async def root():
    """API 根路径"""
    return {
        "name": "Vibing u API",
        "version": "0.2.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}
