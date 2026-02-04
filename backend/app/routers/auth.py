"""
简单密码认证 API
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import hashlib
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 简单的 token 存储（生产环境应该用 Redis）
valid_tokens: set = set()

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
