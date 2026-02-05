"""预测 & 异常检测 API"""

from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.services.predictor import get_predictor

router = APIRouter(prefix="/api/predict", tags=["prediction"])


class WhatIfScenario(BaseModel):
    """What-if 模拟场景"""
    sleep_hours: Optional[float] = None
    exercise_minutes: Optional[int] = None
    caffeine_after_2pm: Optional[bool] = None
    screen_hours: Optional[float] = None


@router.get("/tomorrow")
async def predict_tomorrow():
    """
    预测明天的 Vibe Score
    
    基于历史模式、近期趋势和今日因素
    """
    predictor = get_predictor()
    return predictor.predict_tomorrow_vibe()


@router.get("/anomalies")
async def detect_anomalies(
    days: int = Query(30, ge=7, le=365, description="分析天数")
):
    """
    检测异常模式
    
    识别偏离正常模式的行为和数据
    """
    predictor = get_predictor()
    return predictor.detect_anomalies(days)


@router.get("/causation")
async def analyze_causation(
    date: Optional[str] = Query(None, description="目标日期 YYYY-MM-DD，默认今天")
):
    """
    因果归因分析
    
    分析影响当日状态的关键因素
    """
    target_date = None
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="日期格式错误")
    
    predictor = get_predictor()
    return predictor.analyze_causation(target_date)


@router.post("/what-if")
async def what_if_simulation(scenario: WhatIfScenario):
    """
    What-if 模拟
    
    模拟不同行为选择的影响
    """
    predictor = get_predictor()
    return predictor.what_if_simulation(scenario.model_dump())


@router.get("/alerts")
async def get_health_alerts():
    """
    获取健康提醒
    
    基于近期数据生成个性化提醒
    """
    predictor = get_predictor()
    return predictor.get_health_alerts()


# ========== AI 增强功能 v0.2 ==========

@router.get("/ai-tomorrow")
async def ai_predict_tomorrow():
    """
    AI 驱动的次日预测
    
    结合历史数据和 AI 分析，给出更精准的预测
    """
    predictor = get_predictor()
    return await predictor.ai_predict_tomorrow()


@router.get("/ai-risks")
async def ai_detect_risks():
    """
    AI 驱动的风险检测
    
    分析近期数据，识别潜在的健康风险
    """
    predictor = get_predictor()
    return await predictor.ai_detect_risks()
