"""智能标签服务 - Tagger Agent"""
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

from openai import AsyncOpenAI
from app.config import get_settings
from app.services.token_tracker import record_usage

settings = get_settings()


class TaggerAgent:
    """智能标签生成器"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.model = "gpt-4o-mini"  # 使用更便宜的模型
        
        # 标签层级结构
        self.tag_hierarchy = {
            "时间": ["早晨", "上午", "中午", "下午", "傍晚", "晚间", "深夜", "凌晨"],
            "身体": ["睡眠", "饮食", "运动", "休息", "疲劳", "精力充沛"],
            "心情": ["开心", "平静", "焦虑", "烦躁", "沮丧", "兴奋", "满足"],
            "社交": ["独处", "家人", "朋友", "同事", "约会", "聚会"],
            "工作": ["会议", "专注", "创作", "沟通", "学习", "拖延"],
            "休闲": ["阅读", "游戏", "电影", "音乐", "散步", "旅行"],
            "饮食": ["早餐", "午餐", "晚餐", "零食", "咖啡", "茶", "酒", "水果"],
            "习惯": ["好习惯", "坏习惯", "打卡", "挑战", "突破"],
        }
    
    async def generate_tags(
        self,
        text: Optional[str] = None,
        category: Optional[str] = None,
        meta_data: Optional[Dict] = None,
        record_id: Optional[str] = None,
    ) -> List[str]:
        """
        为记录生成智能标签
        
        Args:
            text: 原始文本内容
            category: 记录分类
            meta_data: 记录元数据
            record_id: 关联的记录 ID
            
        Returns:
            标签列表，格式为 "#类别/标签名"
        """
        if not self.client:
            return self._rule_based_tags(text, category, meta_data)
        
        try:
            return await self._ai_generate_tags(text, category, meta_data, record_id)
        except Exception as e:
            print(f"AI 标签生成错误: {e}")
            return self._rule_based_tags(text, category, meta_data)
    
    async def _ai_generate_tags(
        self,
        text: Optional[str],
        category: Optional[str],
        meta_data: Optional[Dict],
        record_id: Optional[str],
    ) -> List[str]:
        """使用 AI 生成标签"""
        
        current_hour = datetime.now().hour
        time_period = self._get_time_period(current_hour)
        
        system_prompt = f"""你是一个智能标签生成器。根据用户的生活记录，生成相关的标签。

标签格式：#类别/标签名
类别参考：{list(self.tag_hierarchy.keys())}

规则：
1. 生成 3-6 个最相关的标签
2. 标签要具体、有信息量
3. 必须包含时间标签
4. 可以创建新的类别和标签

请直接返回 JSON 数组，如：["#时间/早晨", "#饮食/咖啡", "#习惯/提神"]"""

        user_content = f"""
当前时间段：{time_period}
分类：{category or "未知"}
内容：{text or "无"}
元数据：{json.dumps(meta_data, ensure_ascii=False) if meta_data else "无"}

请生成标签："""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        
        # 记录 Token 使用
        if response.usage:
            try:
                record_usage(
                    model=self.model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    task_type="generate_tags",
                    task_description=f"Tags for: {category}",
                    related_record_id=record_id
                )
            except Exception as e:
                print(f"Token 记录失败: {e}")
        
        result = json.loads(response.choices[0].message.content)
        # 处理返回格式（可能是 {"tags": [...]} 或直接 [...]）
        if isinstance(result, dict):
            return result.get("tags", [])
        return result
    
    def _rule_based_tags(
        self,
        text: Optional[str],
        category: Optional[str],
        meta_data: Optional[Dict],
    ) -> List[str]:
        """基于规则的标签生成（fallback）"""
        tags = []
        
        # 时间标签
        current_hour = datetime.now().hour
        time_tag = f"#时间/{self._get_time_period(current_hour)}"
        tags.append(time_tag)
        
        # 分类标签
        category_map = {
            "SLEEP": "#身体/睡眠",
            "DIET": "#饮食/进食",
            "ACTIVITY": "#身体/运动",
            "MOOD": "#心情/记录",
            "SOCIAL": "#社交/互动",
            "WORK": "#工作/任务",
            "GROWTH": "#成长/学习",
            "LEISURE": "#休闲/娱乐",
            "SCREEN": "#数字/屏幕",
        }
        if category and category in category_map:
            tags.append(category_map[category])
        
        # 从文本提取关键词
        if text:
            keywords = {
                "咖啡": "#饮食/咖啡",
                "跑步": "#身体/跑步",
                "健身": "#身体/健身",
                "书": "#休闲/阅读",
                "电影": "#休闲/电影",
                "游戏": "#休闲/游戏",
                "开心": "#心情/开心",
                "累": "#身体/疲劳",
                "会议": "#工作/会议",
                "学习": "#成长/学习",
            }
            for kw, tag in keywords.items():
                if kw in text and tag not in tags:
                    tags.append(tag)
        
        return tags[:6]  # 最多返回6个标签
    
    def _get_time_period(self, hour: int) -> str:
        """根据小时判断时间段"""
        if 5 <= hour < 9:
            return "早晨"
        elif 9 <= hour < 12:
            return "上午"
        elif 12 <= hour < 14:
            return "中午"
        elif 14 <= hour < 17:
            return "下午"
        elif 17 <= hour < 19:
            return "傍晚"
        elif 19 <= hour < 22:
            return "晚间"
        elif 22 <= hour < 24:
            return "深夜"
        else:
            return "凌晨"


# 全局单例
_tagger: Optional[TaggerAgent] = None


def get_tagger() -> TaggerAgent:
    """获取 TaggerAgent 单例"""
    global _tagger
    if _tagger is None:
        _tagger = TaggerAgent()
    return _tagger
