import json
from typing import Optional, Dict, Any
from datetime import datetime
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()


class AIParser:
    """AI 解析服务 - 使用 GPT-4o Vision 解析多模态输入"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
    
    async def parse(
        self,
        text: Optional[str] = None,
        image_base64: Optional[str] = None,
        category_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        解析用户输入，提取结构化数据
        
        Args:
            text: 文本输入
            image_base64: Base64 编码的图片
            category_hint: 分类提示
            
        Returns:
            包含 category, meta_data, reply_text 的字典
        """
        if not self.client:
            # 如果没有配置 API Key，返回模拟数据
            return self._mock_parse(text, image_base64, category_hint)
        
        try:
            return await self._openai_parse(text, image_base64, category_hint)
        except Exception as e:
            print(f"AI 解析错误: {e}")
            return self._mock_parse(text, image_base64, category_hint)
    
    async def _openai_parse(
        self,
        text: Optional[str],
        image_base64: Optional[str],
        category_hint: Optional[str],
    ) -> Dict[str, Any]:
        """使用 OpenAI GPT-4o Vision 进行解析"""
        
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        system_prompt = """你是 Vibing u 的首席分析师。你冷静、客观，但极具洞察力。
你的目标是通过数据帮助用户达到 "High Vibe" 状态。

你的任务是：
1. 从用户上传的信息（照片/文本）中提取结构化数据
2. 判断输入属于哪个分类
3. 用简短、犀利的语言给出建议

分类枚举：SLEEP（睡眠）, DIET（饮食）, SCREEN（屏幕时间）, ACTIVITY（活动）, MOOD（情绪）

请以 JSON 格式输出，包含以下字段：
- category: 分类（上述枚举之一）
- meta_data: 提取的详细数据（根据类型不同）
- reply_text: 给用户的一句话回复（中文，简短犀利）

示例输出格式：
{
    "category": "DIET",
    "meta_data": {
        "food_name": "冰美式",
        "caffeine_mg": 150,
        "calories": 5,
        "is_healthy": true,
        "tags": ["Focus", "Stimulant"]
    },
    "reply_text": "记下了。150mg 咖啡因，下午喝要注意别影响晚上睡眠哦。"
}"""

        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # 构建用户消息
        user_content = []
        
        prompt_text = f"当前时间: {current_time}\n"
        if category_hint:
            prompt_text += f"用户提示这是关于: {category_hint}\n"
        if text:
            prompt_text += f"用户输入: {text}\n"
        
        user_content.append({"type": "text", "text": prompt_text or "请分析这张图片"})
        
        if image_base64:
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}",
                    "detail": "auto"
                }
            })
        
        messages.append({"role": "user", "content": user_content})
        
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        
        result_text = response.choices[0].message.content
        return json.loads(result_text)
    
    def _mock_parse(
        self,
        text: Optional[str],
        image_base64: Optional[str],
        category_hint: Optional[str],
    ) -> Dict[str, Any]:
        """模拟解析（用于测试或 API Key 未配置时）"""
        
        # 根据输入推断分类
        category = "MOOD"
        meta_data = {}
        reply_text = "已记录。"
        
        if category_hint:
            category = category_hint.upper()
        elif text:
            text_lower = text.lower()
            if any(word in text_lower for word in ["睡", "起床", "醒", "sleep"]):
                category = "SLEEP"
                meta_data = {"note": text}
                reply_text = "睡眠记录已保存。"
            elif any(word in text_lower for word in ["吃", "喝", "咖啡", "奶茶", "饭"]):
                category = "DIET"
                meta_data = {"note": text}
                reply_text = "饮食记录已保存。"
            elif any(word in text_lower for word in ["运动", "跑", "健身", "走"]):
                category = "ACTIVITY"
                meta_data = {"note": text}
                reply_text = "运动记录已保存，继续保持！"
            elif any(word in text_lower for word in ["心情", "开心", "难过", "烦"]):
                category = "MOOD"
                meta_data = {"note": text}
                reply_text = "情绪已记录。"
        
        if image_base64:
            meta_data["has_image"] = True
            if not category_hint:
                reply_text = "图片已记录，AI 解析功能需要配置 OpenAI API Key。"
        
        return {
            "category": category,
            "meta_data": meta_data,
            "reply_text": reply_text,
        }
