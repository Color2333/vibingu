"""测试配置和 fixtures"""
import pytest
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base


# 测试数据库配置
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """创建测试数据库"""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def mock_ai_client():
    """模拟 AI 客户端"""
    with patch('app.services.ai_client.get_ai_client') as mock:
        client = Mock()
        client.chat_completion = AsyncMock(return_value={
            "content": {"test": "response"},
            "model": "test-model",
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}
        })
        client.vision_completion = AsyncMock(return_value={
            "content": {"test": "vision_response"},
            "model": "test-vision-model",
            "usage": {"prompt_tokens": 200, "completion_tokens": 100, "total_tokens": 300}
        })
        client.get_embedding = AsyncMock(return_value=[0.1] * 1024)
        mock.return_value = client
        yield client


@pytest.fixture
def sample_life_records(test_db):
    """创建示例生活记录"""
    from app.models import LifeStream
    
    records = []
    now = datetime.now()
    
    # 创建一周的测试数据
    for i in range(7):
        record_time = now - timedelta(days=i)
        
        # 睡眠记录
        sleep_record = LifeStream(
            input_type="TEXT",
            raw_content=f"睡眠记录 第{i+1}天",
            category="SLEEP",
            tags=["#身体/睡眠", f"#时间/{'晚间' if record_time.hour > 20 else '早晨'}"],
            dimension_scores={"body": 70 + i, "mood": 60 + i},
            meta_data={"duration_hours": 7 + (i % 3) - 1, "quality": "good" if i % 2 == 0 else "normal"},
            created_at=record_time.replace(hour=23)
        )
        records.append(sleep_record)
        
        # 饮食记录
        diet_record = LifeStream(
            input_type="TEXT",
            raw_content=f"早餐 第{i+1}天",
            category="DIET",
            tags=["#饮食/早餐", "#时间/早晨"],
            dimension_scores={"body": 65 + i},
            meta_data={"is_healthy": True, "meal_type": "breakfast"},
            created_at=record_time.replace(hour=8)
        )
        records.append(diet_record)
        
        # 心情记录
        mood_record = LifeStream(
            input_type="TEXT",
            raw_content=f"心情不错 第{i+1}天",
            category="MOOD",
            tags=["#心情/开心", "#时间/下午"],
            dimension_scores={"mood": 75 + i, "social": 50 + i},
            meta_data={},
            created_at=record_time.replace(hour=15)
        )
        records.append(mood_record)
    
    test_db.add_all(records)
    test_db.commit()
    
    return records
