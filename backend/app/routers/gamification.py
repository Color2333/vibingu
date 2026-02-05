"""游戏化 API"""

from fastapi import APIRouter

from app.services.gamification import get_gamification_service

router = APIRouter(prefix="/api/gamification", tags=["gamification"])


@router.get("/summary")
async def get_summary():
    """
    获取游戏化数据汇总
    
    包含等级、徽章、挑战信息
    """
    service = get_gamification_service()
    return service.get_gamification_summary()


@router.get("/level")
async def get_level():
    """
    获取用户等级信息
    """
    service = get_gamification_service()
    return service.get_level_info()


@router.get("/badges")
async def get_badges():
    """
    获取所有徽章（包含是否已获得）
    """
    service = get_gamification_service()
    return {
        "badges": service.get_all_badges(),
        "earned_count": len(service.get_user_badges()),
    }


@router.get("/badges/earned")
async def get_earned_badges():
    """
    获取已获得的徽章
    """
    service = get_gamification_service()
    return {"badges": service.get_user_badges()}


@router.post("/badges/check")
async def check_badges():
    """
    检查并授予符合条件的徽章
    """
    service = get_gamification_service()
    awarded = service.check_and_award_badges()
    return {
        "awarded": awarded,
        "awarded_count": len(awarded),
    }


@router.get("/challenges")
async def get_challenges():
    """
    获取当前活跃的挑战
    """
    service = get_gamification_service()
    challenges = service.get_active_challenges()
    
    # 如果没有挑战，创建本周挑战
    if not challenges:
        service.create_weekly_challenges()
        challenges = service.get_active_challenges()
    
    return {
        "challenges": challenges,
        "active_count": len(challenges),
        "completed_count": sum(1 for c in challenges if c["is_completed"]),
    }


@router.get("/streak")
async def get_streak():
    """
    获取连续记录信息
    """
    service = get_gamification_service()
    level_info = service.get_level_info()
    
    return {
        "current_streak": level_info["current_streak"],
        "longest_streak": level_info["longest_streak"],
        "total_records": level_info["total_records"],
    }
