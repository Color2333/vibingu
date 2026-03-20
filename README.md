# Vibing u

**Digitize Your Vibe. Optimize Your Life.**

个人生活数据黑匣子 —— 建立你的生活数据集，用 AI 寻找「最佳状态」的源代码。

![Version](https://img.shields.io/badge/version-0.5.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tests](https://img.shields.io/badge/tests-70%20passed-brightgreen)
![Python](https://img.shields.io/badge/python-3.11+-blue)

## 核心理念

```
从「记录」到「理解」到「优化」

┌─────────┐    ┌─────────┐    ┌─────────┐
│  记录   │ →  │  理解   │ →  │  优化   │
│ Record  │    │Understand│   │ Optimize │
└─────────┘    └─────────┘    └─────────┘

多模态输入      AI 分析洞察     个性化建议
智能标签        RAG 问答        目标追踪
自动分类        模式发现        行动指导
```

## Features

### v0.5 新功能 ✨

#### 对话与社交
- **对话持久化** - AI 对话历史自动保存，支持多会话管理
- **流式响应** - AI 回复实时流式输出，无需等待
- **公开动态** - 关注其他用户，浏览社区公开记录

#### 智能分析
- **分阶段 AI 解析** - tags → dimension → AI insight 逐步深入
- **八维度 Vibing Index** - 基于 PERMA-V+ 模型的多维评分
- **多标签支持** - sub_categories 细粒度分类
- **全局搜索** - RAG 语义搜索 + 历史记录搜索

#### 收藏与筛选
- **Bookmark 收藏** - 收藏重要记录，快速查阅
- **日期范围筛选** - 自定义时间区间，精确定位数据

#### 移动端优化
- **下拉刷新** - PullToRefresh 手势支持
- **触摸目标增大** - 所有按钮符合 44px 最小触摸标准

### v0.3 新功能 ✨

#### 主题系统
- **浅色/深色主题** - 支持手动切换或跟随系统偏好
- **CSS 变量架构** - 全局主题变量，组件自动适配
- **平滑过渡** - 主题切换时的优雅动画效果

#### 数据管理
- **隐私控制** - 记录默认私密，可选择公开分享
- **软删除** - 安全删除不需要的记录
- **公开首页** - 展示公开记录的社区页面
- **密码入口** - 私密空间的安全访问

#### 智能时间系统
- **记录时间推断** - AI 自动识别事件实际发生时间
- **睡眠截图分析** - 从截图中提取入睡/苏醒时间
- **时间筛选器** - 按今天/昨天/本周/本月或自定义日期范围筛选

#### AI 体验优化
- **手动触发模式** - AI 分析不再自动运行，用户按需生成
- **本地缓存** - 分析结果本地存储，减少重复请求
- **重试机制** - 失败时可重新生成，支持错误恢复
- **AI 对话助手** - 悬浮按钮快速访问 AI 问答

### v0.2 功能

#### AI Agent 系统
- **统一 AI 客户端** - 自动重试、模型降级、Token 追踪
- **智能标签 Agent** - AI 驱动的语义标签生成与关联发现
- **时间智能分析** - 昼夜节律分析、生物钟画像、智能提醒
- **预测引擎** - 次日状态预测、异常检测、因果归因
- **RAG 问答系统** - 基于个人历史的智能问答

#### 八维度生活模型 (PERMA-V+)
基于积极心理学理论构建的科学评估体系：

| 维度 | 说明 | 数据来源 |
|------|------|----------|
| 🛏️ 身体 Body | 睡眠、饮食、运动、能量 | 睡眠记录、餐食照片 |
| 😊 情绪 Mood | 快乐、平静、压力、焦虑 | 日记文本情绪分析 |
| 👥 关系 Social | 家人、朋友、同事、独处 | 社交活动记录 |
| 💼 效能 Work | 专注、产出、效率、心流 | 工作记录 |
| 📚 成长 Growth | 阅读、学习、技能、反思 | 学习记录 |
| 🎯 意义 Meaning | 目标、价值、贡献 | 反思日记 |
| 📱 数字 Digital | 屏幕时间、App 分布 | 屏幕截图 OCR |
| 🎮 休闲 Leisure | 娱乐、爱好、放松 | 活动记录 |

### v0.1 基础功能

#### The Recorder
- 多模态输入：文字、图片、语音、截图
- AI 智能解析：自动识别并结构化生活数据
- 智能图片处理：自动分类、数据提取、选择性保存

#### The Analyst  
- **Vibing Index**：综合多维度评分
- 趋势可视化：7天 Vibe 曲线
- 智能建议：基于数据的个性化洞察

#### The Optimizer
- PWA 支持：可安装为本地应用
- 提醒系统：喝水、休息、睡眠定时提醒
- 周报/月报：自动生成周期性总结
- 数据导出：JSON/CSV 格式

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS, Lucide Icons |
| Backend | Python FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Vector Store | ChromaDB (RAG 检索) |
| AI | 智谱 GLM-4 / OpenAI GPT-4o (可切换) |
| Testing | pytest, pytest-asyncio |
| Design | Glassmorphism, Light/Dark Theme |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vibing u v0.2 架构                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────────────────────────────────┐           │
│   │              Frontend (Next.js)         │           │
│   │    PWA / 响应式 / 离线支持              │           │
│   └────────────────┬────────────────────────┘           │
│                    │                                     │
│   ┌────────────────┴────────────────────────┐           │
│   │              API Gateway                │           │
│   │         (FastAPI + Auth)                │           │
│   └────────────────┬────────────────────────┘           │
│                    │                                     │
│   ┌────────┬───────┴───────┬────────┬───────┐          │
│   ↓        ↓               ↓        ↓       ↓          │
│ ┌────┐  ┌─────┐      ┌─────────┐ ┌─────┐ ┌─────┐      │
│ │Feed│  │Report│     │AI Agent │ │Time │ │ RAG │      │
│ │ Svc│  │ Svc │      │  System │ │Intel│ │ Svc │      │
│ └──┬─┘  └──┬──┘      └────┬────┘ └──┬──┘ └──┬──┘      │
│    │       │              │         │       │          │
│    └───────┴──────┬───────┴─────────┴───────┘          │
│                   │                                     │
│   ┌───────────────┴─────────────────────────┐          │
│   │              Data Layer                 │          │
│   │  ┌──────┐  ┌────────┐  ┌─────────┐     │          │
│   │  │SQLite│  │ChromaDB│  │  Images │     │          │
│   │  │/PgSQL│  │(Vector)│  │ Storage │     │          │
│   │  └──────┘  └────────┘  └─────────┘     │          │
│   └─────────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- AI API Key (智谱 GLM 或 OpenAI)

### 1. Clone & Setup

```bash
git clone https://github.com/YOUR_USERNAME/vibingu.git
cd vibingu
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env: set AI_API_KEY, ADMIN_PASSWORD

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run build
npm start
```

Visit http://localhost:3000

### 4. Run Tests

```bash
cd backend
pytest tests/ -v
```

## Project Structure

```
vibingu/
├── frontend/                 # Next.js 前端
│   ├── app/                  # 页面路由
│   │   ├── page.tsx          # 主页（公开/私密入口）
│   │   ├── record/[id]/      # 记录详情页
│   │   └── globals.css       # 主题变量 & 全局样式
│   ├── components/           # React 组件
│   │   ├── pages/            # 页面级组件
│   │   │   ├── RecordPage.tsx
│   │   │   ├── PublicFeedPage.tsx
│   │   │   └── ...
│   │   ├── FeedHistory.tsx   # 时间轴列表
│   │   ├── MagicInputBar.tsx # 多模态输入框
│   │   ├── ChatAssistant.tsx # AI 对话助手
│   │   ├── ThemeToggle.tsx   # 主题切换器
│   │   └── ...
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useAuth.tsx       # 认证状态
│   │   └── useTheme.tsx      # 主题管理
│   └── public/               # 静态资源 & PWA
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── routers/          # API 路由
│   │   ├── services/         # 业务逻辑
│   │   │   ├── ai_client.py      # 统一 AI 客户端
│   │   │   ├── data_extractor.py # 数据提取 & 时间推断
│   │   │   ├── tagger.py         # 智能标签 Agent
│   │   │   ├── time_intelligence.py  # 时间智能分析
│   │   │   ├── predictor.py      # 预测引擎
│   │   │   ├── rag.py            # RAG 问答系统
│   │   │   └── token_tracker.py  # Token 用量追踪
│   │   └── schemas/          # Pydantic 模型
│   ├── tests/                # 单元测试 (70+ tests)
│   └── requirements.txt
└── README.md                 # 项目文档
```

## API Overview

### 核心 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed` | POST | 多模态数据输入 |
| `/api/feed/history` | GET | 获取记录历史 |
| `/api/feed/{id}` | GET | 获取记录详情 |
| `/api/feed/{id}` | DELETE | 删除记录（软删除） |
| `/api/feed/{id}/visibility` | PUT | 切换公开/私密 |
| `/api/feed/public` | GET | 获取公开记录 |
| `/api/analytics/vibe/today` | GET | 今日 Vibe 评分 |
| `/api/analytics/trend` | GET | Vibe 趋势数据 |

### AI 增强 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/weekly-analysis` | GET | AI 周度分析 |
| `/api/ai/suggestions` | GET | AI 智能建议 |
| `/api/ai/tags/generate` | POST | AI 生成标签 |
| `/api/ai/time/insights` | GET | 时间智能分析 |
| `/api/ai/predict/tomorrow` | GET | 次日状态预测 |
| `/api/ai/rag/ask` | POST | RAG 智能问答 |
| `/api/chat/message` | POST | AI 对话消息 |
| `/api/feed/{id}/chat` | POST | 记录专属对话 |

### 报告 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/weekly` | GET | 周报 |
| `/api/reports/milestones` | GET | 里程碑数据 |
| `/api/reports/export` | GET | 数据导出 |

### Token 用量 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tokens/summary` | GET | 用量汇总 |
| `/api/tokens/trend` | GET | 用量趋势 |
| `/api/tokens/by-model` | GET | 按模型分类 |

## Roadmap

### Completed (v0.5)
- [x] 对话持久化 + 流式响应
- [x] 八维度 Vibing Index 评分
- [x] 分阶段 AI 解析 (tags → dimension → insight)
- [x] sub_categories 多标签分类
- [x] RAG 语义搜索 + 全局搜索
- [x] Bookmark 收藏功能
- [x] 日期范围筛选
- [x] 移动端手势优化 (PullToRefresh)

### Completed (v0.3)
- [x] 浅色/深色主题系统
- [x] 数据隐私控制（公开/私密）
- [x] 软删除功能
- [x] 公开首页与密码入口
- [x] 智能时间推断（record_time）
- [x] AI 手动触发 & 本地缓存
- [x] 首页时间筛选器
- [x] AI 对话悬浮助手

### Completed (v0.2)
- [x] 统一 AI 客户端（重试、降级、追踪）
- [x] 智能标签系统 (Tagger Agent)
- [x] 时间智能分析引擎
- [x] RAG 问答系统
- [x] 预测 & 异常检测
- [x] 单元测试覆盖 (70+ tests)
- [x] 高级可视化组件
  - [x] 年度热力图
  - [x] 多维雷达图
  - [x] 时间分布环形图
- [x] 游戏化系统
  - [x] 等级 & 经验值
  - [x] 成就徽章

### Planned
- [ ] 云图床接入 (Cloudflare R2 / S3)
- [ ] Docker 部署
- [ ] CI/CD 流水线
- [ ] 多设备数据同步
- [ ] 性能优化
- [ ] 智能提醒 / AI 日报
- [ ] 语音输入
- [ ] 周报 / 月报生成
- [ ] 对比视图 / 日历视图
- [ ] 第三方接入 (Notion, Linear 等)

## Environment Variables

```env
# AI Configuration (支持智谱 GLM 或 OpenAI)
AI_API_KEY=your-api-key
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
AI_PROVIDER=zhipu  # or openai

# Models
VISION_MODEL=glm-4.6v
TEXT_MODEL=glm-4.7
EMBEDDING_MODEL=embedding-3

# Auth
ADMIN_PASSWORD=your-password
SECRET_KEY=your-secret-key
```

## Contributing

欢迎贡献代码！请先阅读产品规划文档 `下一部进展.md`。

## License

MIT License - feel free to use and modify.

---

*Built with ❤️ for a better life. 你的生活，值得被深度理解。*

**v0.5.2** | 2025
