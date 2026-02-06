"""
密码认证 API（带 Token 过期机制）
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import os
import secrets
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Token 存储：token -> 过期时间戳
# 生产环境建议替换为 Redis
_token_store: dict[str, float] = {}

# Token 有效期（秒），默认 7 天
TOKEN_EXPIRE_SECONDS = int(os.getenv("TOKEN_EXPIRE_SECONDS", str(7 * 24 * 3600)))


def _cleanup_expired():
    """清理过期 token"""
    now = time.time()
    expired = [t for t, exp in _token_store.items() if exp < now]
    for t in expired:
        _token_store.pop(t, None)


def verify_token(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    验证 Bearer token 的依赖函数
    用于保护需要认证的端点
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    
    # 支持 "Bearer <token>" 格式
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization
    
    expire_at = _token_store.get(token)
    if expire_at is None or expire_at < time.time():
        # token 不存在或已过期
        _token_store.pop(token, None)
        raise HTTPException(status_code=401, detail="无效或已过期的认证信息")
    
    return token


class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: str | None = None

class VerifyRequest(BaseModel):
    token: str


def _get_admin_password() -> str:
    """获取管理员密码，未配置时使用安全提示"""
    password = os.getenv("ADMIN_PASSWORD") or os.getenv("AUTH_PASSWORD")
    if not password:
        logger.warning("⚠️ ADMIN_PASSWORD 未设置，使用默认密码 'changeme'。请立即通过环境变量配置！")
        return "changeme"
    return password


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    密码登录
    """
    admin_password = _get_admin_password()
    
    if request.password == admin_password:
        # 清理过期 token
        _cleanup_expired()
        # 生成 token
        token = secrets.token_urlsafe(32)
        _token_store[token] = time.time() + TOKEN_EXPIRE_SECONDS
        logger.info(f"用户登录成功，Token 有效期 {TOKEN_EXPIRE_SECONDS // 3600}h")
        return LoginResponse(success=True, token=token)
    
    raise HTTPException(status_code=401, detail="密码错误")


@router.post("/verify")
async def verify(request: VerifyRequest):
    """
    验证 token
    """
    expire_at = _token_store.get(request.token)
    if expire_at is not None and expire_at >= time.time():
        return {"valid": True}
    _token_store.pop(request.token, None)
    return {"valid": False}


@router.post("/logout")
async def logout(request: VerifyRequest):
    """
    登出
    """
    _token_store.pop(request.token, None)
    return {"success": True}
