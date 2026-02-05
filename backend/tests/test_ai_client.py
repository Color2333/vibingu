"""AI 客户端单元测试"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import json


class TestAIClient:
    """测试 AIClient 类"""
    
    @pytest.fixture
    def mock_settings(self):
        """创建模拟的设置对象"""
        settings = Mock()
        settings.get_ai_api_key.return_value = "test-api-key"
        settings.get_ai_base_url.return_value = "https://test.api.com"
        settings.vision_model = "glm-4.6v"
        settings.simple_vision_model = "glm-4.6v-flash"
        settings.text_model = "glm-4.7"
        settings.simple_text_model = "glm-4.7-flash"
        settings.smart_model = "glm-4.7"
        settings.embedding_model = "embedding-3"
        return settings
    
    @pytest.fixture
    def ai_client(self, mock_settings):
        """创建 AI 客户端实例"""
        with patch('app.services.ai_client.settings', mock_settings):
            from app.services.ai_client import AIClient
            client = AIClient()
            yield client
    
    def test_init_with_api_key(self, ai_client):
        """测试客户端初始化"""
        assert ai_client.client is not None
        assert ai_client.models["vision"] == "glm-4.6v"
        assert ai_client.models["text_flash"] == "glm-4.7-flash"
    
    def test_init_without_api_key(self):
        """测试无 API Key 时的初始化"""
        mock_settings = Mock()
        mock_settings.get_ai_api_key.return_value = None
        mock_settings.get_ai_base_url.return_value = None
        mock_settings.vision_model = "glm-4.6v"
        mock_settings.simple_vision_model = "glm-4.6v-flash"
        mock_settings.text_model = "glm-4.7"
        mock_settings.simple_text_model = "glm-4.7-flash"
        mock_settings.smart_model = "glm-4.7"
        mock_settings.embedding_model = "embedding-3"
        
        with patch('app.services.ai_client.settings', mock_settings):
            from app.services.ai_client import AIClient
            client = AIClient()
            assert client.client is None
    
    def test_is_retryable_error_rate_limit(self, ai_client):
        """测试速率限制错误可重试"""
        error = Exception("Error code: 429 - rate limit exceeded")
        assert ai_client._is_retryable_error(error) is True
    
    def test_is_retryable_error_server_error(self, ai_client):
        """测试服务器错误可重试"""
        error = Exception("Error code: 500 - internal server error")
        assert ai_client._is_retryable_error(error) is True
    
    def test_is_retryable_error_not_retryable(self, ai_client):
        """测试普通错误不可重试"""
        error = Exception("Invalid API key")
        assert ai_client._is_retryable_error(error) is False
    
    def test_get_fallback_model(self, ai_client):
        """测试模型降级"""
        # 付费模型降级到免费模型
        assert ai_client._get_fallback_model("glm-4.6v") == "glm-4.6v-flash"
        assert ai_client._get_fallback_model("glm-4.7") == "glm-4.7-flash"
        
        # 免费模型没有降级
        assert ai_client._get_fallback_model("glm-4.7-flash") is None
    
    def test_extract_json_valid(self, ai_client):
        """测试 JSON 提取 - 有效 JSON"""
        content = '{"key": "value"}'
        result = ai_client._extract_json(content)
        assert result == {"key": "value"}
    
    def test_extract_json_markdown_block(self, ai_client):
        """测试 JSON 提取 - Markdown 代码块"""
        content = '''这是一些文字
```json
{"key": "value"}
```
更多文字'''
        result = ai_client._extract_json(content)
        assert result == {"key": "value"}
    
    def test_extract_json_invalid(self, ai_client):
        """测试 JSON 提取 - 无效内容"""
        content = "这不是 JSON"
        result = ai_client._extract_json(content)
        assert result == content  # 返回原始内容
    
    def test_extract_json_empty(self, ai_client):
        """测试 JSON 提取 - 空内容"""
        result = ai_client._extract_json("")
        assert result is None
        
        result = ai_client._extract_json(None)
        assert result is None


class TestAIClientAsync:
    """测试 AIClient 异步方法"""
    
    @pytest.fixture
    def mock_settings(self):
        """创建模拟的设置对象"""
        settings = Mock()
        settings.get_ai_api_key.return_value = "test-api-key"
        settings.get_ai_base_url.return_value = "https://test.api.com"
        settings.vision_model = "glm-4.6v"
        settings.simple_vision_model = "glm-4.6v-flash"
        settings.text_model = "glm-4.7"
        settings.simple_text_model = "glm-4.7-flash"
        settings.smart_model = "glm-4.7"
        settings.embedding_model = "embedding-3"
        return settings
    
    @pytest.fixture
    def ai_client_with_mock(self, mock_settings):
        """创建带模拟的 AI 客户端"""
        with patch('app.services.ai_client.settings', mock_settings):
            from app.services.ai_client import AIClient
            client = AIClient()
            
            # 模拟 OpenAI 客户端
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = '{"test": "response"}'
            mock_response.usage.prompt_tokens = 100
            mock_response.usage.completion_tokens = 50
            mock_response.usage.total_tokens = 150
            
            client.client.chat.completions.create = AsyncMock(return_value=mock_response)
            
            yield client
    
    @pytest.mark.asyncio
    async def test_chat_completion_success(self, ai_client_with_mock):
        """测试聊天补全成功"""
        with patch('app.services.ai_client.record_usage'):
            result = await ai_client_with_mock.chat_completion(
                messages=[{"role": "user", "content": "Hello"}],
                task_type="test"
            )
            
            assert "content" in result
            assert result["model"] is not None
    
    @pytest.mark.asyncio
    async def test_chat_completion_json_response(self, ai_client_with_mock):
        """测试聊天补全 JSON 响应"""
        with patch('app.services.ai_client.record_usage'):
            result = await ai_client_with_mock.chat_completion(
                messages=[{"role": "user", "content": "返回 JSON"}],
                task_type="test",
                json_response=True
            )
            
            assert isinstance(result["content"], dict)
    
    @pytest.mark.asyncio
    async def test_chat_completion_no_client(self):
        """测试无客户端时的错误"""
        mock_settings = Mock()
        mock_settings.get_ai_api_key.return_value = None
        mock_settings.get_ai_base_url.return_value = None
        mock_settings.vision_model = "glm-4.6v"
        mock_settings.simple_vision_model = "glm-4.6v-flash"
        mock_settings.text_model = "glm-4.7"
        mock_settings.simple_text_model = "glm-4.7-flash"
        mock_settings.smart_model = "glm-4.7"
        mock_settings.embedding_model = "embedding-3"
        
        with patch('app.services.ai_client.settings', mock_settings):
            from app.services.ai_client import AIClient, AIClientError
            client = AIClient()
            
            with pytest.raises(AIClientError) as exc_info:
                await client.chat_completion(
                    messages=[{"role": "user", "content": "Hello"}],
                    task_type="test"
                )
            
            assert "未配置" in str(exc_info.value)
