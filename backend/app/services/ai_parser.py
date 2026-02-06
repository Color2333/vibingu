import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from openai import AsyncOpenAI
from app.config import get_settings
from app.services.token_tracker import record_usage

logger = logging.getLogger(__name__)
settings = get_settings()


class AIParser:
    """AI 解析服务 - 根据输入类型选择模型"""
    
    def __init__(self):
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        self.vision_model = settings.vision_model   # 有图像时用视觉模型
        self.text_model = settings.text_model       # 纯文本用便宜模型
    
    async def parse(
        self,
        text: Optional[str] = None,
        image_base64: Optional[str] = None,
        category_hint: Optional[str] = None,
        record_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        解析用户输入，提取结构化数据
        
        Args:
            text: 文本输入
            image_base64: Base64 编码的图片
            category_hint: 分类提示
            record_id: 关联的记录 ID（用于 token 追踪）
            
        Returns:
            包含 category, meta_data, reply_text 的字典
        """
        if not self.client:
            # 如果没有配置 API Key，返回模拟数据
            return self._mock_parse(text, image_base64, category_hint)
        
        try:
            return await self._openai_parse(text, image_base64, category_hint, record_id)
        except Exception as e:
            logger.error(f"AI 解析错误: {e}")
            return self._mock_parse(text, image_base64, category_hint)
    
    async def _openai_parse(
        self,
        text: Optional[str],
        image_base64: Optional[str],
        category_hint: Optional[str],
        record_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """使用 OpenAI GPT-4o Vision 进行解析"""
        
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # 根据是否有图像调整 prompt
        has_image = image_base64 is not None
        
        system_prompt = f"""你是 Vibing u 的首席分析师。你冷静、客观，但极具洞察力。
你的目标是通过数据帮助用户达到 "High Vibe" 状态。

【重要】本次输入{"包含图片" if has_image else "仅有文字，没有图片"}。请严格基于实际输入内容分析，不要臆测不存在的内容。

你的任务是：
1. 从用户的{"图片和文字" if has_image else "文字描述"}中提取结构化数据
2. 判断输入属于哪个分类
3. 用简短、温暖的语言给出回复（不要重复用户说的话）
4. 为内容生成相关的标签 (tags)

分类枚举：SLEEP（睡眠）, DIET（饮食）, SCREEN（屏幕时间）, ACTIVITY（活动）, MOOD（情绪）, GROWTH（成长/学习）, SOCIAL（社交）, LEISURE（休闲）

请以 JSON 格式输出，包含以下字段：
- category: 分类（上述枚举之一）
- meta_data: 提取的结构化数据，只包含有意义的字段，比如：
  * MOOD: {{"mood": "happy/sad/neutral", "note": "简短描述"}}
  * DIET: {{"food_name": "食物名", "calories": 数值}}
  * SLEEP: {{"duration_hours": 数值, "quality": "good/fair/poor"}}
- reply_text: 给用户的一句话回复（中文，温暖有洞察力，不要说"分享"、"照片"等词汇除非确实有图片）
- tags: 相关标签数组，格式为 "#类别/标签名"

示例（纯文字输入"今天心情不错"）：
{{
    "category": "MOOD",
    "meta_data": {{"mood": "happy"}},
    "reply_text": "好心情是一天的好开始，继续保持！",
    "tags": ["#心情/开心", "#时间/上午"]
}}"""

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
        
        # 根据是否有图像选择模型
        model = self.vision_model if image_base64 else self.text_model
        
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=3000,
            response_format={"type": "json_object"},
        )
        
        # 记录 Token 使用
        if response.usage:
            try:
                record_usage(
                    model=model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    task_type="parse_input",
                    task_description=f"Parse: {text[:50] if text else 'image'}..." if text and len(text) > 50 else text or "image",
                    related_record_id=record_id
                )
            except Exception as e:
                logger.warning(f"Token 记录失败: {e}")
        
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
