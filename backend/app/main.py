from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, Base
from app.routers import feed_router, history_router, analytics_router, reports_router, auth_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时创建表（开发环境）
    if settings.debug:
        Base.metadata.create_all(bind=engine)
    yield
    # 关闭时的清理工作（如需要）


app = FastAPI(
    title="Vibing u API",
    description="数字人生黑匣子 - 记录、分析、优化你的生活状态",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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


@app.get("/")
async def root():
    """API 根路径"""
    return {
        "name": "Vibing u API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}
