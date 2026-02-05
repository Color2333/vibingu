"""预测器单元测试"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta


class TestPredictor:
    """测试 Predictor 类"""
    
    @pytest.fixture
    def predictor(self, test_db):
        """创建 Predictor 实例"""
        with patch('app.services.predictor.SessionLocal', return_value=test_db):
            from app.services.predictor import Predictor
            p = Predictor()
            p.db = test_db
            yield p
    
    def test_weekday_name(self, predictor):
        """测试星期名称"""
        assert predictor._weekday_name(0) == "周一"
        assert predictor._weekday_name(4) == "周五"
        assert predictor._weekday_name(6) == "周日"
    
    def test_calculate_confidence_high(self, predictor):
        """测试置信度计算 - 高"""
        confidence = predictor._calculate_confidence(10, {"direction": "stable", "strength": 2})
        assert confidence == "high"
    
    def test_calculate_confidence_medium(self, predictor):
        """测试置信度计算 - 中"""
        confidence = predictor._calculate_confidence(4, {"direction": "up", "strength": 3})
        assert confidence == "medium"
    
    def test_calculate_confidence_low(self, predictor):
        """测试置信度计算 - 低"""
        confidence = predictor._calculate_confidence(1, {"direction": "down", "strength": 10})
        assert confidence == "low"
    
    def test_calculate_factor_adjustment_positive(self, predictor):
        """测试因素调整 - 正向"""
        factors = [
            {"type": "sleep", "impact": "positive"},
            {"type": "exercise", "impact": "positive"}
        ]
        adjustment = predictor._calculate_factor_adjustment(factors)
        assert adjustment == 6  # 2 * 3
    
    def test_calculate_factor_adjustment_negative(self, predictor):
        """测试因素调整 - 负向"""
        factors = [
            {"type": "caffeine", "impact": "negative"}
        ]
        adjustment = predictor._calculate_factor_adjustment(factors)
        assert adjustment == -5
    
    def test_generate_recommendations_sleep(self, predictor):
        """测试建议生成 - 睡眠"""
        adjustments = [{"factor": "睡眠", "impact": -10, "reason": "睡眠不足"}]
        recommendations = predictor._generate_recommendations(adjustments)
        
        assert len(recommendations) > 0
        assert any("睡眠" in r for r in recommendations)
    
    def test_generate_recommendations_caffeine(self, predictor):
        """测试建议生成 - 咖啡因"""
        adjustments = [{"factor": "咖啡因", "impact": -8, "reason": "下午咖啡因"}]
        recommendations = predictor._generate_recommendations(adjustments)
        
        assert len(recommendations) > 0
        assert any("咖啡因" in r for r in recommendations)


class TestPredictorWithData:
    """测试带数据的 Predictor"""
    
    @pytest.fixture
    def predictor_with_data(self, test_db, sample_life_records):
        """创建带数据的 Predictor"""
        with patch('app.services.predictor.SessionLocal', return_value=test_db):
            from app.services.predictor import Predictor
            p = Predictor()
            p.db = test_db
            yield p
    
    def test_predict_tomorrow_vibe(self, predictor_with_data):
        """测试次日预测"""
        result = predictor_with_data.predict_tomorrow_vibe()
        
        assert "predicted_date" in result
        assert "predicted_score" in result
        assert "confidence" in result
        
        # 分数应该在合理范围
        assert 0 <= result["predicted_score"] <= 100
    
    def test_detect_anomalies(self, predictor_with_data):
        """测试异常检测"""
        result = predictor_with_data.detect_anomalies(days=30)
        
        assert "period_days" in result
        assert "total_records" in result
        assert "anomalies" in result
    
    def test_get_health_alerts(self, predictor_with_data):
        """测试健康提醒"""
        alerts = predictor_with_data.get_health_alerts()
        
        assert isinstance(alerts, list)
        
        # 如果有提醒，检查结构
        for alert in alerts:
            assert "type" in alert
            assert "level" in alert
            assert "title" in alert
            assert "message" in alert
    
    def test_what_if_simulation_ideal(self, predictor_with_data):
        """测试 What-if 模拟 - 理想场景"""
        scenario = {
            "sleep_hours": 8,
            "exercise_minutes": 45,
            "caffeine_after_2pm": False,
            "screen_hours": 3
        }
        
        result = predictor_with_data.what_if_simulation(scenario)
        
        assert "predicted_score" in result
        assert "adjustments" in result
        assert "recommendations" in result
        
        # 理想场景应该得分较高
        assert result["predicted_score"] >= 70
    
    def test_what_if_simulation_poor(self, predictor_with_data):
        """测试 What-if 模拟 - 差场景"""
        scenario = {
            "sleep_hours": 4,
            "exercise_minutes": 0,
            "caffeine_after_2pm": True,
            "screen_hours": 10
        }
        
        result = predictor_with_data.what_if_simulation(scenario)
        
        # 差场景应该得分较低
        assert result["predicted_score"] < 50
    
    def test_analyze_causation(self, predictor_with_data):
        """测试因果分析"""
        result = predictor_with_data.analyze_causation()
        
        assert "date" in result
        assert "factors" in result
        assert "summary" in result


class TestPredictorAsync:
    """测试 Predictor 异步方法"""
    
    @pytest.fixture
    def predictor_with_mock(self, test_db, sample_life_records):
        """创建带模拟的 Predictor"""
        with patch('app.services.predictor.SessionLocal', return_value=test_db):
            from app.services.predictor import Predictor
            p = Predictor()
            p.db = test_db
            yield p
    
    @pytest.mark.asyncio
    async def test_ai_predict_tomorrow(self, predictor_with_mock):
        """测试 AI 次日预测"""
        mock_ai_response = {
            "content": {
                "adjusted_score": 65,
                "confidence": "medium",
                "key_factors": ["睡眠充足", "有运动"],
                "improvement_tips": ["早睡", "减少屏幕时间"],
                "risk_factors": [],
                "morning_suggestion": "早起喝杯水"
            }
        }
        
        with patch('app.services.ai_client.get_ai_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat_completion = AsyncMock(return_value=mock_ai_response)
            mock_get_client.return_value = mock_client
            
            result = await predictor_with_mock.ai_predict_tomorrow()
            
            assert "predicted_score" in result
            assert "predicted_date" in result
    
    @pytest.mark.asyncio
    async def test_ai_detect_risks(self, predictor_with_mock):
        """测试 AI 风险检测"""
        mock_ai_response = {
            "content": {
                "risk_level": "low",
                "risk_score": 25,
                "immediate_concerns": [],
                "long_term_trends": ["睡眠时间略有下降"],
                "preventive_suggestions": ["保持规律作息"],
                "positive_notes": ["运动习惯保持良好"]
            }
        }
        
        with patch('app.services.ai_client.get_ai_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat_completion = AsyncMock(return_value=mock_ai_response)
            mock_get_client.return_value = mock_client
            
            result = await predictor_with_mock.ai_detect_risks()
            
            assert "has_data" in result
            assert "system_alerts" in result
