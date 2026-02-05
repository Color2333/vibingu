"""Tagger Agent 单元测试"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime


class TestTaggerAgent:
    """测试 TaggerAgent 类"""
    
    @pytest.fixture
    def tagger(self):
        """创建 Tagger 实例"""
        with patch('app.services.ai_client.get_ai_client') as mock_client:
            mock_client.return_value = Mock()
            
            from app.services.tagger import TaggerAgent
            agent = TaggerAgent()
            yield agent
    
    def test_tag_hierarchy_structure(self, tagger):
        """测试标签层级结构"""
        assert "身体" in tagger.tag_hierarchy
        assert "心情" in tagger.tag_hierarchy
        assert "饮食" in tagger.tag_hierarchy
        assert "时间" in tagger.tag_hierarchy
        
        # 检查子标签
        assert "睡眠" in tagger.tag_hierarchy["身体"]
        assert "开心" in tagger.tag_hierarchy["心情"]
    
    def test_get_time_period_morning(self, tagger):
        """测试时间段判断 - 早晨"""
        assert tagger._get_time_period(6) == "早晨"
        assert tagger._get_time_period(8) == "早晨"
    
    def test_get_time_period_noon(self, tagger):
        """测试时间段判断 - 中午"""
        assert tagger._get_time_period(12) == "中午"
        assert tagger._get_time_period(13) == "中午"
    
    def test_get_time_period_afternoon(self, tagger):
        """测试时间段判断 - 下午"""
        assert tagger._get_time_period(14) == "下午"
        assert tagger._get_time_period(16) == "下午"
    
    def test_get_time_period_evening(self, tagger):
        """测试时间段判断 - 傍晚/晚间"""
        assert tagger._get_time_period(18) == "傍晚"
        assert tagger._get_time_period(21) == "晚间"
    
    def test_get_time_period_night(self, tagger):
        """测试时间段判断 - 深夜/凌晨"""
        assert tagger._get_time_period(23) == "深夜"
        assert tagger._get_time_period(2) == "凌晨"
    
    def test_rule_based_tags_sleep(self, tagger):
        """测试规则生成标签 - 睡眠"""
        tags = tagger._rule_based_tags(
            text="睡了8小时",
            category="SLEEP",
            meta_data={"duration_hours": 8}
        )
        
        assert any("时间" in tag for tag in tags)
        assert any("睡眠" in tag for tag in tags)
    
    def test_rule_based_tags_diet(self, tagger):
        """测试规则生成标签 - 饮食"""
        tags = tagger._rule_based_tags(
            text="喝了一杯咖啡",
            category="DIET",
            meta_data={}
        )
        
        assert any("时间" in tag for tag in tags)
        assert any("咖啡" in tag for tag in tags)
    
    def test_rule_based_tags_mood(self, tagger):
        """测试规则生成标签 - 心情"""
        tags = tagger._rule_based_tags(
            text="今天很开心",
            category="MOOD",
            meta_data={}
        )
        
        assert any("时间" in tag for tag in tags)
        assert any("心情" in tag for tag in tags) or any("开心" in tag for tag in tags)
    
    def test_rule_based_tags_limit(self, tagger):
        """测试标签数量限制"""
        tags = tagger._rule_based_tags(
            text="跑步 健身 游戏 书 电影 会议 学习 咖啡",
            category="ACTIVITY",
            meta_data={}
        )
        
        assert len(tags) <= 6


class TestTaggerAgentAsync:
    """测试 TaggerAgent 异步方法"""
    
    @pytest.fixture
    def tagger_with_mock(self):
        """创建带模拟的 Tagger"""
        with patch('app.services.ai_client.get_ai_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat_completion = AsyncMock(return_value={
                "content": ["#时间/下午", "#心情/开心", "#习惯/好习惯"]
            })
            mock_get_client.return_value = mock_client
            
            from app.services.tagger import TaggerAgent
            agent = TaggerAgent()
            agent.ai_client = mock_client
            yield agent
    
    @pytest.mark.asyncio
    async def test_generate_tags_with_ai(self, tagger_with_mock):
        """测试 AI 生成标签"""
        with patch.object(tagger_with_mock, 'get_trending_tags', new_callable=AsyncMock) as mock_trending:
            mock_trending.return_value = ["#心情/开心", "#时间/下午"]
            
            tags = await tagger_with_mock.generate_tags(
                text="今天心情不错",
                category="MOOD"
            )
            
            assert isinstance(tags, list)
            assert len(tags) > 0
    
    @pytest.mark.asyncio
    async def test_generate_tags_fallback(self, tagger_with_mock):
        """测试 AI 失败时的回退"""
        # 模拟 AI 调用失败
        tagger_with_mock.ai_client.chat_completion = AsyncMock(side_effect=Exception("API Error"))
        
        with patch.object(tagger_with_mock, 'get_trending_tags', new_callable=AsyncMock) as mock_trending:
            mock_trending.return_value = []
            
            tags = await tagger_with_mock.generate_tags(
                text="睡眠记录",
                category="SLEEP"
            )
            
            # 应该回退到规则生成
            assert isinstance(tags, list)
            assert any("时间" in tag for tag in tags)


class TestTaggerStatistics:
    """测试标签统计功能"""
    
    @pytest.fixture
    def tagger_with_db(self, test_db, sample_life_records):
        """创建带数据库的 Tagger"""
        with patch('app.services.ai_client.get_ai_client') as mock_client:
            mock_client.return_value = Mock()
            with patch('app.services.tagger.SessionLocal', return_value=test_db):
                from app.services.tagger import TaggerAgent
                agent = TaggerAgent()
                yield agent
    
    @pytest.mark.asyncio
    async def test_get_trending_tags(self, tagger_with_db, test_db):
        """测试获取热门标签"""
        with patch('app.services.tagger.SessionLocal', return_value=test_db):
            tags = await tagger_with_db.get_trending_tags(days=7)
            
            assert isinstance(tags, list)
            # 应该包含示例数据中的标签
            if tags:
                assert all(isinstance(tag, str) for tag in tags)
    
    @pytest.mark.asyncio
    async def test_get_tag_statistics(self, tagger_with_db, test_db):
        """测试标签统计"""
        with patch('app.services.tagger.SessionLocal', return_value=test_db):
            stats = await tagger_with_db.get_tag_statistics(days=30)
            
            assert "period_days" in stats
            assert "total_tags_used" in stats
            assert "unique_tags" in stats
