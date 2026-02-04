# Vibing u

**Digitize Your Vibe. Optimize Your Life.**

个人生活数据黑匣子 —— 建立你的生活数据集，用 AI 寻找「最佳状态」的源代码。

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features (v0.1)

### The Recorder
- 多模态输入：文字、图片、语音、截图
- AI 智能解析：自动识别并结构化生活数据
- 智能图片处理：自动分类、数据提取、选择性保存

### The Analyst  
- **Vibing Index**：综合睡眠、饮食、屏幕、活动四维度评分
- 趋势可视化：7天 Vibe 曲线
- 智能建议：基于数据的个性化洞察

### The Optimizer
- PWA 支持：可安装为本地应用
- 提醒系统：喝水、休息、睡眠定时提醒
- 周报/月报：自动生成周期性总结
- 数据导出：JSON/CSV 格式

### Dashboard
- 里程碑追踪：连续记录、成就徽章
- 目标设定：个人目标追踪
- 时间线：按月浏览历史记录
- 分享卡片：生成精美状态分享图

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS, Lucide Icons |
| Backend | Python FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (dev) / PostgreSQL (prod) |
| AI | OpenAI GPT-4o Vision |
| Design | Glassmorphism, Dark Theme |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- OpenAI API Key (optional, has mock mode)

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
# Edit .env: set OPENAI_API_KEY, ADMIN_PASSWORD

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

## Project Structure

```
vibingu/
├── frontend/                 # Next.js 前端
│   ├── app/                  # 页面路由
│   ├── components/           # React 组件
│   ├── hooks/                # 自定义 Hooks
│   └── public/               # 静态资源 & PWA
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── routers/          # API 路由
│   │   ├── services/         # 业务逻辑
│   │   └── schemas/          # Pydantic 模型
│   └── requirements.txt
└── 项目文档.md                # 产品设计文档
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed` | POST | 多模态数据输入 |
| `/api/feed/history` | GET | 获取记录历史 |
| `/api/analytics/vibe/today` | GET | 今日 Vibe 评分 |
| `/api/analytics/trend` | GET | Vibe 趋势数据 |
| `/api/reports/weekly` | GET | 周报 |
| `/api/reports/milestones` | GET | 里程碑数据 |
| `/api/reports/export` | GET | 数据导出 |
| `/api/auth/login` | POST | 登录认证 |

## Screenshots

Coming soon...

## Roadmap

- [ ] 年度报告 PDF 生成
- [ ] 异常状态主动提醒
- [ ] 相似日历史对比
- [ ] 更丰富的数据可视化
- [ ] 多设备数据同步

## License

MIT License - feel free to use and modify.

---

*Built with love for a better life.*
