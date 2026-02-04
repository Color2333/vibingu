from app.routers.feed import router as feed_router
from app.routers.history import router as history_router
from app.routers.analytics import router as analytics_router
from app.routers.reports import router as reports_router
from app.routers.auth import router as auth_router

__all__ = ["feed_router", "history_router", "analytics_router", "reports_router", "auth_router"]
