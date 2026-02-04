"""
报告生成服务 - 生成周报、月报和年度报告
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models import LifeStream, DailySummary
from app.services.vibe_calculator import VibeCalculator


class ReportGenerator:
    """生成周期性生活报告"""
    
    def __init__(self, db: Session):
        self.db = db
        self.calculator = VibeCalculator(db)
    
    def generate_weekly_report(self, end_date: Optional[date] = None) -> Dict[str, Any]:
        """
        生成周报
        
        Args:
            end_date: 结束日期，默认为今天
        """
        if end_date is None:
            end_date = date.today()
        
        start_date = end_date - timedelta(days=6)
        
        return self._generate_period_report(start_date, end_date, "weekly")
    
    def generate_monthly_report(self, year: int, month: int) -> Dict[str, Any]:
        """生成月报"""
        start_date = date(year, month, 1)
        
        # 计算月末
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        return self._generate_period_report(start_date, end_date, "monthly")
    
    def _generate_period_report(
        self, 
        start_date: date, 
        end_date: date,
        period_type: str
    ) -> Dict[str, Any]:
        """生成周期报告的核心逻辑"""
        
        # 获取期间内所有记录
        start_time = datetime.combine(start_date, datetime.min.time())
        end_time = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        
        records = self.db.query(LifeStream).filter(
            and_(
                LifeStream.created_at >= start_time,
                LifeStream.created_at < end_time
            )
        ).all()
        
        # 统计各类别记录数
        category_counts = {}
        for r in records:
            cat = r.category or "OTHER"
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        # 计算每天的 Vibe 分数
        daily_vibes = []
        current = start_date
        total_vibe = 0
        vibe_count = 0
        
        while current <= end_date:
            vibe_data = self.calculator.calculate_daily_vibe(current)
            score = vibe_data.get("vibe_score")
            daily_vibes.append({
                "date": current.isoformat(),
                "vibe_score": score,
            })
            if score is not None:
                total_vibe += score
                vibe_count += 1
            current += timedelta(days=1)
        
        # 计算平均分
        avg_vibe = round(total_vibe / vibe_count) if vibe_count > 0 else None
        
        # 找出最高和最低分的日期
        valid_vibes = [d for d in daily_vibes if d["vibe_score"] is not None]
        best_day = max(valid_vibes, key=lambda x: x["vibe_score"]) if valid_vibes else None
        worst_day = min(valid_vibes, key=lambda x: x["vibe_score"]) if valid_vibes else None
        
        # 生成洞察
        insights = self._generate_period_insights(
            records, avg_vibe, category_counts, period_type
        )
        
        return {
            "period_type": period_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_records": len(records),
            "category_breakdown": category_counts,
            "average_vibe_score": avg_vibe,
            "best_day": best_day,
            "worst_day": worst_day,
            "daily_vibes": daily_vibes,
            "insights": insights,
        }
    
    def _generate_period_insights(
        self,
        records: List[LifeStream],
        avg_vibe: Optional[int],
        category_counts: Dict[str, int],
        period_type: str
    ) -> List[str]:
        """生成周期性洞察"""
        insights = []
        
        period_name = "这周" if period_type == "weekly" else "这个月"
        
        # 总体状态评价
        if avg_vibe is not None:
            if avg_vibe >= 80:
                insights.append(f"{period_name}状态很棒！平均 Vibe 指数 {avg_vibe} 分")
            elif avg_vibe >= 60:
                insights.append(f"{period_name}状态良好，平均 Vibe 指数 {avg_vibe} 分")
            elif avg_vibe >= 40:
                insights.append(f"{period_name}状态一般，平均 Vibe 指数 {avg_vibe} 分，还有提升空间")
            else:
                insights.append(f"{period_name}状态不太理想，平均 Vibe 指数仅 {avg_vibe} 分")
        
        # 记录活跃度
        total = len(records)
        if total > 20:
            insights.append(f"共记录 {total} 条数据，非常活跃！")
        elif total > 10:
            insights.append(f"共记录 {total} 条数据，保持得不错")
        elif total > 0:
            insights.append(f"共记录 {total} 条数据，可以更频繁地记录")
        else:
            insights.append(f"{period_name}没有记录数据，开始投喂 AI 吧")
        
        # 分类分析
        sleep_count = category_counts.get("SLEEP", 0)
        if sleep_count == 0:
            insights.append("没有睡眠记录，记得每天记录睡眠质量")
        
        activity_count = category_counts.get("ACTIVITY", 0)
        if activity_count >= 5:
            insights.append(f"运动记录 {activity_count} 次，运动习惯很好！")
        elif activity_count == 0:
            insights.append("没有运动记录，适当运动有助于提升状态")
        
        return insights
    
    def export_data(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        format: str = "json"
    ) -> Dict[str, Any]:
        """
        导出用户数据
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            format: 导出格式 (json/csv)
        """
        query = self.db.query(LifeStream).order_by(LifeStream.created_at.desc())
        
        if start_date:
            start_time = datetime.combine(start_date, datetime.min.time())
            query = query.filter(LifeStream.created_at >= start_time)
        
        if end_date:
            end_time = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
            query = query.filter(LifeStream.created_at < end_time)
        
        records = query.all()
        
        data = []
        for r in records:
            data.append({
                "id": str(r.id),
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "input_type": r.input_type,
                "category": r.category,
                "raw_content": r.raw_content,
                "meta_data": r.meta_data,
                "ai_insight": r.ai_insight,
            })
        
        return {
            "export_date": datetime.now().isoformat(),
            "total_records": len(data),
            "date_range": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None,
            },
            "data": data,
        }
