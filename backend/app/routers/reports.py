"""
报告 API - 周报、月报和数据导出
"""

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel
import json
import csv
import io

from app.database import get_db
from app.services.report_generator import ReportGenerator
from app.services.milestones import MilestoneService

router = APIRouter(prefix="/api/reports", tags=["reports"])


class CategoryBreakdown(BaseModel):
    """分类统计"""
    SLEEP: int = 0
    DIET: int = 0
    SCREEN: int = 0
    ACTIVITY: int = 0
    MOOD: int = 0


class DayVibe(BaseModel):
    """每日 Vibe"""
    date: str
    vibe_score: Optional[int]


class ReportResponse(BaseModel):
    """报告响应"""
    period_type: str
    start_date: str
    end_date: str
    total_records: int
    category_breakdown: Dict[str, int]
    average_vibe_score: Optional[int]
    best_day: Optional[DayVibe]
    worst_day: Optional[DayVibe]
    daily_vibes: List[DayVibe]
    insights: List[str]


class ExportResponse(BaseModel):
    """导出响应"""
    export_date: str
    total_records: int
    date_range: Dict[str, Optional[str]]
    data: List[Dict[str, Any]]


@router.get("/weekly", response_model=ReportResponse)
async def get_weekly_report(
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)，默认今天"),
    db: Session = Depends(get_db),
):
    """
    获取周报
    
    - **end_date**: 周报结束日期，默认为今天
    """
    target_date = None
    if end_date:
        try:
            target_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="日期格式错误")
    
    generator = ReportGenerator(db)
    report = generator.generate_weekly_report(target_date)
    
    return report


@router.get("/monthly", response_model=ReportResponse)
async def get_monthly_report(
    year: int = Query(..., description="年份"),
    month: int = Query(..., ge=1, le=12, description="月份 (1-12)"),
    db: Session = Depends(get_db),
):
    """
    获取月报
    
    - **year**: 年份
    - **month**: 月份
    """
    generator = ReportGenerator(db)
    report = generator.generate_monthly_report(year, month)
    
    return report


@router.get("/export")
async def export_data(
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    format: str = Query("json", description="导出格式: json 或 csv"),
    db: Session = Depends(get_db),
):
    """
    导出个人数据
    
    - **start_date**: 开始日期 (可选)
    - **end_date**: 结束日期 (可选)
    - **format**: 导出格式 (json/csv)
    """
    start = None
    end = None
    
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="开始日期格式错误")
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="结束日期格式错误")
    
    generator = ReportGenerator(db)
    export = generator.export_data(start, end, format)
    
    if format == "csv":
        # 生成 CSV
        output = io.StringIO()
        if export["data"]:
            writer = csv.DictWriter(output, fieldnames=export["data"][0].keys())
            writer.writeheader()
            for row in export["data"]:
                # 将 meta_data 转为字符串
                row_copy = row.copy()
                if row_copy.get("meta_data"):
                    row_copy["meta_data"] = json.dumps(row_copy["meta_data"], ensure_ascii=False)
                writer.writerow(row_copy)
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=vibingu_export_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
    
    # 默认返回 JSON
    return export


@router.get("/milestones")
async def get_milestones(db: Session = Depends(get_db)):
    """
    获取里程碑和成就数据
    """
    service = MilestoneService(db)
    return service.get_all_milestones()


@router.get("/suggestions", response_model=List[str])
async def get_smart_suggestions(
    db: Session = Depends(get_db),
):
    """
    获取智能建议
    
    根据历史数据分析生成个性化建议
    """
    generator = ReportGenerator(db)
    
    # 获取最近7天的报告
    report = generator.generate_weekly_report()
    
    suggestions = []
    
    # 基于平均分的建议
    avg_vibe = report.get("average_vibe_score")
    if avg_vibe is not None:
        if avg_vibe < 50:
            suggestions.append("最近状态不太好，建议保证充足睡眠，减少咖啡因摄入")
        elif avg_vibe < 70:
            suggestions.append("状态还行，可以通过增加运动来进一步提升")
    
    # 基于分类的建议
    breakdown = report.get("category_breakdown", {})
    
    if breakdown.get("SLEEP", 0) == 0:
        suggestions.append("记得每天记录睡眠情况，帮助追踪睡眠质量")
    
    if breakdown.get("ACTIVITY", 0) < 3:
        suggestions.append("这周运动次数较少，建议每周至少运动3次")
    
    if breakdown.get("DIET", 0) > 10:
        diet_count = breakdown["DIET"]
        suggestions.append(f"这周记录了 {diet_count} 次饮食，注意营养均衡")
    
    # 基于趋势的建议
    daily_vibes = report.get("daily_vibes", [])
    if len(daily_vibes) >= 3:
        recent_scores = [d["vibe_score"] for d in daily_vibes[-3:] if d["vibe_score"] is not None]
        if len(recent_scores) >= 2:
            if recent_scores[-1] < recent_scores[0]:
                suggestions.append("最近几天状态有下降趋势，注意休息和调整")
            elif recent_scores[-1] > recent_scores[0]:
                suggestions.append("状态正在改善，继续保持！")
    
    if not suggestions:
        suggestions.append("继续保持记录习惯，数据越多分析越准确")
    
    return suggestions
