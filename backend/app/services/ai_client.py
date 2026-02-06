"""统一的 AI 客户端服务

提供:
1. 统一的 AI 调用接口
2. 自动重试机制
3. 模型降级策略
4. Token 用量追踪
5. 错误处理和日志
6. 按模型并发控制（基于智谱 AI 并发数限制）
"""
import asyncio
import json
import httpx
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from functools import wraps

from openai import AsyncOpenAI
from app.config import get_settings
from app.services.token_tracker import record_usage

logger = logging.getLogger(__name__)
settings = get_settings()


class ModelConcurrencyLimiter:
    """按模型的并发控制器
    
    基于智谱 AI 的并发数（在途请求数）限制，
    为每个模型维护一个 asyncio.Semaphore，确保不超过并发上限。
    当 flash 模型繁忙时，自动升级到并发更高的付费模型。
    """
    
    # 智谱 AI 各模型并发数限制
    MODEL_LIMITS: Dict[str, int] = {
        # 视觉模型
        "glm-4.6v": 10,
        "glm-4.6v-flash": 1,
        "glm-4.6v-flashx": 3,
        # 文本模型
        "glm-4.7": 3,
        "glm-4.7-flash": 1,
        "glm-4.7-flashx": 3,
        # 其他常用
        "glm-4.5": 10,
        "glm-4-flash": 200,
        "glm-4-air": 100,
        "embedding-3": 50,
    }
    DEFAULT_LIMIT = 3
    
    # 繁忙时自动升级：flash(免费/低并发) → 付费(高并发)
    UPGRADE_MAP: Dict[str, str] = {
        "glm-4.6v-flash": "glm-4.6v",     # 1 → 10
        "glm-4.7-flash": "glm-4.7",       # 1 → 3
    }
    
    def __init__(self):
        self._semaphores: Dict[str, asyncio.Semaphore] = {}
        self._lock = asyncio.Lock()
    
    async def _get_semaphore(self, model: str) -> asyncio.Semaphore:
        """获取或创建模型对应的信号量"""
        async with self._lock:
            if model not in self._semaphores:
                model_lower = model.lower()
                limit = self.MODEL_LIMITS.get(model_lower, self.DEFAULT_LIMIT)
                self._semaphores[model] = asyncio.Semaphore(limit)
                logger.debug(f"[并发控制] 模型 {model} 并发上限: {limit}")
            return self._semaphores[model]
    
    async def acquire(self, model: str, timeout: float = 90.0) -> bool:
        """获取并发许可（阻塞等待直到有空位）
        
        Args:
            model: 模型名称
            timeout: 最大等待时间（秒）
            
        Returns:
            是否成功获取许可
        """
        sem = await self._get_semaphore(model)
        try:
            await asyncio.wait_for(sem.acquire(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning(f"[并发控制] 模型 {model} 等待超时 ({timeout}s)")
            return False
    
    async def acquire_with_upgrade(self, model: str, timeout: float = 90.0):
        """尝试获取并发许可，flash 模型繁忙时自动升级到付费模型
        
        Returns:
            (是否成功, 实际使用的模型名)
        """
        sem = await self._get_semaphore(model)
        
        # 先用短超时尝试原模型（1秒）
        try:
            await asyncio.wait_for(sem.acquire(), timeout=1.0)
            return True, model
        except asyncio.TimeoutError:
            pass
        
        # 原模型繁忙，尝试升级
        upgrade = self.UPGRADE_MAP.get(model.lower())
        if upgrade:
            logger.info(f"[并发控制] {model} 繁忙，升级到 {upgrade}")
            acquired = await self.acquire(upgrade, timeout=timeout)
            if acquired:
                return True, upgrade
        
        # 升级也不行，回退继续等原模型
        acquired = await self.acquire(model, timeout=timeout)
        return acquired, model
    
    def release(self, model: str):
        """释放并发许可"""
        if model in self._semaphores:
            self._semaphores[model].release()


# 全局并发控制器实例
_concurrency_limiter = ModelConcurrencyLimiter()


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
            timeout=httpx.Timeout(120.0)
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
        """带并发控制、自动升级、重试和降级的执行
        
        - 并发信号量确保不超过智谱 AI 的并发数限制
        - flash 模型繁忙时自动升级到付费模型（并发更高）
        - 失败后指数退避重试，多次失败后降级
        """
        last_error = None
        total_attempts = 0
        max_total_attempts = self.max_retries + 2
        has_fallen_back = False
        requested_model = model
        
        while total_attempts < max_total_attempts:
            # 获取并发许可，flash 繁忙时自动升级
            acquired, actual_model = await _concurrency_limiter.acquire_with_upgrade(
                requested_model, timeout=90.0
            )
            if not acquired:
                raise AIClientError(
                    message=f"模型 {requested_model} 并发已满，等待超时",
                    error_code="CONCURRENCY_LIMIT",
                    retryable=True
                )
            
            try:
                result = await func(model=actual_model, **kwargs)
                return result
            
            except Exception as e:
                last_error = e
                total_attempts += 1
                logger.warning(f"AI 调用失败 (尝试 {total_attempts}/{max_total_attempts}, 模型 {actual_model}): {e}")
                
                if not self._is_retryable_error(e):
                    raise AIClientError(
                        message=str(e),
                        error_code="UNRETRYABLE",
                        retryable=False
                    )
                
                # 计算延迟（指数退避，429 错误等更久）
                is_rate_limit = "429" in str(e) or "1302" in str(e)
                base = 5.0 if is_rate_limit else self.base_delay
                delay = min(
                    base * (2 ** (total_attempts - 1)),
                    self.max_delay
                )
                
                # 多次失败后尝试降级到 flash 模型
                if total_attempts >= 2 and allow_fallback and not has_fallen_back:
                    fallback = self._get_fallback_model(requested_model)
                    if fallback and fallback != requested_model:
                        logger.info(f"降级到模型: {fallback}")
                        requested_model = fallback
                        has_fallen_back = True
                        continue
                
                if total_attempts >= max_total_attempts:
                    break
                    
                logger.info(f"等待 {delay:.1f} 秒后重试...")
                await asyncio.sleep(delay)
            
            finally:
                # 释放实际使用的模型的并发许可
                _concurrency_limiter.release(actual_model)
        
        raise AIClientError(
            message=f"AI 调用失败，已重试 {total_attempts} 次: {last_error}",
            error_code="MAX_RETRIES_EXCEEDED",
            retryable=False
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 4000,
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
                logger.warning(f"Token 记录失败: {e}")
        
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
        max_tokens: int = 4000,
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
                logger.warning(f"Token 记录失败: {e}")
        
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
                logger.warning(f"Token 记录失败: {e}")
        
        return response.data[0].embedding
    
    def _extract_json(self, content: str) -> Any:
        """从内容中提取 JSON（使用共享的健壮解析器）"""
        if not content:
            return None
        
        from app.services.json_utils import safe_extract_json
        result = safe_extract_json(content, model_name="ai_client", fallback=None)
        # 如果解析失败，返回原始内容（保持向后兼容）
        return result if result is not None else content


# 全局单例
_ai_client: Optional[AIClient] = None


def get_ai_client() -> AIClient:
    """获取 AI 客户端单例"""
    global _ai_client
    if _ai_client is None:
        _ai_client = AIClient()
    return _ai_client
