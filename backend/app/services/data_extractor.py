"""
数据提取器 - 增强版
根据图片类型提取结构化数据 + 深度分析 + 智能建议
"""

import json
import re
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI
from app.config import get_settings
from app.services.token_tracker import record_usage

logger = logging.getLogger(__name__)

settings = get_settings()

# 默认时区（北京时间 UTC+8）
DEFAULT_TIMEZONE = timezone(timedelta(hours=8))

# 导入全局并发控制器
def _get_concurrency_limiter():
    """延迟导入并发控制器，避免循环导入"""
    from app.services.ai_client import _concurrency_limiter
    return _concurrency_limiter


DIMENSION_SCORING_PROMPT = """
【八维度评分 - 必须输出】
请基于以上分析，为这条记录对用户生活各维度的影响打分（0-100）。
不相关的维度设为 0，正面影响越大分数越高。

维度说明：
- body（身体）: 睡眠、饮食、运动对身体健康的影响
- mood（心情）: 情绪状态的正面/负面程度
- social（社交）: 人际互动、社会连接的质量
- work（工作）: 工作效率、成就感
- growth（成长）: 学习、技能提升、个人发展
- meaning（意义）: 价值感、目标感、生活充实度
- digital（数字）: 数字健康程度（屏幕时间少=高分）
- leisure（休闲）: 放松恢复、心流体验

在 JSON 输出中加入：
"dimension_scores": {
    "body": 0-100,
    "mood": 0-100,
    "social": 0-100,
    "work": 0-100,
    "growth": 0-100,
    "meaning": 0-100,
    "digital": 0-100,
    "leisure": 0-100
}
"""


class DataExtractor:
    """根据图片类型提取结构化数据 + AI 深度分析 + LLM 驱动的八维度评分"""
    
    def __init__(self):
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        self.vision_model = settings.vision_model   # glm-4.6v (付费，速率限制更宽松)
        self.text_model = settings.text_model       # glm-4.7 (付费，速率限制更宽松)
    
    def _parse_client_time(self, client_time: Optional[str]) -> datetime:
        """解析客户端时间并转换为本地时间"""
        if client_time:
            try:
                # ISO 格式时间，例如 "2026-02-05T05:10:00.000Z"
                dt = datetime.fromisoformat(client_time.replace('Z', '+00:00'))
                # 转换为本地时区（北京时间）
                local_dt = dt.astimezone(DEFAULT_TIMEZONE)
                return local_dt
            except Exception as e:
                logger.warning(f"时间解析错误: {e}, client_time={client_time}")
        # 返回当前本地时间
        return datetime.now(DEFAULT_TIMEZONE)
    
    def _get_current_time(self, client_time: Optional[str] = None) -> str:
        """获取当前时间字符串（本地时间）"""
        dt = self._parse_client_time(client_time)
        return dt.strftime("%Y年%m月%d日 %H:%M")
    
    def _get_time_period(self, client_time: Optional[str] = None) -> str:
        """获取时间段描述（基于本地时间）"""
        dt = self._parse_client_time(client_time)
        hour = dt.hour
        
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
    
    def _to_naive_beijing(self, dt: datetime) -> datetime:
        """将任意 datetime 转为无时区的北京时间（供 SQLite 存储）"""
        if dt.tzinfo is not None:
            # 先转为北京时间，再去掉时区信息
            dt = dt.astimezone(DEFAULT_TIMEZONE)
            return dt.replace(tzinfo=None)
        # 已经是 naive datetime，假设就是北京时间
        return dt
    
    def _parse_record_time(self, record_time_str: Optional[str], client_time: Optional[str]) -> Optional[datetime]:
        """解析 AI 返回的记录时间，返回无时区的北京时间 naive datetime"""
        if not record_time_str:
            return None
        
        client_dt = self._parse_client_time(client_time)
        
        try:
            # 尝试解析 ISO 格式 "2026-02-04T23:30:00"
            if 'T' in record_time_str or '-' in record_time_str:
                # 可能是完整日期时间
                if len(record_time_str) == 10:  # "2026-02-04"
                    dt = datetime.strptime(record_time_str, "%Y-%m-%d")
                    return dt.replace(hour=12)  # 默认中午，naive 北京时间
                else:
                    dt = datetime.fromisoformat(record_time_str.replace('Z', '+00:00'))
                    if dt.tzinfo is None:
                        # 无时区信息，假设是北京时间
                        return dt
                    # 有时区信息，转为北京时间再去掉时区
                    return self._to_naive_beijing(dt)
            
            # 尝试解析相对时间（基于 client_dt，先转为 naive 北京时间）
            naive_client = self._to_naive_beijing(client_dt)
            record_time_str = record_time_str.lower().strip()
            
            if record_time_str in ['今天', 'today', '现在', 'now']:
                return naive_client
            elif record_time_str in ['昨天', 'yesterday', '昨晚', '昨天晚上']:
                return naive_client - timedelta(days=1)
            elif record_time_str in ['前天', '大前天']:
                days = 2 if '大' not in record_time_str else 3
                return naive_client - timedelta(days=days)
            elif '天前' in record_time_str or 'days ago' in record_time_str:
                # 解析 "2天前" 或 "2 days ago"
                match = re.search(r'(\d+)', record_time_str)
                if match:
                    days = int(match.group(1))
                    return naive_client - timedelta(days=days)
            
            # 尝试解析 "昨晚 23:30" 格式
            if '昨' in record_time_str:
                time_match = re.search(r'(\d{1,2}):(\d{2})', record_time_str)
                yesterday = naive_client - timedelta(days=1)
                if time_match:
                    hour, minute = int(time_match.group(1)), int(time_match.group(2))
                    return yesterday.replace(hour=hour, minute=minute)
                return yesterday
            
        except Exception as e:
            logger.warning(f"记录时间解析错误: {e}, record_time={record_time_str}")
        
        return None
    
    async def extract(
        self,
        image_type: str,
        image_base64: Optional[str] = None,
        text: Optional[str] = None,
        content_hint: Optional[str] = None,
        client_time: Optional[str] = None,
        nickname: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        根据图片类型提取数据 + 深度分析
        
        Args:
            nickname: 用户昵称，AI 回复时用此称呼代替"用户"
        
        Returns:
            {
                "category": str,
                "meta_data": dict (包含 analysis, suggestions, trend 等),
                "reply_text": str
            }
        """
        # 保存昵称供 _call_ai 使用（线程安全：每次 extract 调用独立设置）
        self._nickname = nickname
        
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
            logger.error(f"数据提取错误: {e}")
            import traceback
            traceback.print_exc()
            return self._mock_extract(image_type, text, content_hint, client_time)
    
    async def _extract_text_only(self, text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """纯文本输入的智能解析 + 分析"""
        
        current_time = self._get_current_time(client_time)
        time_period = self._get_time_period(client_time)
        client_dt = self._parse_client_time(client_time)
        today_date = client_dt.strftime("%Y-%m-%d")
        yesterday_date = (client_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        
        system_prompt = f"""你是 Vibing u 的生活记录助手，擅长从只言片语中洞察用户状态。
当前时间：{current_time}（{time_period}）

【重要 - 时间分析】
今天是 {today_date}。请分析用户描述的事件实际发生在什么时候：
- 如果用户说"昨天"、"昨晚"，record_time 应为 {yesterday_date}
- 如果用户说"今天早上"、"刚才"、"现在"，record_time 应为当前时间
- 如果用户说"上周"、"3天前"等，请计算正确的日期
- 如果没有明确时间线索，默认为当前时间

【重要】本次输入仅有文字，没有图片。请深度分析用户输入。

你的任务：
1. 判断分类
2. 提取结构化数据
3. **深度分析**：挖掘文字背后的情绪、状态、可能的原因
4. **给出建议**：基于分析，给出1-2条具体可行的建议

分类选项（选最主要的一个作为 category，如果涉及多个领域可填 sub_categories）：
- SLEEP: 睡眠相关
- DIET: 饮食相关
- ACTIVITY: 运动相关
- MOOD: 情绪心情
- SOCIAL: 社交相关
- WORK: 工作学习
- GROWTH: 成长相关
- LEISURE: 休闲娱乐
- SCREEN: 屏幕时间

请以 JSON 格式输出（reply_text 必须放在前面优先生成）：
{{
    "category": "最主要的分类",
    "sub_categories": ["次要分类1", "次要分类2"],
    "reply_text": "一句温暖、有内涵的回复（15-30字），反映用户的状态或给予鼓励。【必须】有洞察力。【禁止】返回'已记录'这种空洞回复。",
    "record_time": "事件实际发生时间，ISO格式如 {today_date}T{client_dt.strftime('%H:%M')}:00 或相对时间如'昨天'",
    "mood": "happy/neutral/sad/tired/anxious/excited/calm/etc",
    "note": "简短描述",
    "analysis": "深度分析（50-100字）：分析用户当前状态、可能的情绪原因、与时间/场景的关联等",
    "suggestions": ["建议1（具体可行）", "建议2（如有必要）"],
    "trend": "up/down/stable（情绪/状态趋势判断）",
    "tags": ["标签1", "标签2", "标签3"],
    "dimension_scores": {{"body": 0, "mood": 75, "social": 0, "work": 0, "growth": 0, "meaning": 30, "digital": 0, "leisure": 0}}
}}
""" + DIMENSION_SCORING_PROMPT

        return await self._call_ai(system_prompt, None, text, "MOOD", client_time)
    
    async def _extract_sleep_data(self, image_base64: Optional[str], text: Optional[str], client_time: Optional[str]) -> Dict[str, Any]:
        """提取睡眠数据 + 睡眠分析"""
        
        current_time = self._get_current_time(client_time)
        client_dt = self._parse_client_time(client_time)
        today_date = client_dt.strftime("%Y-%m-%d")
        yesterday_date = (client_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        
        system_prompt = f"""你是一个睡眠健康专家和 OCR 数据提取专家。当前时间：{current_time}
这是一张睡眠记录截图（iPhone 健康 App / Sleep Cycle / 小米运动 / AutoSleep 等）。

【最重要 - 时间分析】
用户正在提交睡眠数据，需要判断这是哪一天的睡眠：
- 今天是 {today_date}
- 如果截图显示的日期是昨天或更早，record_date 应设为那一天
- 如果截图显示今天早上醒来的数据，实际入睡时间是昨晚，record_date 应设为昨天 {yesterday_date}
- 如果无法判断日期，默认是昨晚到今早的睡眠，record_date 设为 {yesterday_date}

请务必识别以下核心数据：
1. **入睡时间 (sleep_time)**：截图中显示的入睡/就寝时间（如 23:30、11:30 PM 等）
2. **苏醒时间 (wake_time)**：截图中显示的起床/苏醒时间（如 07:15、7:15 AM 等）
3. **睡眠时长**：总睡眠时间（如 7小时45分、7h45m 等）
4. **睡眠阶段**：深睡、浅睡、REM、清醒等各阶段时长

请以 JSON 格式输出：
{{
    "record_date": "{yesterday_date}",
    "record_time": "{yesterday_date}T23:30:00",
    "sleep_time": "23:30",
    "wake_time": "07:15", 
    "duration_hours": 7.75,
    "quality": "good/fair/poor",
    "score": 85,
    "deep_sleep_hours": 2.5,
    "rem_hours": 1.5,
    "light_sleep_hours": 3.75,
    "awake_hours": 0.5,
    "analysis": "深度分析（50-100字）：评估睡眠质量，深睡占比是否达标（建议20-40%），入睡时间是否健康（建议22:00-23:30）等",
    "suggestions": ["具体建议1", "具体建议2"],
    "reply_text": "一句温暖、有洞察的回复（15-30字），点评睡眠状况或给予建议。【禁止】空洞的'已记录'。",
    "trend": "up/down/stable",
    "tags": ["睡眠", "健康"],
    "dimension_scores": {{"body": 80, "mood": 65, "social": 0, "work": 0, "growth": 0, "meaning": 20, "digital": 0, "leisure": 0}}
}}
""" + DIMENSION_SCORING_PROMPT + """
【重要提示】：
1. record_date 是这条睡眠记录归属的日期（入睡那天），record_time 是入睡的完整时间戳
2. 入睡时间和苏醒时间是用户最关心的数据，请优先识别
3. 时间格式统一为 24 小时制（如 23:30，不要用 11:30 PM）
4. 如果截图中有时间轴，请从时间轴的起止点推断入睡和苏醒时间
5. 如果截图显示的是历史数据（如2天前），请正确设置 record_date
6. 只有确实无法识别时才设为 null"""

        return await self._call_ai(system_prompt, image_base64, text, "SLEEP", client_time)
    
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
    "record_time": "截图数据所属日期时间，ISO格式",
    "trend": "up/down/stable",
    "reply_text": "一句有洞察的回复（15-30字），指出屏幕使用的关键问题或肯定健康习惯。【禁止】空洞的'已记录'。",
    "health_score": 60,
    "tags": ["屏幕时间", "数字健康"],
    "dimension_scores": {{"body": 0, "mood": 40, "social": 0, "work": 30, "growth": 0, "meaning": 0, "digital": 60, "leisure": 30}}
}}
""" + DIMENSION_SCORING_PROMPT + """
注意：
1. **务必识别所有可见的 App 名称和时长**，这是最重要的数据
2. 如果某项不可见，设为 null
3. 分析要具体，建议要可行
4. record_time 应为截图所示日期，如果是今天的数据用当前时间，如果是昨天的用昨天的日期"""

        return await self._call_ai(system_prompt, image_base64, text, "SCREEN", client_time)
    
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
    "record_time": "运动实际发生时间，ISO格式",
    "analysis": "深度分析（50-100字）：评估运动强度、心率区间、是否达到训练效果等",
    "suggestions": ["具体建议1", "具体建议2"],
    "trend": "up/down/stable",
    "reply_text": "一句有力的鼓励（15-30字），肯定运动成果或激励继续保持。【禁止】空洞的'已记录'。",
    "tags": ["运动", "健身"],
    "dimension_scores": {{"body": 85, "mood": 70, "social": 0, "work": 0, "growth": 20, "meaning": 30, "digital": 0, "leisure": 40}}
}}
""" + DIMENSION_SCORING_PROMPT + """
注意：record_time 应为运动实际发生的时间，如果截图显示是昨天的运动记录，应设为昨天的日期。"""

        return await self._call_ai(system_prompt, image_base64, text, "ACTIVITY", client_time)
    
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
    "record_time": "这餐实际发生时间，ISO格式或相对时间如'今天中午'",
    "analysis": "营养分析（50-100字）：评估这餐的营养均衡性、热量是否合适、搭配是否健康等",
    "suggestions": ["具体建议1", "具体建议2"],
    "reply_text": "一句有趣的评价（15-30字），点评这餐的营养或美味程度。【禁止】空洞的'已记录'。",
    "tags": ["饮食", "美食"],
    "dimension_scores": {{"body": 70, "mood": 60, "social": 0, "work": 0, "growth": 0, "meaning": 20, "digital": 0, "leisure": 30}}
}}
""" + DIMENSION_SCORING_PROMPT + """
注意：record_time 应为这餐实际发生的时间。如果用户说"昨天的午餐"，应设为昨天中午。"""

        return await self._call_ai(system_prompt, image_base64, text, "DIET", client_time)
    
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
1. 判断这张照片最适合的分类
2. 描述照片内容
3. 推测用户当时的情绪和状态
4. 给出一句温暖的回复

分类选项（选最主要的一个作为 category，如果涉及多个领域可填 sub_categories）：
- SLEEP: 睡眠相关
- DIET: 饮食相关
- ACTIVITY: 运动相关
- MOOD: 情绪心情
- SOCIAL: 社交相关（聚会、合照等）
- WORK: 工作学习
- GROWTH: 成长相关
- LEISURE: 休闲娱乐
- SCREEN: 屏幕时间

请以 JSON 格式输出：
{{
    "category": "最主要的分类",
    "sub_categories": ["次要分类1", "次要分类2"],
    "description": "照片内容描述",
    "record_time": "照片实际拍摄/发生时间，如用户说'昨天'则为昨天的日期",
    "mood": "happy/neutral/tired/excited/calm/etc",
    "analysis": "深度分析（30-50字）：从照片推测用户状态、情绪、可能在做什么",
    "suggestions": ["如有需要的建议"],
    "reply_text": "一句温暖、有洞察的回复（15-30字），反映照片传递的情绪或给予鼓励。【禁止】空洞的'已记录'。",
    "tags": ["标签1", "标签2"],
    "dimension_scores": {{"body": 0, "mood": 70, "social": 0, "work": 0, "growth": 0, "meaning": 30, "digital": 0, "leisure": 50}}
}}
""" + DIMENSION_SCORING_PROMPT

        result = await self._call_ai(system_prompt, image_base64, text, category_map.get(image_type, "MOOD"), client_time)
        return result
    
    async def _call_ai(
        self, 
        system_prompt: str, 
        image_base64: Optional[str], 
        text: Optional[str],
        category: str,
        client_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """调用 AI 接口（带速率限制和重试）"""
        
        # 注入用户昵称到 system_prompt
        nickname = getattr(self, '_nickname', None)
        if nickname:
            system_prompt = (
                f"【重要】用户的昵称是「{nickname}」，在 reply_text 等回复中请用「{nickname}」称呼，"
                f"不要用'用户'、'你'等泛称。语气亲切自然。\n\n"
            ) + system_prompt
        
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
        
        # 获取并发控制器
        limiter = _get_concurrency_limiter()
        
        # 获取并发许可，繁忙时自动升级到高并发模型
        acquired, actual_model = await limiter.acquire_with_upgrade(model, timeout=90.0)
        if not acquired:
            raise Exception(f"模型 {model} 并发已满，等待超时")
        
        try:
            response = await self.client.chat.completions.create(
                model=actual_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=4096,
                # 强制 JSON 输出：消除 markdown 代码块包裹、额外解释文字等问题
                response_format={"type": "json_object"},
            )
            
            # 检查 finish_reason 和 token 用量
            choice = response.choices[0]
            finish_reason = choice.finish_reason
            usage = response.usage
            
            if usage:
                logger.info(
                    f"[Token 用量] model={actual_model}, category={category}, "
                    f"prompt={usage.prompt_tokens}, completion={usage.completion_tokens}, "
                    f"total={usage.total_tokens}, finish_reason={finish_reason}"
                )
                # 记录到 token_usage 表
                try:
                    record_usage(
                        model=actual_model,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        task_type="extract_data",
                        task_description=f"数据提取: {category}",
                    )
                except Exception as e:
                    logger.warning(f"Token 记录失败: {e}")
            
            if finish_reason == "length":
                logger.warning(
                    f"⚠️ AI 响应被截断 (finish_reason=length)! model={actual_model}, "
                    f"category={category}, completion_tokens={usage.completion_tokens if usage else '?'}"
                )
            
            raw_content = choice.message.content
            if not raw_content or not raw_content.strip():
                logger.warning(f"AI 返回空内容 (model={actual_model}, category={category}, finish_reason={finish_reason})")
                raise ValueError("AI 返回内容为空")
            
            # response_format=json_object 保证输出为纯 JSON，但仍用 extract_json 做防御
            from app.services.json_utils import extract_json
            result = extract_json(raw_content, actual_model)
            
            # 提取 dimension_scores（LLM 驱动评分）
            dimension_scores = result.pop("dimension_scores", None)
            if dimension_scores and isinstance(dimension_scores, dict):
                # 校验并清洗：确保所有值在 0-100 且 key 合法
                valid_dims = {"body", "mood", "social", "work", "growth", "meaning", "digital", "leisure"}
                dimension_scores = {
                    k: max(0, min(100, int(v)))
                    for k, v in dimension_scores.items()
                    if k in valid_dims and isinstance(v, (int, float))
                }
                if len(dimension_scores) < 4:
                    dimension_scores = None  # 太少的维度说明 LLM 没正确输出
            else:
                dimension_scores = None
            
            # AI 返回的分类优先于默认分类
            valid_categories = {"SLEEP", "DIET", "ACTIVITY", "MOOD", "SOCIAL", "WORK", "GROWTH", "LEISURE", "SCREEN"}
            ai_category = result.pop("category", None)
            if ai_category and str(ai_category).upper() in valid_categories:
                category = str(ai_category).upper()
                logger.info(f"AI 分类结果: {category}")
            
            # 处理副分类（混合类别）
            raw_sub = result.pop("sub_categories", None)
            sub_categories = []
            if raw_sub and isinstance(raw_sub, list):
                for sc in raw_sub:
                    sc_upper = str(sc).upper()
                    if sc_upper in valid_categories and sc_upper != category:
                        sub_categories.append(sc_upper)
                if sub_categories:
                    logger.info(f"AI 副分类: {sub_categories}")
            
            # 确保 analysis 和 suggestions 存在
            meta_data = {k: v for k, v in result.items() if k not in ["reply_text", "record_time", "record_date"]}
            if sub_categories:
                meta_data["sub_categories"] = sub_categories
            if "analysis" not in meta_data:
                meta_data["analysis"] = None
            if "suggestions" not in meta_data:
                meta_data["suggestions"] = []
            
            # 处理 record_time（实际发生时间）
            record_time = None
            record_time_str = result.get("record_time") or result.get("record_date")
            if record_time_str:
                record_time = self._parse_record_time(record_time_str, client_time)
            
            # 确保 reply_text 有意义
            reply_text = result.get("reply_text", "")
            if not reply_text or reply_text == "已记录" or len(reply_text.strip()) < 3:
                logger.warning(f"AI 未返回有意义的 reply_text (got={reply_text!r})，JSON keys={list(result.keys())}")
                # 使用 analysis 的前 30 字作为 fallback
                analysis = result.get("analysis") or meta_data.get("analysis")
                if analysis and isinstance(analysis, str) and len(analysis) > 5:
                    reply_text = analysis[:50].rstrip("，。、；") + "..."
                else:
                    reply_text = "已记录"
            
            return {
                "category": category,
                "meta_data": meta_data,
                "reply_text": reply_text,
                "record_time": record_time,
                "dimension_scores": dimension_scores,
            }
        finally:
            # 释放实际使用的模型的并发许可
            limiter.release(actual_model)
    
    def _mock_extract(
        self, 
        image_type: str, 
        text: Optional[str],
        content_hint: Optional[str],
        client_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """模拟数据提取（无 API 时），dimension_scores 为 None 表示需要 fallback"""
        
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
                "dimension_scores": None,
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
                "dimension_scores": None,
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
                "dimension_scores": None,
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
                "dimension_scores": None,
            }
        else:
            # 纯文本或其他 — 给出比"已记录"更有意义的回复
            note = text or content_hint or "记录"
            nickname = getattr(self, '_nickname', None)
            greeting = f"{nickname}，{time_period}好" if nickname else f"{time_period}好"
            reply = f"{greeting}！你的记录已保存，AI 分析将在 API 配置后可用。"
            return {
                "category": "MOOD",
                "meta_data": {
                    "note": note,
                    "analysis": None,
                    "suggestions": [],
                },
                "reply_text": reply,
                "dimension_scores": None,
            }
