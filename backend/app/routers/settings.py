"""
用户设置 API — 昵称、偏好等
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging

from app.database import get_db
from app.models.app_settings import AppSettings
from app.routers.auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ========== Schemas ==========

class NicknameRequest(BaseModel):
    nickname: str  # 1-20 字符


class SettingsResponse(BaseModel):
    nickname: Optional[str] = None


# ========== Helper ==========

def get_setting(db: Session, key: str) -> Optional[str]:
    """读取设置值"""
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else None


def set_setting(db: Session, key: str, value: str):
    """写入设置值（upsert）"""
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        row = AppSettings(key=key, value=value)
        db.add(row)
    db.commit()


def get_nickname(db: Session) -> str:
    """获取用户昵称（快捷方法），默认返回'小菜'"""
    return get_setting(db, "nickname") or "小菜"


# ========== Endpoints ==========

@router.get("", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db), _user=Depends(verify_token)):
    """获取所有用户设置"""
    return SettingsResponse(
        nickname=get_setting(db, "nickname"),
    )


@router.put("/nickname")
async def update_nickname(
    request: NicknameRequest,
    db: Session = Depends(get_db),
    _user=Depends(verify_token),
):
    """设置用户昵称"""
    nickname = request.nickname.strip()
    if len(nickname) > 20:
        nickname = nickname[:20]
    if len(nickname) == 0:
        # 空字符串 = 清除昵称
        row = db.query(AppSettings).filter(AppSettings.key == "nickname").first()
        if row:
            db.delete(row)
            db.commit()
        return {"nickname": None}

    set_setting(db, "nickname", nickname)
    logger.info(f"用户昵称已更新: {nickname}")
    return {"nickname": nickname}
