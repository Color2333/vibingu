"""
简单密码认证 API
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import os
import hashlib
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 简单的 token 存储（生产环境应该用 Redis）
valid_tokens: set = set()


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
    
    if token not in valid_tokens:
        raise HTTPException(status_code=401, detail="无效的认证信息")
    
    return token

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: str | None = None

class VerifyRequest(BaseModel):
    token: str

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    密码登录
    """
    admin_password = os.getenv("ADMIN_PASSWORD", "vibingu2024")
    
    if request.password == admin_password:
        # 生成 token
        token = secrets.token_urlsafe(32)
        valid_tokens.add(token)
        return LoginResponse(success=True, token=token)
    
    raise HTTPException(status_code=401, detail="密码错误")

@router.post("/verify")
async def verify(request: VerifyRequest):
    """
    验证 token
    """
    if request.token in valid_tokens:
        return {"valid": True}
    return {"valid": False}

@router.post("/logout")
async def logout(request: VerifyRequest):
    """
    登出
    """
    valid_tokens.discard(request.token)
    return {"success": True}
