# Vibing u 部署指南

## 快速开始

### 方法 1：服务器自动拉取（推荐）

直接在服务器上运行部署脚本，会自动从 GitHub 拉取代码（支持国内镜像加速）：

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 下载部署脚本
curl -O https://ghproxy.net/https://raw.githubusercontent.com/Color2333/vibingu/main/deploy.sh
# 或使用其他镜像
curl -O https://mirror.ghproxy.com/https://raw.githubusercontent.com/Color2333/vibingu/main/deploy.sh

# 执行部署
chmod +x deploy.sh
./deploy.sh
# 选择 "1. 从 GitHub 自动拉取"
```

### 方法 2：本地上传后部署

```bash
# 在本地电脑执行，上传项目到服务器
scp -r ./BioClock root@your-server-ip:/opt/vibingu

# SSH 登录服务器
ssh root@your-server-ip
cd /opt/vibingu

# 执行部署
chmod +x deploy.sh
./deploy.sh
# 选择 "2. 使用本地已有代码"
```

### 3. 按照提示配置

部署脚本会引导你完成以下配置：
- AI 服务选择（推荐智谱AI，国内访问更稳定）
- API Key 配置
- 登录密码设置
- SSL 证书配置

---

## 手动部署步骤

如果一键脚本出现问题，可以按以下步骤手动部署：

### 1. 安装 Docker

```bash
# CentOS 7
yum install -y yum-utils
yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
systemctl start docker
systemctl enable docker
```

### 2. 配置 Docker 镜像加速

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://registry.docker-cn.com"
    ]
}
EOF
systemctl daemon-reload
systemctl restart docker
```

### 3. 配置环境变量

```bash
cd /opt/vibingu
cp .env.example .env
vim .env  # 编辑配置文件
```

必须配置的变量：
```env
# 选择 AI 服务
AI_PROVIDER=zhipu

# 智谱AI API Key (推荐)
ZHIPU_API_KEY=your-api-key

# 登录密码
AUTH_PASSWORD=your-password
```

### 4. 构建并启动

```bash
# 构建镜像
docker compose build

# 启动服务（开发模式，不含 Nginx）
docker compose up -d

# 启动服务（生产模式，含 Nginx）
docker compose --profile production up -d
```

---

## 日常运维

### 查看服务状态

```bash
cd /opt/vibingu
./scripts/status.sh

# 或直接使用 docker compose
docker compose ps
```

### 查看日志

```bash
# 查看所有日志
./scripts/logs.sh

# 查看特定服务日志
./scripts/logs.sh backend
./scripts/logs.sh frontend
./scripts/logs.sh nginx
```

### 重启服务

```bash
./scripts/restart.sh

# 或
docker compose restart
```

### 更新部署

```bash
# 完整更新（推荐）- 自动处理 GitHub 镜像
./scripts/update.sh

# 快速更新（仅拉取代码，不重新构建）
./scripts/quick-update.sh

# 手动更新
docker compose build --no-cache
docker compose up -d
```

---

## GitHub 镜像加速（国内服务器）

部署脚本会自动测试并选择可用的 GitHub 镜像，支持的镜像包括：
- `ghproxy.net` - GitHub 代理
- `mirror.ghproxy.com` - GitHub 镜像
- `gh-proxy.com` - GitHub 代理
- `github.moeyy.xyz` - GitHub 镜像

### 手动配置 Git 全局镜像

如果需要在服务器上长期使用 Git，可以配置全局镜像：

```bash
# 配置镜像加速
./scripts/setup-git-mirror.sh

# 或手动配置
git config --global url."https://ghproxy.net/https://github.com/".insteadOf "https://github.com/"

# 取消镜像配置
git config --global --unset url.https://ghproxy.net/https://github.com/.insteadOf
```

### 手动克隆项目（使用镜像）

```bash
# 使用 ghproxy 镜像
git clone https://ghproxy.net/https://github.com/Color2333/vibingu.git

# 使用其他镜像
git clone https://mirror.ghproxy.com/https://github.com/Color2333/vibingu.git
```

### 备份数据

```bash
./scripts/backup.sh

# 备份文件保存在 /opt/vibingu/backups/
```

---

## SSL/HTTPS 配置

### 使用 Let's Encrypt (推荐)

```bash
# 安装 certbot
yum install -y epel-release
yum install -y certbot

# 获取证书（需要先停止 nginx 或使用 webroot 模式）
docker compose stop nginx
certbot certonly --standalone -d yourdomain.com

# 复制证书
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/vibingu/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/vibingu/nginx/ssl/key.pem

# 重启 nginx
docker compose start nginx
```

### 自动续期

```bash
# 添加定时任务
echo "0 0 1 * * root certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/vibingu/nginx/ssl/cert.pem && cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/vibingu/nginx/ssl/key.pem && docker compose -f /opt/vibingu/docker-compose.yml restart nginx" >> /etc/crontab
```

---

## 常见问题

### Q: 构建镜像很慢？

配置 npm 和 pip 国内镜像：

```bash
# 已在 Dockerfile 中配置，如需手动配置：
# npm
npm config set registry https://registry.npmmirror.com

# pip (在 requirements.txt 同目录创建 pip.conf)
mkdir -p ~/.pip
echo "[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn" > ~/.pip/pip.conf
```

### Q: 端口被占用？

```bash
# 查看端口占用
netstat -tlnp | grep -E '80|443|3000|8000'

# 修改端口映射 (编辑 docker-compose.yml)
ports:
  - "8080:80"  # 将 80 改为 8080
```

### Q: 服务无法启动？

```bash
# 查看详细日志
docker compose logs -f

# 检查 Docker 状态
systemctl status docker

# 重建容器
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Q: 内存不足？

```bash
# 查看内存使用
free -m
docker stats --no-stream

# 添加 Swap（如果物理内存小于 2GB）
dd if=/dev/zero of=/swapfile bs=1M count=2048
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
```

### Q: 如何迁移数据？

```bash
# 导出 Docker Volume 数据
docker run --rm -v vibingu-backend-data:/data -v $(pwd):/backup alpine tar czf /backup/data.tar.gz -C /data .
docker run --rm -v vibingu-backend-uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /uploads .

# 在新服务器导入
docker volume create vibingu-backend-data
docker volume create vibingu-backend-uploads
docker run --rm -v vibingu-backend-data:/data -v $(pwd):/backup alpine tar xzf /backup/data.tar.gz -C /data
docker run --rm -v vibingu-backend-uploads:/uploads -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /uploads
```

---

## 服务端口说明

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Backend | 8000 | 8000 | API 服务 |
| Frontend | 3000 | 3000 | Web 界面 |
| Nginx | 80/443 | 80/443 | 反向代理 |

---

## 监控与告警

### 简单健康检查脚本

```bash
#!/bin/bash
# /opt/vibingu/scripts/health-monitor.sh

check_service() {
    if ! curl -s "$1" > /dev/null 2>&1; then
        echo "[$(date)] $2 服务异常" >> /var/log/vibingu-monitor.log
        # 可添加邮件/钉钉通知
    fi
}

check_service "http://localhost/health" "Nginx"
check_service "http://localhost:8000/api/health" "Backend"
check_service "http://localhost:3000" "Frontend"
```

添加定时任务：
```bash
# 每 5 分钟检查一次
*/5 * * * * /opt/vibingu/scripts/health-monitor.sh
```

---

## 联系支持

如有问题，请通过以下方式获取帮助：
- 查看日志: `./scripts/logs.sh`
- GitHub Issues
- 项目文档

祝你 Vibing 愉快！ ✨
