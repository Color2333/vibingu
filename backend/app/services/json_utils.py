"""
健壮的 JSON 提取工具

处理 AI/LLM 返回内容的常见格式问题：
1. 纯 JSON
2. markdown 代码块包裹 (```json ... ```)
3. JSON 前后有额外文字
4. 被 max_tokens 截断的不完整 JSON（尝试修复）
"""

import json
import re
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 匹配 markdown 代码块
_CODE_BLOCK_RE = re.compile(r'```(?:json)?\s*\n?(.*?)\n?\s*```', re.DOTALL)


def extract_json(raw_content: str, model_name: str = "") -> Any:
    """
    从 AI 返回内容中健壮地提取 JSON（支持 object 和 array）。
    
    Args:
        raw_content: AI 返回的原始文本
        model_name: 模型名称（仅用于日志）
    
    Returns:
        解析后的 dict 或 list
    
    Raises:
        ValueError: 无法从内容中提取有效 JSON
    """
    if not raw_content or not raw_content.strip():
        raise ValueError("AI 返回内容为空")
    
    content = raw_content.strip()
    
    # 0) 先尝试直接解析整个内容（处理纯 JSON 返回）
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    
    # 1) 尝试去掉 markdown 代码块标记
    code_match = _CODE_BLOCK_RE.search(content)
    if code_match:
        content = code_match.group(1).strip()
        # 去掉代码块后再尝试直接解析
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
    
    # 2) 尝试提取 JSON 对象 {...}
    obj_start = content.find('{')
    obj_end = content.rfind('}')
    
    if obj_start != -1 and obj_end != -1 and obj_end > obj_start:
        json_str = content[obj_start:obj_end + 1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass  # 继续尝试修复
    
    # 3) 尝试提取 JSON 数组 [...]
    arr_start = content.find('[')
    arr_end = content.rfind(']')
    
    if arr_start != -1 and arr_end != -1 and arr_end > arr_start:
        json_str = content[arr_start:arr_end + 1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
    
    # 4) 可能被截断：有 { 或 [ 但没有匹配的闭合符号
    first_open = -1
    for ch_idx, ch in enumerate(content):
        if ch in ('{', '['):
            first_open = ch_idx
            break
    
    if first_open != -1:
        truncated = content[first_open:]
        repaired = _try_repair_json(truncated)
        if repaired is not None:
            logger.info(f"成功修复截断的 JSON (model={model_name})")
            return repaired
    
    logger.warning(f"AI 返回内容无法解析为 JSON (model={model_name}): {raw_content[:300]}")
    raise ValueError(f"AI 返回内容无法解析为 JSON: {raw_content[:100]}")


def safe_extract_json(raw_content: str, model_name: str = "", fallback: Any = None) -> Any:
    """
    extract_json 的安全版本，失败时返回 fallback 而不是抛异常。
    适用于非核心解析场景（如分析、洞察等）。
    """
    try:
        return extract_json(raw_content, model_name)
    except (ValueError, Exception) as e:
        logger.warning(f"JSON 解析失败 (model={model_name}): {e}")
        return fallback


def _try_repair_json(truncated: str) -> Optional[Any]:
    """尝试修复被截断的 JSON 字符串（支持 object 和 array）"""
    text = truncated.rstrip()
    
    # 尝试不同的补全后缀
    suffixes = ['', '"', '"}', '"]', '"]}', '"}]}', '"}}', 'null}', 'null]']
    
    for suffix in suffixes:
        for trim_char in ['', ',']:
            candidate = text
            if trim_char and candidate.endswith(','):
                candidate = candidate[:-1]
            candidate = candidate + suffix
            
            open_braces = candidate.count('{') - candidate.count('}')
            open_brackets = candidate.count('[') - candidate.count(']')
            
            if open_braces >= 0 and open_brackets >= 0:
                candidate += ']' * open_brackets + '}' * open_braces
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
    
    return None
