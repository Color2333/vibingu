"""
数据提取器 - Phase 2
根据图片类型提取结构化数据
"""

import json
import re
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()


class DataExtractor:
    """根据图片类型提取结构化数据"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
    
    async def extract(
        self,
        image_type: str,
        image_base64: Optional[str] = None,
        text: Optional[str] = None,
        content_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        根据图片类型提取数据
        
        Args:
            image_type: 图片类型 (screenshot/food/activity_screenshot/etc)
            image_base64: Base64 编码的图片
            text: 用户输入的文本
            content_hint: 图片内容提示
            
        Returns:
            {
                "category": str,
                "meta_data": dict,
                "reply_text": str
            }
        """
        if not self.client:
            return self._mock_extract(image_type, text, content_hint)
        
        try:
            if image_type == "screenshot":
                return await self._extract_screen_time(image_base64, text)
            elif image_type == "activity_screenshot":
                return await self._extract_activity_data(image_base64, text)
            elif image_type == "food":
                return await self._extract_food_data(image_base64, text)
            elif image_type in ["activity_photo", "scenery", "selfie"]:
                return await self._extract_general(image_base64, text, image_type)
            else:
                return await self._extract_general(image_base64, text, image_type)
        except Exception as e:
            print(f"数据提取错误: {e}")
            return self._mock_extract(image_type, text, content_hint)
    
    async def _extract_screen_time(self, image_base64: Optional[str], text: Optional[str]) -> Dict[str, Any]:
        """提取屏幕时间数据"""
        
        system_prompt = """你是一个 OCR 数据提取专家。这是一张手机屏幕时间截图。
请仔细识别并提取以下数据（如果可见）：

1. 总屏幕使用时间
2. 各 App 使用时长（前5个）
3. 拿起手机次数
4. 首次拿起时间

请以 JSON 格式输出：
{
    "total_screen_time": "5小时32分",
    "total_minutes": 332,
    "top_apps": [
        {"name": "微信", "time": "2小时15分", "minutes": 135},
        {"name": "Safari", "time": "1小时20分", "minutes": 80}
    ],
    "pickups": 45,
    "first_pickup": "07:23",
    "reply_text": "今天屏幕时间X小时，比昨天多/少X%"
}

注意：只提取可见数据，不要猜测不存在的数据。如果某项不可见，设为 null。"""

        return await self._call_ai(system_prompt, image_base64, text, "SCREEN")
    
    async def _extract_activity_data(self, image_base64: Optional[str], text: Optional[str]) -> Dict[str, Any]:
        """提取运动数据"""
        
        system_prompt = """你是一个运动数据提取专家。这是一张运动 App 截图。
请识别并提取以下数据：

1. 运动类型（跑步/骑行/游泳/健身等）
2. 运动时长
3. 距离（如适用）
4. 消耗热量
5. 配速/速度（如适用）
6. 心率数据（如适用）

请以 JSON 格式输出：
{
    "activity_type": "running",
    "duration_minutes": 45,
    "distance_km": 5.2,
    "calories_burned": 420,
    "pace": "5'30''/km",
    "avg_heart_rate": 145,
    "source": "screenshot",
    "reply_text": "跑了5.2公里，配速不错！"
}"""

        return await self._call_ai(system_prompt, image_base64, text, "ACTIVITY")
    
    async def _extract_food_data(self, image_base64: Optional[str], text: Optional[str]) -> Dict[str, Any]:
        """提取食物数据"""
        
        system_prompt = """你是一个营养学专家。请分析这张美食照片。

识别并估算：
1. 食物名称和份量
2. 估计热量
3. 餐次类型（早餐/午餐/晚餐/加餐）
4. 健康评估
5. 营养标签

请以 JSON 格式输出：
{
    "food_items": [
        {"name": "牛排", "portion": "200g", "calories": 500},
        {"name": "沙拉", "portion": "100g", "calories": 50}
    ],
    "total_calories": 550,
    "meal_type": "dinner",
    "is_healthy": true,
    "tags": ["高蛋白", "低碳水"],
    "reply_text": "这顿约550卡，蛋白质充足，很健康！"
}"""

        return await self._call_ai(system_prompt, image_base64, text, "DIET")
    
    async def _extract_general(
        self, 
        image_base64: Optional[str], 
        text: Optional[str],
        image_type: str
    ) -> Dict[str, Any]:
        """通用数据提取"""
        
        category_map = {
            "activity_photo": "ACTIVITY",
            "scenery": "MOOD",
            "selfie": "MOOD",
            "other": "MOOD",
        }
        
        system_prompt = f"""你是 Vibing u 的生活记录助手。请分析这张{image_type}照片。

简要描述照片内容，并给出一句友好的回复。

请以 JSON 格式输出：
{{
    "description": "照片内容描述",
    "mood": "happy/neutral/tired/etc",
    "tags": ["标签1", "标签2"],
    "reply_text": "一句简短的回复"
}}"""

        result = await self._call_ai(system_prompt, image_base64, text, category_map.get(image_type, "MOOD"))
        return result
    
    async def _call_ai(
        self, 
        system_prompt: str, 
        image_base64: Optional[str], 
        text: Optional[str],
        category: str
    ) -> Dict[str, Any]:
        """调用 AI 接口"""
        
        user_content = []
        
        if text:
            user_content.append({"type": "text", "text": f"用户说明: {text}"})
        
        if image_base64:
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}",
                    "detail": "high"  # 数据提取需要高分辨率
                }
            })
        else:
            user_content.append({"type": "text", "text": "请根据用户说明分析。"})
        
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        
        result = json.loads(response.choices[0].message.content)
        
        return {
            "category": category,
            "meta_data": {k: v for k, v in result.items() if k != "reply_text"},
            "reply_text": result.get("reply_text", "已记录"),
        }
    
    def _mock_extract(
        self, 
        image_type: str, 
        text: Optional[str],
        content_hint: Optional[str]
    ) -> Dict[str, Any]:
        """模拟数据提取"""
        
        if image_type == "screenshot":
            return {
                "category": "SCREEN",
                "meta_data": {
                    "total_screen_time": "未知",
                    "note": content_hint or text or "屏幕时间截图",
                },
                "reply_text": "截图已记录。配置 OpenAI API Key 可自动识别屏幕时间。",
            }
        elif image_type == "food":
            return {
                "category": "DIET",
                "meta_data": {
                    "note": content_hint or text or "美食照片",
                },
                "reply_text": "美食已记录！配置 API Key 可自动识别热量。",
            }
        elif image_type in ["activity_screenshot", "activity_photo"]:
            return {
                "category": "ACTIVITY",
                "meta_data": {
                    "note": content_hint or text or "运动记录",
                },
                "reply_text": "运动记录已保存！",
            }
        else:
            return {
                "category": "MOOD",
                "meta_data": {
                    "note": content_hint or text or "记录",
                },
                "reply_text": "已记录。",
            }
