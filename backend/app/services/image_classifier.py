"""
图片分类 Agent - Phase 1
智能判断图片类型和保存价值
"""

import json
import logging
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# 导入全局并发控制器
def _get_concurrency_limiter():
    """延迟导入并发控制器，避免循环导入"""
    from app.services.ai_client import _concurrency_limiter
    return _concurrency_limiter


class ImageClassifier:
    """图片分类器 - 判断图片类型和是否值得保存"""
    
    # 图片类型定义
    IMAGE_TYPES = {
        "screenshot": {"save": False, "desc": "屏幕截图"},
        "sleep_screenshot": {"save": False, "desc": "睡眠数据截图"},
        "food": {"save": True, "desc": "美食照片"},
        "activity_screenshot": {"save": False, "desc": "运动数据截图"},
        "activity_photo": {"save": True, "desc": "户外运动照片"},
        "scenery": {"save": True, "desc": "风景照片"},
        "selfie": {"save": True, "desc": "自拍"},
        "other": {"save": False, "desc": "其他"},
    }
    
    def __init__(self):
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        self.vision_model = settings.simple_vision_model  # 图片分类是简单任务，用免费模型
    
    async def classify(self, image_base64: str, text_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        分类图片
        
        Args:
            image_base64: Base64 编码的图片
            text_hint: 用户提供的文字提示
            
        Returns:
            {
                "image_type": str,
                "should_save_image": bool,
                "save_reason": str | None,
                "content_hint": str,
                "confidence": float,
                "category_suggestion": str  # SLEEP/DIET/SCREEN/ACTIVITY/MOOD
            }
        """
        if not self.client:
            return self._mock_classify(text_hint)
        
        try:
            return await self._ai_classify(image_base64, text_hint)
        except Exception as e:
            logger.error(f"图片分类错误: {e}")
            return self._mock_classify(text_hint)
    
    async def _ai_classify(self, image_base64: str, text_hint: Optional[str]) -> Dict[str, Any]:
        """使用 AI 进行图片分类（带速率限制和重试）"""
        
        system_prompt = """你是一个图片分类专家。请分析用户上传的图片，判断：

1. **图片类型** (image_type)：
   - screenshot: 一般屏幕截图（如屏幕时间、App 使用统计等）
   - sleep_screenshot: 睡眠数据截图（如 iPhone 健康 App 睡眠记录、Sleep Cycle 等睡眠 App 截图）
   - food: 美食照片（实拍的食物、餐厅、饮品等）
   - activity_screenshot: 运动数据截图（如跑步 App 截图、健身记录截图）
   - activity_photo: 户外运动实拍照片（如跑步途中风景、健身房自拍）
   - scenery: 风景照片
   - selfie: 自拍
   - other: 其他类型

2. **是否值得保存原图** (should_save_image)：
   - 截图类（screenshot, sleep_screenshot, activity_screenshot）→ false（数据提取后不需要原图）
   - 实拍照片（food, activity_photo, scenery, selfie）→ true（有纪念价值）
   - 其他 → false

3. **内容描述** (content_hint)：简要描述图片内容

4. **推荐分类** (category_suggestion)：
   - SLEEP: 睡眠相关（包括睡眠截图、睡眠记录等）
   - DIET: 饮食相关
   - SCREEN: 屏幕时间相关
   - ACTIVITY: 运动活动相关
   - MOOD: 情绪/其他

请以 JSON 格式输出：
{
    "image_type": "screenshot|sleep_screenshot|food|activity_screenshot|activity_photo|scenery|selfie|other",
    "should_save_image": true|false,
    "save_reason": "原因说明（如果保存）",
    "content_hint": "图片内容简述",
    "confidence": 0.0-1.0,
    "category_suggestion": "SLEEP|DIET|SCREEN|ACTIVITY|MOOD"
}"""

        user_content = []
        
        if text_hint:
            user_content.append({"type": "text", "text": f"用户说明: {text_hint}\n请分析这张图片："})
        else:
            user_content.append({"type": "text", "text": "请分析这张图片："})
        
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_base64}",
                "detail": "low"  # 分类只需要低分辨率
            }
        })
        
        # 获取并发控制器
        limiter = _get_concurrency_limiter()
        
        # 获取并发许可，flash 繁忙时自动升级到付费模型
        acquired, actual_model = await limiter.acquire_with_upgrade(self.vision_model, timeout=60.0)
        if not acquired:
            raise Exception(f"模型 {self.vision_model} 并发已满，等待超时")
        
        try:
            response = await self.client.chat.completions.create(
                model=actual_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=1600,
            )
            
            # 提取 JSON（AI 可能返回 markdown 代码块或额外文本）
            content = response.choices[0].message.content
            from app.services.json_utils import extract_json
            result = extract_json(content, actual_model)
            
            return {
                "image_type": result.get("image_type", "other"),
                "should_save_image": result.get("should_save_image", False),
                "save_reason": result.get("save_reason"),
                "content_hint": result.get("content_hint", ""),
                "confidence": result.get("confidence", 0.5),
                "category_suggestion": result.get("category_suggestion", "MOOD"),
            }
        finally:
            # 释放实际使用的模型的并发许可
            limiter.release(actual_model)
    
    def _mock_classify(self, text_hint: Optional[str] = None) -> Dict[str, Any]:
        """模拟分类（无 API Key 时使用）"""
        
        # 根据文字提示猜测类型
        image_type = "other"
        category = "MOOD"
        should_save = False
        
        if text_hint:
            hint_lower = text_hint.lower()
            if any(w in hint_lower for w in ["睡眠", "sleep", "睡觉", "起床", "入睡", "wake"]):
                image_type = "sleep_screenshot"
                category = "SLEEP"
                should_save = False
            elif any(w in hint_lower for w in ["屏幕", "screen", "使用时间", "app"]):
                image_type = "screenshot"
                category = "SCREEN"
                should_save = False
            elif any(w in hint_lower for w in ["吃", "喝", "美食", "food", "餐", "咖啡"]):
                image_type = "food"
                category = "DIET"
                should_save = True
            elif any(w in hint_lower for w in ["运动", "跑步", "健身", "run"]):
                image_type = "activity_screenshot"
                category = "ACTIVITY"
                should_save = False
        
        return {
            "image_type": image_type,
            "should_save_image": should_save,
            "save_reason": "美食照片有纪念价值" if should_save else None,
            "content_hint": text_hint or "图片",
            "confidence": 0.5,
            "category_suggestion": category,
        }
