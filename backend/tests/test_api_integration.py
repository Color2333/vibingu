"""
集成测试 - API 端点连通性验证

Phase 1: 验证所有 API 端点可访问并返回正确格式
"""

import requests
import json
from typing import Dict, Any, Optional, Tuple

BASE_URL = "http://localhost:8000"


def test_endpoint(
    method: str,
    path: str,
    expected_status: int = 200,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None,
    description: str = "",
    timeout: int = 30
) -> Tuple[bool, str, Optional[Dict]]:
    """
    测试单个端点
    
    返回: (是否成功, 消息, 响应数据)
    """
    url = f"{BASE_URL}{path}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, params=params, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=timeout)
        elif method.upper() == "DELETE":
            response = requests.delete(url, timeout=timeout)
        else:
            return False, f"不支持的方法: {method}", None
        
        if response.status_code == expected_status:
            try:
                data = response.json()
                return True, f"✅ {description}", data
            except json.JSONDecodeError:
                return True, f"✅ {description} (非 JSON 响应)", None
        else:
            return False, f"❌ {description}: 期望 {expected_status}, 实际 {response.status_code}", None
            
    except requests.exceptions.ConnectionError:
        return False, f"❌ {description}: 连接失败 - 服务器未启动?", None
    except requests.exceptions.Timeout:
        return False, f"❌ {description}: 请求超时", None
    except Exception as e:
        return False, f"❌ {description}: {str(e)}", None


def run_integration_tests():
    """运行所有集成测试"""
    
    print("=" * 60)
    print("Vibing u API 集成测试")
    print("=" * 60)
    
    results = {
        "passed": 0,
        "failed": 0,
        "errors": []
    }
    
    # ==== 1. 核心基础 API ====
    print("\n📌 1. 核心基础 API")
    print("-" * 40)
    
    tests = [
        ("GET", "/", 200, None, None, "根路径"),
        ("GET", "/health", 200, None, None, "健康检查"),
        ("GET", "/api/health", 200, None, None, "API 健康检查"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 2. Feed API ====
    print("\n📌 2. Feed API (数据投喂)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/feed/history", 200, None, {"limit": 10}, "获取历史记录"),
        ("GET", "/api/feed/stats", 200, None, None, "获取统计信息"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 3. Analytics API ====
    print("\n📌 3. Analytics API (分析)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/analytics/vibe/today", 200, None, None, "今日 Vibe Score"),
        ("GET", "/api/analytics/trend", 200, None, {"days": 7}, "Vibe 趋势"),
        ("GET", "/api/analytics/correlation", 200, None, None, "关联分析"),
        ("GET", "/api/analytics/dimensions/meta", 200, None, None, "维度元数据"),
        ("GET", "/api/analytics/dimensions/today", 200, None, None, "今日维度分析"),
        ("GET", "/api/analytics/dimensions/radar/today", 200, None, None, "今日雷达图"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 4. Time Intelligence API ====
    print("\n📌 4. Time Intelligence API (时间智能)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/time/circadian", 200, None, {"days": 30}, "昼夜节律"),
        ("GET", "/api/time/weekly", 200, None, {"weeks": 4}, "周模式"),
        ("GET", "/api/time/monthly", 200, None, {"months": 3}, "月模式"),
        ("GET", "/api/time/bio-clock", 200, None, None, "生物钟画像"),
        ("GET", "/api/time/hourly", 200, None, {"days": 30}, "小时分布"),
        ("GET", "/api/time/heatmap", 200, None, None, "热力图"),
        ("GET", "/api/time/emotion-trend", 200, None, {"days": 30}, "情绪趋势"),
        ("GET", "/api/time/mood-distribution", 200, None, {"days": 30}, "心情分布"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 5. AI 增强 API ====
    print("\n📌 5. AI 增强 API (需要 AI 服务)")
    print("-" * 40)
    
    # AI API 需要更长的超时时间 (90秒)
    ai_tests = [
        ("GET", "/api/time/ai-insights", 200, None, {"days": 30}, "AI 时间洞察", 90),
        ("GET", "/api/time/smart-reminders", 200, None, None, "智能提醒", 90),
        ("GET", "/api/ai/weekly-analysis", 200, None, None, "AI 周分析", 90),
        ("GET", "/api/ai/trends", 200, None, {"days": 30}, "AI 趋势分析", 90),
        ("GET", "/api/ai/suggestions", 200, None, None, "AI 智能建议", 90),
    ]
    
    for method, path, status, data, params, desc, timeout in ai_tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc, timeout)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 6. Prediction API ====
    print("\n📌 6. Prediction API (预测)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/predict/tomorrow", 200, None, None, "明日预测"),
        ("GET", "/api/predict/anomalies", 200, None, {"days": 30}, "异常检测"),
        ("GET", "/api/predict/causation", 200, None, None, "因果分析"),
        ("GET", "/api/predict/alerts", 200, None, None, "健康提醒"),
        ("POST", "/api/predict/what-if", 200, {"sleep_hours": 8}, None, "What-if 模拟"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 7. Tags API ====
    print("\n📌 7. Tags API (标签)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/tags/cloud", 200, None, {"days": 30}, "标签云"),
        ("GET", "/api/tags/hierarchy", 200, None, {"days": 30}, "标签层级"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 8. RAG API ====
    print("\n📌 8. RAG API (知识库)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/rag/stats", 200, None, None, "RAG 统计"),
        ("GET", "/api/rag/search", 200, None, {"q": "睡眠"}, "语义搜索"),
        ("GET", "/api/rag/ask", 200, None, {"q": "今天怎么样"}, "RAG 问答"),
        ("GET", "/api/rag/similar-days", 200, None, None, "相似日"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 9. Gamification API ====
    print("\n📌 9. Gamification API (游戏化)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/gamification/summary", 200, None, None, "游戏化汇总"),
        ("GET", "/api/gamification/level", 200, None, None, "用户等级"),
        ("GET", "/api/gamification/badges", 200, None, None, "徽章列表"),
        ("GET", "/api/gamification/challenges", 200, None, None, "挑战列表"),
        ("GET", "/api/gamification/streak", 200, None, None, "连续记录"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 10. Tokens API ====
    print("\n📌 10. Tokens API (Token 追踪)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/tokens/stats", 200, None, {"period": "today"}, "Token 统计"),
        ("GET", "/api/tokens/summary", 200, None, None, "Token 汇总"),
        ("GET", "/api/tokens/trend", 200, None, {"days": 14}, "Token 趋势"),
        ("GET", "/api/tokens/by-model", 200, None, None, "按模型统计"),
        ("GET", "/api/tokens/by-task", 200, None, None, "按任务统计"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 11. Chat API ====
    print("\n📌 11. Chat API (对话)")
    print("-" * 40)
    
    # Chat API 也需要更长超时
    chat_tests = [
        ("GET", "/api/chat/suggestions", 200, None, None, "推荐问题", 30),
        ("POST", "/api/chat/message", 200, {"message": "今天怎么样"}, None, "发送消息", 90),
    ]
    
    for method, path, status, data, params, desc, timeout in chat_tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc, timeout)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 12. Reports API ====
    print("\n📌 12. Reports API (报告)")
    print("-" * 40)
    
    tests = [
        ("GET", "/api/reports/weekly", 200, None, None, "周报"),
        ("GET", "/api/reports/milestones", 200, None, None, "里程碑"),
        ("GET", "/api/reports/suggestions", 200, None, None, "智能建议"),
    ]
    
    for method, path, status, data, params, desc in tests:
        success, msg, _ = test_endpoint(method, path, status, data, params, desc)
        print(msg)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(msg)
    
    # ==== 汇总 ====
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    total = results["passed"] + results["failed"]
    pass_rate = (results["passed"] / total * 100) if total > 0 else 0
    
    print(f"✅ 通过: {results['passed']}")
    print(f"❌ 失败: {results['failed']}")
    print(f"📊 通过率: {pass_rate:.1f}%")
    
    if results["errors"]:
        print("\n失败的测试:")
        for error in results["errors"]:
            print(f"  {error}")
    
    return results


if __name__ == "__main__":
    run_integration_tests()
