"""
端到端数据流测试

测试完整的数据输入 -> 存储 -> AI处理 -> 展示流程
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"


def test_text_input_flow():
    """测试文本输入完整流程"""
    print("\n" + "=" * 60)
    print("📝 测试 1: 文本输入流程")
    print("=" * 60)
    
    # 1. 获取初始记录数量
    r = requests.get(f"{BASE_URL}/api/feed/stats")
    initial_count = r.json().get("total_records", 0)
    print(f"初始记录数: {initial_count}")
    
    # 2. 提交文本记录 (使用 Form 数据格式)
    test_content = f"端到端测试记录 - {datetime.now().strftime('%H:%M:%S')}"
    print(f"\n提交文本: {test_content}")
    
    r = requests.post(
        f"{BASE_URL}/api/feed",
        data={"text": test_content},  # Form 数据，不是 JSON
        timeout=180  # AI 处理含多阶段+自动重试，需要足够时间
    )
    
    if r.status_code != 200:
        print(f"❌ 提交失败: {r.status_code}")
        print(f"响应: {r.text[:200]}")
        return False
    
    result = r.json()
    print(f"✅ 提交成功")
    print(f"   - ID: {result.get('id')}")
    print(f"   - 分类: {result.get('category')}")
    print(f"   - 标签: {result.get('tags')}")
    print(f"   - AI 洞察: {result.get('ai_insight', '无')[:100]}...")
    
    record_id = result.get("id")
    
    # 3. 验证记录数量增加
    r = requests.get(f"{BASE_URL}/api/feed/stats")
    new_count = r.json().get("total_records", 0)
    
    if new_count > initial_count:
        print(f"\n✅ 记录数验证通过: {initial_count} -> {new_count}")
    else:
        print(f"\n❌ 记录数未增加: {initial_count} -> {new_count}")
        return False
    
    # 4. 验证可以从历史中检索
    r = requests.get(f"{BASE_URL}/api/feed/history?limit=5")
    history = r.json()  # 直接返回列表
    
    found = any(rec.get("id") == record_id for rec in history)
    if found:
        print(f"✅ 历史记录验证通过")
    else:
        print(f"❌ 无法在历史中找到记录")
        return False
    
    return True


def test_analytics_update():
    """测试分析数据更新"""
    print("\n" + "=" * 60)
    print("📊 测试 2: 分析数据更新")
    print("=" * 60)
    
    # 1. 获取当前分析数据
    endpoints = [
        ("/api/analytics/vibe/today", "今日 Vibe"),
        ("/api/analytics/trend?days=7", "趋势数据"),
        ("/api/time/bio-clock", "生物钟画像"),
    ]
    
    all_ok = True
    for path, name in endpoints:
        r = requests.get(f"{BASE_URL}{path}", timeout=30)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ {name}: {json.dumps(data, ensure_ascii=False)[:100]}...")
        else:
            print(f"❌ {name}: {r.status_code}")
            all_ok = False
    
    return all_ok


def test_gamification_flow():
    """测试游戏化系统"""
    print("\n" + "=" * 60)
    print("🎮 测试 3: 游戏化系统")
    print("=" * 60)
    
    # 1. 获取当前等级
    r = requests.get(f"{BASE_URL}/api/gamification/level")
    level_data = r.json()
    print(f"当前等级: Lv.{level_data.get('current_level', 0)} - {level_data.get('level_title', 'Unknown')}")
    print(f"经验值: {level_data.get('total_xp', 0)} XP (下一级还需 {level_data.get('xp_to_next_level', 0)} XP)")
    print(f"进度: {level_data.get('progress_percent', 0):.1f}%")
    
    # 2. 获取徽章
    r = requests.get(f"{BASE_URL}/api/gamification/badges")
    badges_data = r.json()
    badges = badges_data.get("badges", [])
    earned = badges_data.get("earned_count", 0)
    if badges:
        print(f"徽章数量: {len(badges)}（已获得: {earned}）")
        for badge in [b for b in badges if b.get("earned")][:3]:
            print(f"  - {badge.get('icon')} {badge.get('title')}: {badge.get('description')}")
    else:
        print("暂无徽章")
    
    # 3. 获取连续记录
    r = requests.get(f"{BASE_URL}/api/gamification/streak")
    streak = r.json()
    print(f"连续记录: {streak.get('current_streak', 0)} 天")
    
    return True


def test_token_tracking():
    """测试 Token 追踪"""
    print("\n" + "=" * 60)
    print("🪙 测试 4: Token 追踪")
    print("=" * 60)
    
    r = requests.get(f"{BASE_URL}/api/tokens/summary")
    summary = r.json()
    
    print(f"今日 Token: {summary.get('today', {}).get('total_tokens', 0)}")
    print(f"本周 Token: {summary.get('week', {}).get('total_tokens', 0)}")
    print(f"总 Token: {summary.get('all_time', {}).get('total_tokens', 0)}")
    
    return True


def test_rag_search():
    """测试 RAG 搜索"""
    print("\n" + "=" * 60)
    print("🔍 测试 5: RAG 语义搜索")
    print("=" * 60)
    
    # 1. 搜索测试
    r = requests.get(f"{BASE_URL}/api/rag/search?q=记录", timeout=30)
    results = r.json()
    
    if "results" in results:
        print(f"搜索 '记录' 返回 {len(results['results'])} 条结果")
    else:
        print(f"搜索结果: {json.dumps(results, ensure_ascii=False)[:100]}")
    
    # 2. 问答测试
    r = requests.get(f"{BASE_URL}/api/rag/ask?q=最近怎么样", timeout=30)
    answer = r.json()
    print(f"问答结果: {answer.get('answer', '无答案')[:100]}...")
    
    return True


def test_prediction_system():
    """测试预测系统"""
    print("\n" + "=" * 60)
    print("🔮 测试 6: 预测系统")
    print("=" * 60)
    
    # 1. 明日预测
    r = requests.get(f"{BASE_URL}/api/predict/tomorrow")
    prediction = r.json()
    score = prediction.get('predicted_score', 'N/A')
    confidence = prediction.get('confidence', 'N/A')
    print(f"明日预测 Vibe Score: {score} (置信度: {confidence})")
    
    # 2. What-if 模拟
    r = requests.post(
        f"{BASE_URL}/api/predict/what-if",
        json={"sleep_hours": 8, "exercise_minutes": 30}
    )
    whatif = r.json()
    whatif_score = whatif.get('predicted_score', 'N/A')
    adjustments = whatif.get('adjustments', [])
    print(f"What-if 模拟 (8h睡眠+30min运动): 预测分数 {whatif_score}")
    if adjustments:
        for adj in adjustments[:2]:
            print(f"  - {adj.get('factor')}: {adj.get('impact'):+d} ({adj.get('reason')})")
    
    # 3. 异常检测
    r = requests.get(f"{BASE_URL}/api/predict/anomalies?days=30")
    anomalies = r.json()
    anomaly_list = anomalies.get("anomalies", [])
    print(f"异常检测: {len(anomaly_list)} 个异常")
    if anomaly_list:
        for a in anomaly_list[:2]:
            print(f"  - {a.get('type')}: {a.get('description', a.get('date', 'N/A'))}")
    
    return True


def run_e2e_tests():
    """运行所有端到端测试"""
    print("\n" + "=" * 60)
    print("🚀 Vibing u 端到端数据流测试")
    print("=" * 60)
    
    results = {
        "文本输入流程": test_text_input_flow(),
        "分析数据更新": test_analytics_update(),
        "游戏化系统": test_gamification_flow(),
        "Token 追踪": test_token_tracking(),
        "RAG 搜索": test_rag_search(),
        "预测系统": test_prediction_system(),
    }
    
    print("\n" + "=" * 60)
    print("📋 测试结果汇总")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print(f"\n通过率: {passed}/{total} ({passed/total*100:.0f}%)")
    
    return results


if __name__ == "__main__":
    run_e2e_tests()
