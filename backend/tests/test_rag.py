"""RAG 服务单元测试"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta


class TestRAGService:
    """测试 RAGService 类"""
    
    @pytest.fixture
    def rag_service(self, test_db, tmp_path):
        """创建 RAG 服务实例"""
        persist_dir = str(tmp_path / "chroma_test")
        
        with patch('app.services.rag.get_settings') as mock_settings:
            mock_settings.return_value.get_ai_api_key.return_value = "test-key"
            mock_settings.return_value.get_ai_base_url.return_value = "https://test.api.com"
            mock_settings.return_value.get_chroma_persist_dir.return_value = persist_dir
            mock_settings.return_value.embedding_model = "embedding-3"
            mock_settings.return_value.smart_model = "glm-4.7"
            
            with patch('app.services.rag.SessionLocal', return_value=test_db):
                from app.services.rag import RAGService
                service = RAGService(persist_dir=persist_dir)
                service.db = test_db
                yield service
    
    def test_build_document_text(self, rag_service, sample_life_records):
        """测试文档构建"""
        record = sample_life_records[0]
        
        doc_text = rag_service._build_document_text(record)
        
        assert "时间:" in doc_text or "类别:" in doc_text
        assert isinstance(doc_text, str)
        assert len(doc_text) > 0
    
    def test_build_document_text_empty_record(self, rag_service):
        """测试空记录的文档构建"""
        from app.models import LifeStream
        empty_record = LifeStream()
        
        doc_text = rag_service._build_document_text(empty_record)
        
        assert isinstance(doc_text, str)
    
    def test_get_time_context(self, rag_service):
        """测试时间上下文"""
        context = rag_service._get_time_context()
        
        assert "现在是" in context
        assert "年" in context
        assert "月" in context
        assert "日" in context
        
        # 应该包含季节
        assert any(season in context for season in ["春季", "夏季", "秋季", "冬季"])
    
    def test_get_stats(self, rag_service):
        """测试统计信息"""
        stats = rag_service.get_stats()
        
        assert "indexed_count" in stats
        assert "database_count" in stats
        assert "embedding_model" in stats
    
    def test_clear_index(self, rag_service):
        """测试清空索引"""
        result = rag_service.clear_index()
        
        assert result.get("status") == "cleared" or "error" not in result


class TestRAGServiceWithMockEmbedding:
    """测试带模拟嵌入的 RAG 服务"""
    
    @pytest.fixture
    def rag_service_mocked(self, test_db, tmp_path, sample_life_records):
        """创建带模拟嵌入的 RAG 服务"""
        persist_dir = str(tmp_path / "chroma_test")
        
        with patch('app.services.rag.get_settings') as mock_settings:
            mock_settings.return_value.get_ai_api_key.return_value = "test-key"
            mock_settings.return_value.get_ai_base_url.return_value = "https://test.api.com"
            mock_settings.return_value.get_chroma_persist_dir.return_value = persist_dir
            mock_settings.return_value.embedding_model = "embedding-3"
            mock_settings.return_value.smart_model = "glm-4.7"
            
            with patch('app.services.rag.SessionLocal', return_value=test_db):
                from app.services.rag import RAGService
                service = RAGService(persist_dir=persist_dir)
                service.db = test_db
                
                # 模拟嵌入
                mock_embedding_response = MagicMock()
                mock_embedding_response.data = [MagicMock()]
                mock_embedding_response.data[0].embedding = [0.1] * 1024
                service.openai_client.embeddings.create = Mock(return_value=mock_embedding_response)
                
                yield service
    
    def test_index_record(self, rag_service_mocked, sample_life_records):
        """测试索引单条记录"""
        record = sample_life_records[0]
        
        result = rag_service_mocked.index_record(record)
        
        assert result is True
    
    def test_search(self, rag_service_mocked, sample_life_records):
        """测试搜索"""
        # 先索引一些记录
        for record in sample_life_records[:3]:
            rag_service_mocked.index_record(record)
        
        # 搜索
        results = rag_service_mocked.search("睡眠", n_results=5)
        
        assert isinstance(results, list)


class TestRAGServiceAsk:
    """测试 RAG 问答功能"""
    
    @pytest.fixture
    def rag_service_ask(self, test_db, tmp_path, sample_life_records):
        """创建用于问答测试的 RAG 服务"""
        persist_dir = str(tmp_path / "chroma_test")
        
        with patch('app.services.rag.get_settings') as mock_settings:
            mock_settings.return_value.get_ai_api_key.return_value = "test-key"
            mock_settings.return_value.get_ai_base_url.return_value = "https://test.api.com"
            mock_settings.return_value.get_chroma_persist_dir.return_value = persist_dir
            mock_settings.return_value.embedding_model = "embedding-3"
            mock_settings.return_value.smart_model = "glm-4.7"
            
            with patch('app.services.rag.SessionLocal', return_value=test_db):
                from app.services.rag import RAGService
                service = RAGService(persist_dir=persist_dir)
                service.db = test_db
                
                # 模拟嵌入
                mock_embedding_response = MagicMock()
                mock_embedding_response.data = [MagicMock()]
                mock_embedding_response.data[0].embedding = [0.1] * 1024
                service.openai_client.embeddings.create = Mock(return_value=mock_embedding_response)
                
                # 模拟聊天
                mock_chat_response = MagicMock()
                mock_chat_response.choices = [MagicMock()]
                mock_chat_response.choices[0].message.content = "这是 AI 的回答"
                service.openai_client.chat.completions.create = Mock(return_value=mock_chat_response)
                
                yield service
    
    def test_ask_no_context(self, rag_service_ask):
        """测试无上下文时的问答"""
        result = rag_service_ask.ask("你好", n_context=5)
        
        assert "answer" in result
        assert "sources" in result
    
    def test_ask_with_indexed_data(self, rag_service_ask, sample_life_records):
        """测试有数据时的问答"""
        # 索引数据
        for record in sample_life_records[:5]:
            rag_service_ask.index_record(record)
        
        result = rag_service_ask.ask("我的睡眠怎么样", n_context=3)
        
        assert "answer" in result
        assert isinstance(result["answer"], str)
    
    def test_ask_with_context(self, rag_service_ask, sample_life_records):
        """测试带对话历史的问答"""
        # 索引数据
        for record in sample_life_records[:3]:
            rag_service_ask.index_record(record)
        
        history = [
            {"role": "user", "content": "我最近睡眠怎么样"},
            {"role": "assistant", "content": "根据记录，你的睡眠还不错"}
        ]
        
        result = rag_service_ask.ask_with_context(
            "有什么改进建议吗",
            conversation_history=history,
            n_context=3
        )
        
        assert "answer" in result
