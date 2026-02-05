"""
数据提取器 - 增强版
根据图片类型提取结构化数据 + 深度分析 + 智能建议
"""

import json
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()


class DataExtractor:
    """根据图片类型提取结构化数据 + AI 深度分析"""
    
    def __init__(self):
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        self.vision_model = settings.vision_model   # 有图像时用视觉模型
        self.text_model = settings.text_model       # 纯文本用便宜模型
    
    def _get_current_time(self, client_time: Optional[str] = None) -> str:
        """获取当前时间字符串"""
        if client_time:
            try:
                dt = datetime.fromisoformat(client_time.replace('Z', '+00:00'))
                return dt.strftime("%Y年%m月%d日 %H:%M")
            except:
                pass
        return datetime.now().strftime("%Y年%m月%d日 %H:%M")
    
    def _get_time_period(self, client_time: Optional[str] = None) -> str:
        """获取时间段描述"""
        if client_time:
            try:
                dt = datetime.fromisoformat(client_time.replace('Z', '+00:00'))
                hour = dt.hour
            except:
                hour = datetime.now().hour
        else:
            hour = datetime.now().hour
        
        if 5 <= hour < 9:
            return "早晨"
        elif 9 <= hour < 12:
            return "上午"
        elif 12 <= hour < 14:
            return "中午"
        elif 14 <= hour < 18:
            return "下午"
        elif 18 <= hour < 22:
            return "晚上"
        else:
            return "深夜"
    
    async def extract(
        self,
        image_type: str,
        image_base64: Optional[str] = None,
        text: Optional[str] = None,
        content_hint: Optional[str] = None,
        client_time: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        根据图片类型提取数据 + 深度分析
        
        Returns:
            {
                "category": str,
                "meta_data": dict (包含 analysis, suggestions, trend 等),
                "reply_text": str
            }
        """
        if not self.client:
            return self._mock_extract(image_type, text, content_hint, client_time)
        
        try:
            # 纯文本输入
            if not image_base64:
                return await self._extract_text_only(text, client_time)
            
            # 有图片的情况
            if image_type == "screenshot":
                return await self._extract_screen_time(image_base64, text, client_time)
            elif image_type == "activity_screenshot":
                return await self._extract_activity_data(image_base64, text, client_time)
            elif image_type == "food":
                return await self._extract_food_data(image_base64, text, client_time)
            elif image_type in ["sleep_screenshot"]:
                return await self._extract_sleep_data(image_base64, text, client_time)
            elif image_type in ["activity_photo", "scenery", "selfie"]:
                return await self._extract_general(image_base64, text, image_type, client_time)
            else:
                return await self._extract_general(image_base64, text, image_type, client_time)
        except Exception as e:
            print(f"数据提取错误: {e}")
            import traceback
            traceback.print_exc()
            return self._mock_extract(image_type, text, content_hint, client_time)
    
    async def _extract_text_only(self, text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """纯文本输入的智能解析 + 分析"""
        
        current_time = self._get_current_time(client_time)
        time_period = self._get_time_period(client_time)
        
        system_prompt = f"""你是 Vibing u 的生活记录助手，擅长从只言片语中洞察用户状态。
当前时间：{current_time}（{time_period}）

【重要】本次输入仅有文字，没有图片。请深度分析用户输入。

你的任务：
1. 判断分类
2. 提取结构化数据
3. **深度分析**：挖掘文字背后的情绪、状态、可能的原因
4. **给出建议**：基于分析，给出1-2条具体可行的建议

分类选项：
- SLEEP: 睡眠相关
- DIET: 饮食相关
- ACTIVITY: 运动相关
- MOOD: 情绪心情
- SOCIAL: 社交相关
- WORK: 工作学习
- GROWTH: 成长相关
- LEISURE: 休闲娱乐
- SCREEN: 屏幕时间

请以 JSON 格式输出：
{{
    "category": "分类",
    "mood": "happy/neutral/sad/tired/anxious/excited/calm/etc",
    "note": "简短描述",
    "analysis": "深度分析（50-100字）：分析用户当前状态、可能的情绪原因、与时间/场景的关联等",
    "suggestions": ["建议1（具体可行）", "建议2（如有必要）"],
    "trend": "up/down/stable（情绪/状态趋势判断）",
    "tags": ["标签1", "标签2", "标签3"],
    "reply_text": "一句温暖简短的回复（不要说'照片'或'图片'）"
}}"""

        return await self._call_ai(system_prompt, None, text, "MOOD")
    
    async def _extract_sleep_data(self, image_base64: Optional[str], text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """提取睡眠数据 + 睡眠分析"""
        
        current_time = self._get_current_time(client_time)
        
        system_prompt = f"""你是一个睡眠健康专家。当前时间：{current_time}
这是一张睡眠记录截图（iPhone 健康 App / Sleep Cycle 等）。

请仔细识别并：
1. **提取数据**：入睡时间、起床时间、时长、质量分数、深睡/浅睡/REM
2. **深度分析**：评估睡眠质量，分析可能影响因素（时间、时长、深睡比例等）
3. **给出建议**：基于数据给出改善建议

请以 JSON 格式输出：
{{
    "sleep_time": "23:30",
    "wake_time": "07:15", 
    "duration_hours": 7.75,
    "quality": "good/fair/poor",
    "score": 85,
    "deep_sleep_hours": 2.5,
    "rem_hours": 1.5,
    "light_sleep_hours": 3.75,
    "analysis": "深度分析（50-100字）：评估睡眠质量，深睡占比是否达标，入睡时间是否健康等",
    "suggestions": ["具体建议1", "具体建议2"],
    "trend": "up/down/stable",
    "tags": ["睡眠", "健康"],
    "reply_text": "简短回复"
}}

注意：只提取可见数据，不可见的设为 null。深度分析和建议基于可见数据给出。"""

        return await self._call_ai(system_prompt, image_base64, text, "SLEEP")
    
    async def _extract_screen_time(self, image_base64: Optional[str], text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """提取屏幕时间数据 + App 排行 + 深度分析"""
        
        current_time = self._get_current_time(client_time)
        
        system_prompt = f"""你是一个数字健康专家和 OCR 数据提取专家。当前时间：{current_time}
这是一张手机屏幕时间截图。

请仔细识别并：
1. **提取数据**：
   - 总屏幕时间
   - 各 App 使用时长（尽可能识别前5-10个 App 的名称和时长）
   - 拿起手机次数
   - 首次拿起时间
   
2. **深度分析**：
   - 屏幕时间是否过长？（建议每日<4小时）
   - 哪些 App 占用最多？是社交/娱乐/效率类？
   - 使用模式是否健康？
   
3. **给出建议**：基于 App 使用情况给出具体建议

请以 JSON 格式输出：
{{
    "total_screen_time": "5小时32分",
    "total_minutes": 332,
    "top_apps": [
        {{"name": "微信", "time": "2小时15分", "minutes": 135, "type": "social"}},
        {{"name": "抖音", "time": "1小时20分", "minutes": 80, "type": "entertainment"}},
        {{"name": "Safari", "time": "45分钟", "minutes": 45, "type": "productivity"}},
        {{"name": "小红书", "time": "30分钟", "minutes": 30, "type": "social"}},
        {{"name": "哔哩哔哩", "time": "25分钟", "minutes": 25, "type": "entertainment"}}
    ],
    "app_breakdown": {{
        "social": 165,
        "entertainment": 105,
        "productivity": 45,
        "other": 17
    }},
    "pickups": 45,
    "first_pickup": "07:23",
    "analysis": "深度分析（80-120字）：分析屏幕使用是否过度，社交/娱乐 App 占比，是否影响效率和健康，与拿起次数的关联等",
    "suggestions": ["具体建议1（如限制某App）", "具体建议2（如设置屏幕时间）"],
    "trend": "up/down/stable",
    "health_score": 60,
    "tags": ["屏幕时间", "数字健康"],
    "reply_text": "简短回复，点出关键问题或肯定"
}}

注意：
1. **务必识别所有可见的 App 名称和时长**，这是最重要的数据
2. 如果某项不可见，设为 null
3. 分析要具体，建议要可行"""

        return await self._call_ai(system_prompt, image_base64, text, "SCREEN")
    
    async def _extract_activity_data(self, image_base64: Optional[str], text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """提取运动数据 + 分析"""
        
        current_time = self._get_current_time(client_time)
        
        system_prompt = f"""你是一个运动健康专家。当前时间：{current_time}
这是一张运动 App 截图。

请识别并：
1. **提取数据**：运动类型、时长、距离、热量、配速、心率等
2. **深度分析**：评估运动效果，是否达到有氧/燃脂心率，强度是否合适
3. **给出建议**：基于数据给出改进建议

请以 JSON 格式输出：
{{
    "activity_type": "running/cycling/swimming/gym/etc",
    "duration_minutes": 45,
    "distance_km": 5.2,
    "calories_burned": 420,
    "pace": "5'30''/km",
    "avg_heart_rate": 145,
    "max_heart_rate": 168,
    "analysis": "深度分析（50-100字）：评估运动强度、心率区间、是否达到训练效果等",
    "suggestions": ["具体建议1", "具体建议2"],
    "trend": "up/down/stable",
    "tags": ["运动", "健身"],
    "reply_text": "简短鼓励"
}}"""

        return await self._call_ai(system_prompt, image_base64, text, "ACTIVITY")
    
    async def _extract_food_data(self, image_base64: Optional[str], text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """提取食物数据 + 营养分析"""
        
        current_time = self._get_current_time(client_time)
        time_period = self._get_time_period(client_time)
        
        meal_hint = {
            "早晨": "早餐",
            "上午": "早餐或加餐",
            "中午": "午餐",
            "下午": "下午茶或加餐",
            "晚上": "晚餐",
            "深夜": "夜宵",
        }.get(time_period, "正餐")
        
        system_prompt = f"""你是一个营养学专家。当前时间：{current_time}（{time_period}，可能是{meal_hint}）

请分析这张美食照片，并：
1. **提取数据**：识别食物、估算份量和热量
2. **营养分析**：评估营养均衡性、是否健康
3. **给出建议**：基于这餐给出饮食建议

请以 JSON 格式输出：
{{
    "food_items": [
        {{"name": "牛排", "portion": "200g", "calories": 500}},
        {{"name": "沙拉", "portion": "100g", "calories": 50}}
    ],
    "total_calories": 550,
    "meal_type": "breakfast/lunch/dinner/snack",
    "is_healthy": true,
    "nutrition_balance": {{
        "protein": "high/medium/low",
        "carbs": "high/medium/low",
        "fat": "high/medium/low",
        "fiber": "high/medium/low"
    }},
    "analysis": "营养分析（50-100字）：评估这餐的营养均衡性、热量是否合适、搭配是否健康等",
    "suggestions": ["具体建议1", "具体建议2"],
    "tags": ["饮食", "美食"],
    "reply_text": "简短评价这餐"
}}"""

        return await self._call_ai(system_prompt, image_base64, text, "DIET")
    
    async def _extract_general(
        self, 
        image_base64: Optional[str], 
        text: Optional[str],
        image_type: str,
        client_time: Optional[str]
    ) -> Dict[str, Any]:
        """通用数据提取 + 分析"""
        
        current_time = self._get_current_time(client_time)
        time_period = self._get_time_period(client_time)
        
        category_map = {
            "activity_photo": "ACTIVITY",
            "scenery": "MOOD",
            "selfie": "MOOD",
            "other": "MOOD",
        }
        
        image_type_zh = {
            "activity_photo": "运动",
            "scenery": "风景",
            "selfie": "自拍",
            "other": "生活",
        }.get(image_type, "生活")
        
        system_prompt = f"""你是 Vibing u 的生活记录助手，擅长从照片中洞察用户状态。
当前时间：{current_time}（{time_period}）

请分析这张{image_type_zh}照片，并：
1. 描述照片内容
2. 推测用户当时的情绪和状态
3. 给出一句温暖的回复

请以 JSON 格式输出：
{{
    "description": "照片内容描述",
    "mood": "happy/neutral/tired/excited/calm/etc",
    "analysis": "深度分析（30-50字）：从照片推测用户状态、情绪、可能在做什么",
    "suggestions": ["如有需要的建议"],
    "tags": ["标签1", "标签2"],
    "reply_text": "一句温暖的回复"
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
                    "detail": "high"
                }
            })
        elif not text:
            user_content.append({"type": "text", "text": "请分析。"})
        
        # 根据是否有图像选择模型
        model = self.vision_model if image_base64 else self.text_model
        
        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=1500,  # 增加 token 限制以容纳分析
            response_format={"type": "json_object"},
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # 确保 analysis 和 suggestions 存在
        meta_data = {k: v for k, v in result.items() if k != "reply_text"}
        if "analysis" not in meta_data:
            meta_data["analysis"] = None
        if "suggestions" not in meta_data:
            meta_data["suggestions"] = []
        
        return {
            "category": category,
            "meta_data": meta_data,
            "reply_text": result.get("reply_text", "已记录"),
        }
    
    def _mock_extract(
        self, 
        image_type: str, 
        text: Optional[str],
        content_hint: Optional[str],
        client_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """模拟数据提取（无 API 时）"""
        
        time_period = self._get_time_period(client_time)
        
        if image_type == "screenshot":
            return {
                "category": "SCREEN",
                "meta_data": {
                    "total_screen_time": "未知",
                    "note": content_hint or text or "屏幕时间截图",
                    "analysis": "请配置 AI API Key 以获取详细分析",
                    "suggestions": ["配置 API Key 可自动识别 App 使用时间"],
                    "top_apps": [],
                },
                "reply_text": "截图已记录。配置 AI API Key 可自动识别屏幕时间和 App 排行。",
            }
        elif image_type == "food":
            return {
                "category": "DIET",
                "meta_data": {
                    "note": content_hint or text or "美食照片",
                    "analysis": "请配置 AI API Key 以获取营养分析",
                    "suggestions": [],
                },
                "reply_text": "美食已记录！配置 API Key 可自动识别热量和营养成分。",
            }
        elif image_type in ["activity_screenshot", "activity_photo"]:
            return {
                "category": "ACTIVITY",
                "meta_data": {
                    "note": content_hint or text or "运动记录",
                    "analysis": "请配置 AI API Key 以获取运动分析",
                    "suggestions": [],
                },
                "reply_text": "运动记录已保存！",
            }
        elif image_type == "sleep_screenshot":
            return {
                "category": "SLEEP",
                "meta_data": {
                    "note": content_hint or text or "睡眠记录",
                    "analysis": "请配置 AI API Key 以获取睡眠分析",
                    "suggestions": [],
                },
                "reply_text": "睡眠数据已记录！配置 API Key 可自动识别和分析。",
            }
        else:
            # 纯文本或其他
            return {
                "category": "MOOD",
                "meta_data": {
                    "note": text or content_hint or "记录",
                    "analysis": None,
                    "suggestions": [],
                },
                "reply_text": f"已记录。{time_period}好！",
            }
