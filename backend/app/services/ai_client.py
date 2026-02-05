"""统一的 AI 客户端服务

提供:
1. 统一的 AI 调用接口
2. 自动重试机制
3. 模型降级策略
4. Token 用量追踪
5. 错误处理和日志
"""
import asyncio
import json
import httpx
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from functools import wraps

from openai import AsyncOpenAI
from app.config import get_settings
from app.services.token_tracker import record_usage

settings = get_settings()


class AIClientError(Exception):
    """AI 客户端错误"""
    def __init__(self, message: str, error_code: str = None, retryable: bool = False):
        self.message = message
        self.error_code = error_code
        self.retryable = retryable
        super().__init__(message)


class AIClient:
    """统一的 AI 客户端
    
    提供重试机制、模型降级和错误处理
    """
    
    def __init__(self):
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=httpx.Timeout(60.0)
        ) if api_key else None
        
        # 模型配置
        self.models = {
            "vision": settings.vision_model,           # glm-4.6v
            "vision_flash": settings.simple_vision_model,  # glm-4.6v-flash
            "text": settings.text_model,               # glm-4.7
            "text_flash": settings.simple_text_model,  # glm-4.7-flash
            "smart": settings.smart_model,             # glm-4.7
            "embedding": settings.embedding_model,     # embedding-3
        }
        
        # 重试配置
        self.max_retries = 3
        self.base_delay = 1.0  # 秒
        self.max_delay = 30.0
        
        # 可重试的错误码
        self.retryable_codes = {"429", "500", "502", "503", "504", "1302"}
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """判断错误是否可重试"""
        error_str = str(error)
        
        # 检查是否是速率限制错误
        if "429" in error_str or "1302" in error_str:
            return True
        
        # 检查是否是服务器错误
        for code in ["500", "502", "503", "504"]:
            if code in error_str:
                return True
        
        return False
    
    def _get_fallback_model(self, model: str) -> Optional[str]:
        """获取降级模型"""
        fallbacks = {
            self.models["vision"]: self.models["vision_flash"],
            self.models["text"]: self.models["text_flash"],
            self.models["smart"]: self.models["text_flash"],
        }
        return fallbacks.get(model)
    
    async def _execute_with_retry(
        self,
        func: Callable,
        model: str,
        task_type: str,
        task_description: str = None,
        allow_fallback: bool = True,
        **kwargs
    ) -> Any:
        """带重试和降级的执行"""
        current_model = model
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                result = await func(model=current_model, **kwargs)
                return result
            
            except Exception as e:
                last_error = e
                print(f"AI 调用失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                
                if not self._is_retryable_error(e):
                    # 不可重试的错误，直接抛出
                    raise AIClientError(
                        message=str(e),
                        error_code="UNRETRYABLE",
                        retryable=False
                    )
                
                # 计算延迟（指数退避）
                delay = min(
                    self.base_delay * (2 ** attempt),
                    self.max_delay
                )
                
                # 如果是最后一次重试，尝试降级
                if attempt == self.max_retries - 1 and allow_fallback:
                    fallback = self._get_fallback_model(current_model)
                    if fallback and fallback != current_model:
                        print(f"降级到模型: {fallback}")
                        current_model = fallback
                        attempt = 0  # 重置重试计数
                        continue
                
                print(f"等待 {delay:.1f} 秒后重试...")
                await asyncio.sleep(delay)
        
        raise AIClientError(
            message=f"AI 调用失败，已重试 {self.max_retries} 次: {last_error}",
            error_code="MAX_RETRIES_EXCEEDED",
            retryable=False
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        task_type: str = "chat",
        task_description: str = None,
        record_id: str = None,
        json_response: bool = False,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        """
        聊天补全接口
        
        Args:
            messages: 消息列表
            model: 模型名称 (默认使用 text_flash)
            max_tokens: 最大 token 数
            temperature: 温度参数
            task_type: 任务类型 (用于统计)
            task_description: 任务描述
            record_id: 关联的记录 ID
            json_response: 是否要求 JSON 响应
            allow_fallback: 是否允许降级
            
        Returns:
            包含 content 和 usage 的字典
        """
        if not self.client:
            raise AIClientError("AI 客户端未配置", "NO_CLIENT")
        
        model = model or self.models["text_flash"]
        
        async def _call(model: str, **kwargs):
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response
        
        response = await self._execute_with_retry(
            _call,
            model=model,
            task_type=task_type,
            task_description=task_description,
            allow_fallback=allow_fallback,
        )
        
        content = response.choices[0].message.content or ""
        
        # 记录 Token 使用
        if response.usage:
            try:
                record_usage(
                    model=model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    task_type=task_type,
                    task_description=task_description,
                    related_record_id=record_id
                )
            except Exception as e:
                print(f"Token 记录失败: {e}")
        
        # 处理 JSON 响应
        if json_response:
            content = self._extract_json(content)
        
        return {
            "content": content,
            "model": model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }
        }
    
    async def vision_completion(
        self,
        prompt: str,
        image_base64: str,
        model: str = None,
        max_tokens: int = 2000,
        task_type: str = "vision",
        task_description: str = None,
        record_id: str = None,
        json_response: bool = False,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        """
        视觉模型接口
        
        Args:
            prompt: 文本提示
            image_base64: Base64 编码的图片
            model: 模型名称 (默认使用 vision_flash)
            其他参数同 chat_completion
        """
        if not self.client:
            raise AIClientError("AI 客户端未配置", "NO_CLIENT")
        
        model = model or self.models["vision_flash"]
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
        
        async def _call(model: str, **kwargs):
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
            )
            return response
        
        response = await self._execute_with_retry(
            _call,
            model=model,
            task_type=task_type,
            task_description=task_description,
            allow_fallback=allow_fallback,
        )
        
        content = response.choices[0].message.content or ""
        
        # 记录 Token 使用
        if response.usage:
            try:
                record_usage(
                    model=model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    task_type=task_type,
                    task_description=task_description,
                    related_record_id=record_id
                )
            except Exception as e:
                print(f"Token 记录失败: {e}")
        
        # 处理 JSON 响应
        if json_response:
            content = self._extract_json(content)
        
        return {
            "content": content,
            "model": model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }
        }
    
    async def get_embedding(
        self,
        text: str,
        model: str = None,
        task_type: str = "embedding",
        record_id: str = None,
    ) -> List[float]:
        """
        获取文本嵌入向量
        
        Args:
            text: 输入文本
            model: 模型名称 (默认使用 embedding)
            
        Returns:
            嵌入向量
        """
        if not self.client:
            raise AIClientError("AI 客户端未配置", "NO_CLIENT")
        
        model = model or self.models["embedding"]
        
        async def _call(model: str, **kwargs):
            response = await self.client.embeddings.create(
                model=model,
                input=text,
            )
            return response
        
        response = await self._execute_with_retry(
            _call,
            model=model,
            task_type=task_type,
            allow_fallback=False,  # embedding 没有降级选项
        )
        
        # 记录 Token 使用
        if response.usage:
            try:
                record_usage(
                    model=model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=0,
                    task_type=task_type,
                    related_record_id=record_id
                )
            except Exception as e:
                print(f"Token 记录失败: {e}")
        
        return response.data[0].embedding
    
    def _extract_json(self, content: str) -> Any:
        """从内容中提取 JSON"""
        if not content:
            return None
        
        # 尝试直接解析
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # 尝试从 markdown 代码块提取
        if "```json" in content:
            try:
                json_str = content.split("```json")[1].split("```")[0].strip()
                return json.loads(json_str)
            except (IndexError, json.JSONDecodeError):
                pass
        
        if "```" in content:
            try:
                json_str = content.split("```")[1].split("```")[0].strip()
                return json.loads(json_str)
            except (IndexError, json.JSONDecodeError):
                pass
        
        # 返回原始内容
        return content


# 全局单例
_ai_client: Optional[AIClient] = None


def get_ai_client() -> AIClient:
    """获取 AI 客户端单例"""
    global _ai_client
    if _ai_client is None:
        _ai_client = AIClient()
    return _ai_client
