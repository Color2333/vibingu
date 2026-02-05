"""时间智能分析单元测试"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta


class TestTimeIntelligence:
    """测试 TimeIntelligence 类"""
    
    @pytest.fixture
    def time_intel(self, test_db):
        """创建 TimeIntelligence 实例"""
        with patch('app.services.time_intelligence.SessionLocal', return_value=test_db):
            from app.services.time_intelligence import TimeIntelligence
            ti = TimeIntelligence()
            ti.db = test_db
            yield ti
    
    def test_normalize_activity(self, time_intel):
        """测试活动归一化"""
        assert time_intel._normalize_activity(10, 100) == 10.0
        assert time_intel._normalize_activity(50, 100) == 50.0
        assert time_intel._normalize_activity(100, 100) == 100.0
        assert time_intel._normalize_activity(0, 100) == 0.0
        assert time_intel._normalize_activity(5, 0) == 0  # 边界情况
    
    def test_find_peak_hours(self, time_intel):
        """测试高峰时段识别"""
        hourly_counts = {
            8: 5, 9: 10, 10: 15, 11: 8,
            14: 12, 15: 7, 16: 3
        }
        
        peaks = time_intel._find_peak_hours(hourly_counts)
        assert 10 in peaks  # 最高
        assert 14 in peaks  # 次高
    
    def test_find_peak_hours_empty(self, time_intel):
        """测试空数据时的高峰识别"""
        peaks = time_intel._find_peak_hours({})
        assert peaks == []
    
    def test_find_valley_hours(self, time_intel):
        """测试低谷时段识别"""
        hourly_counts = {
            8: 10, 9: 15, 10: 20,
            14: 2, 15: 3, 16: 1
        }
        
        valleys = time_intel._find_valley_hours(hourly_counts)
        assert 16 in valleys  # 最低
    
    def test_infer_chronotype_lion(self, time_intel):
        """测试生物钟类型推断 - 狮子型"""
        peak_hours = [6, 7, 8, 9]
        chronotype = time_intel._infer_chronotype(peak_hours)
        assert chronotype == "lion"
    
    def test_infer_chronotype_bear(self, time_intel):
        """测试生物钟类型推断 - 熊型"""
        peak_hours = [10, 11, 12, 13]
        chronotype = time_intel._infer_chronotype(peak_hours)
        assert chronotype == "bear"
    
    def test_infer_chronotype_wolf(self, time_intel):
        """测试生物钟类型推断 - 狼型"""
        peak_hours = [16, 17, 18, 19]
        chronotype = time_intel._infer_chronotype(peak_hours)
        assert chronotype == "wolf"
    
    def test_infer_chronotype_dolphin(self, time_intel):
        """测试生物钟类型推断 - 海豚型"""
        peak_hours = [20, 21, 22, 23]
        chronotype = time_intel._infer_chronotype(peak_hours)
        assert chronotype == "dolphin"
    
    def test_infer_chronotype_empty(self, time_intel):
        """测试空数据时的生物钟类型"""
        chronotype = time_intel._infer_chronotype([])
        assert chronotype == "bear"  # 默认
    
    def test_empty_circadian_result(self, time_intel):
        """测试空昼夜节律结果"""
        result = time_intel._empty_circadian_result()
        
        assert result["period_days"] == 0
        assert result["total_records"] == 0
        assert result["chronotype"] == "bear"
        assert len(result["hourly_stats"]) == 24
    
    def test_get_time_period_name(self, time_intel):
        """测试获取时间段名称"""
        assert time_intel.get_time_period_name(6) == "黎明"
        assert time_intel.get_time_period_name(10) == "上午"
        assert time_intel.get_time_period_name(13) == "中午"
        assert time_intel.get_time_period_name(15) == "下午"
        assert time_intel.get_time_period_name(19) == "傍晚"
        assert time_intel.get_time_period_name(22) == "夜晚"
        assert time_intel.get_time_period_name(2) == "深夜"


class TestTimeIntelligenceWithData:
    """测试带数据的 TimeIntelligence"""
    
    @pytest.fixture
    def time_intel_with_data(self, test_db, sample_life_records):
        """创建带数据的 TimeIntelligence"""
        with patch('app.services.time_intelligence.SessionLocal', return_value=test_db):
            from app.services.time_intelligence import TimeIntelligence
            ti = TimeIntelligence()
            ti.db = test_db
            yield ti
    
    def test_analyze_circadian_rhythm(self, time_intel_with_data):
        """测试昼夜节律分析"""
        result = time_intel_with_data.analyze_circadian_rhythm(days=30)
        
        assert "period_days" in result
        assert "total_records" in result
        assert "hourly_stats" in result
        assert "chronotype" in result
        assert "recommendations" in result
        
        # 应该有数据
        assert result["total_records"] > 0
    
    def test_analyze_weekly_pattern(self, time_intel_with_data):
        """测试周周期分析"""
        result = time_intel_with_data.analyze_weekly_pattern(weeks=4)
        
        assert "period_weeks" in result
        assert "daily_stats" in result
        assert "weekday_avg" in result
        assert "weekend_avg" in result
        assert "best_day" in result
        assert "worst_day" in result
    
    def test_get_hourly_distribution(self, time_intel_with_data):
        """测试24小时分布"""
        result = time_intel_with_data.get_hourly_distribution(days=30)
        
        assert isinstance(result, list)
        assert len(result) == 24
        
        # 检查数据结构
        if result:
            assert "hour" in result[0]
            assert "label" in result[0]
            assert "count" in result[0]
    
    def test_get_bio_clock_profile(self, time_intel_with_data):
        """测试生物钟画像"""
        result = time_intel_with_data.get_bio_clock_profile()
        
        assert "chronotype" in result
        assert "optimal_times" in result
        assert "weekly_pattern" in result
        assert "recommendations" in result
        
        # 检查生物钟类型
        assert "name" in result["chronotype"]
        assert "description" in result["chronotype"]


class TestTimeIntelligenceAsync:
    """测试 TimeIntelligence 异步方法"""
    
    @pytest.fixture
    def time_intel_with_mock(self, test_db, sample_life_records):
        """创建带模拟的 TimeIntelligence"""
        with patch('app.services.time_intelligence.SessionLocal', return_value=test_db):
            from app.services.time_intelligence import TimeIntelligence
            ti = TimeIntelligence()
            ti.db = test_db
            yield ti
    
    @pytest.mark.asyncio
    async def test_get_ai_time_insights(self, time_intel_with_mock):
        """测试 AI 时间洞察"""
        mock_ai_response = {
            "content": {
                "pattern_summary": "测试模式总结",
                "key_insights": ["洞察1", "洞察2"],
                "efficiency_tips": ["建议1"],
                "health_suggestions": ["健康建议1"],
                "optimal_schedule": {
                    "focus_work": "9:00-11:00",
                    "creative_work": "15:00-17:00",
                    "exercise": "18:00",
                    "rest": "12:00-13:00"
                },
                "smart_reminders": []
            }
        }
        
        with patch('app.services.ai_client.get_ai_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat_completion = AsyncMock(return_value=mock_ai_response)
            mock_get_client.return_value = mock_client
            
            result = await time_intel_with_mock.get_ai_time_insights(days=30)
            
            assert "has_data" in result
    
    @pytest.mark.asyncio
    async def test_get_smart_reminders(self, time_intel_with_mock):
        """测试智能提醒"""
        result = await time_intel_with_mock.get_smart_reminders()
        
        assert isinstance(result, list)
        
        if result:
            assert "time" in result[0]
            assert "message" in result[0]
            assert "type" in result[0]
