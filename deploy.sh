#!/bin/bash

#===============================================================================
# Vibing u - 一键部署脚本
# 适用于 CentOS 7.x 系统
# 使用方法: chmod +x deploy.sh && ./deploy.sh
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="vibingu"
PROJECT_DIR="/opt/vibingu"
COMPOSE_VERSION="2.24.0"
GITHUB_REPO="https://github.com/Color2333/vibingu.git"

# GitHub 镜像列表（国内加速）
GITHUB_MIRRORS=(
    "https://ghproxy.net/https://github.com"
    "https://mirror.ghproxy.com/https://github.com"
    "https://gh-proxy.com/https://github.com"
    "https://github.moeyy.xyz/https://github.com"
)

# 打印带颜色的消息
print_msg() {
    echo -e "${2}${1}${NC}"
}

print_header() {
    echo ""
    echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${CYAN}✨ Vibing u - Digitize Your Vibe${NC}                        ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}  ${YELLOW}一键部署脚本 for CentOS 7${NC}                               ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BLUE}▶ ${1}${NC}"
    echo -e "${BLUE}─────────────────────────────────────────${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# 测试 GitHub 连接并选择最佳镜像
test_github_connection() {
    print_step "测试 GitHub 连接"
    
    # 先测试直连
    print_msg "测试直连 GitHub..." "$CYAN"
    if curl -s --connect-timeout 5 https://github.com > /dev/null 2>&1; then
        print_success "GitHub 直连可用"
        GITHUB_URL="https://github.com/Color2333/vibingu.git"
        return 0
    fi
    
    print_warning "GitHub 直连不可用，尝试镜像加速..."
    
    # 测试镜像
    for mirror in "${GITHUB_MIRRORS[@]}"; do
        print_msg "测试镜像: ${mirror%/https://github.com}..." "$CYAN"
        if curl -s --connect-timeout 5 "${mirror}" > /dev/null 2>&1; then
            print_success "镜像可用: ${mirror%/https://github.com}"
            GITHUB_URL="${mirror}/Color2333/vibingu.git"
            return 0
        fi
    done
    
    print_error "所有 GitHub 镜像都不可用"
    return 1
}

# 从 GitHub 克隆或更新代码
clone_or_update_repo() {
    print_step "获取项目代码"
    
    # 测试连接
    if ! test_github_connection; then
        print_warning "无法访问 GitHub，请手动上传代码"
        return 1
    fi
    
    print_msg "使用地址: $GITHUB_URL" "$CYAN"
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        print_msg "检测到已有仓库，执行更新..." "$CYAN"
        cd "$PROJECT_DIR"
        
        # 更新远程地址（可能之前用的是其他镜像）
        git remote set-url origin "$GITHUB_URL" 2>/dev/null || true
        
        # 拉取最新代码
        if git pull origin main; then
            print_success "代码更新完成"
        else
            print_warning "更新失败，尝试重置..."
            git fetch origin
            git reset --hard origin/main
            print_success "代码已重置到最新版本"
        fi
    else
        print_msg "克隆项目代码..." "$CYAN"
        
        # 如果目录存在但不是 git 仓库，先备份
        if [ -d "$PROJECT_DIR" ] && [ "$(ls -A $PROJECT_DIR 2>/dev/null)" ]; then
            BACKUP_DIR="${PROJECT_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
            print_warning "备份现有文件到: $BACKUP_DIR"
            mv "$PROJECT_DIR" "$BACKUP_DIR"
        fi
        
        # 克隆仓库
        if git clone "$GITHUB_URL" "$PROJECT_DIR"; then
            print_success "代码克隆完成"
        else
            print_error "克隆失败"
            # 如果有备份，恢复
            if [ -d "$BACKUP_DIR" ]; then
                mv "$BACKUP_DIR" "$PROJECT_DIR"
                print_warning "已恢复备份文件"
            fi
            return 1
        fi
    fi
    
    return 0
}

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "请使用 root 用户运行此脚本"
        print_msg "使用: sudo ./deploy.sh" "$YELLOW"
        exit 1
    fi
}

# 检查系统版本
check_system() {
    print_step "检查系统环境"
    
    if [ -f /etc/centos-release ]; then
        OS_VERSION=$(cat /etc/centos-release)
        print_success "系统版本: $OS_VERSION"
    else
        print_warning "非 CentOS 系统，部分功能可能不兼容"
    fi
    
    KERNEL_VERSION=$(uname -r)
    print_success "内核版本: $KERNEL_VERSION"
    
    # 检查内存
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 2048 ]; then
        print_warning "内存小于 2GB，建议至少 2GB 内存"
    else
        print_success "内存: ${TOTAL_MEM}MB"
    fi
    
    # 检查磁盘空间
    DISK_AVAIL=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
    if [ "$DISK_AVAIL" -lt 10 ]; then
        print_warning "磁盘空间小于 10GB，建议至少 10GB"
    else
        print_success "可用磁盘: ${DISK_AVAIL}GB"
    fi
}

# 安装 Docker
install_docker() {
    print_step "安装 Docker"
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | tr -d ',')
        print_success "Docker 已安装: $DOCKER_VERSION"
    else
        print_msg "正在安装 Docker..." "$CYAN"
        
        # 卸载旧版本
        yum remove -y docker docker-client docker-client-latest \
            docker-common docker-latest docker-latest-logrotate \
            docker-logrotate docker-engine 2>/dev/null || true
        
        # 安装依赖
        yum install -y yum-utils device-mapper-persistent-data lvm2
        
        # 添加 Docker 仓库（使用阿里云镜像加速）
        yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
        
        # 安装 Docker
        yum install -y docker-ce docker-ce-cli containerd.io
        
        # 启动 Docker
        systemctl start docker
        systemctl enable docker
        
        print_success "Docker 安装完成"
    fi
    
    # 配置 Docker 镜像加速
    if [ ! -f /etc/docker/daemon.json ]; then
        print_msg "配置 Docker 镜像加速..." "$CYAN"
        mkdir -p /etc/docker
        cat > /etc/docker/daemon.json <<EOF
{
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://registry.docker-cn.com",
        "https://mirror.ccs.tencentyun.com"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    }
}
EOF
        systemctl daemon-reload
        systemctl restart docker
        print_success "Docker 镜像加速配置完成"
    fi
}

# 安装 Docker Compose
install_docker_compose() {
    print_step "安装 Docker Compose"
    
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        if docker compose version &> /dev/null; then
            COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "v2.x")
            print_success "Docker Compose (Plugin) 已安装: $COMPOSE_VER"
        else
            COMPOSE_VER=$(docker-compose --version | cut -d ' ' -f3 | tr -d ',')
            print_success "Docker Compose 已安装: $COMPOSE_VER"
        fi
    else
        print_msg "正在安装 Docker Compose..." "$CYAN"
        
        # 安装 Docker Compose Plugin
        yum install -y docker-compose-plugin 2>/dev/null || {
            # 如果插件安装失败，使用独立版本
            curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
                -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        }
        
        print_success "Docker Compose 安装完成"
    fi
}

# 创建项目目录
setup_project_dir() {
    print_step "设置项目目录"
    
    # 安装 git（如果没有）
    if ! command -v git &> /dev/null; then
        print_msg "安装 Git..." "$CYAN"
        yum install -y git
    fi
    
    # 询问获取代码的方式
    echo ""
    echo "请选择获取代码的方式:"
    echo "  1. 从 GitHub 自动拉取 (推荐，支持镜像加速)"
    echo "  2. 使用本地已有代码"
    echo "  3. 稍后手动上传"
    read -p "请选择 [1]: " CODE_SOURCE
    CODE_SOURCE=${CODE_SOURCE:-1}
    
    case $CODE_SOURCE in
        1)
            # 从 GitHub 拉取
            clone_or_update_repo
            ;;
        2)
            # 使用本地代码
            SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
                if [ "$SCRIPT_DIR" != "$PROJECT_DIR" ]; then
                    mkdir -p "$PROJECT_DIR"
                    print_msg "复制本地代码..." "$CYAN"
                    cp -r "$SCRIPT_DIR"/* "$PROJECT_DIR/" 2>/dev/null || true
                    cp -r "$SCRIPT_DIR"/.env* "$PROJECT_DIR/" 2>/dev/null || true
                    cp -r "$SCRIPT_DIR"/.git* "$PROJECT_DIR/" 2>/dev/null || true
                    print_success "项目文件已复制到 $PROJECT_DIR"
                else
                    print_success "已在项目目录中运行"
                fi
            else
                print_error "当前目录没有找到项目代码"
                print_msg "请将代码上传到服务器后重新运行脚本" "$YELLOW"
                exit 1
            fi
            ;;
        3)
            mkdir -p "$PROJECT_DIR"
            print_warning "请手动上传项目文件到 $PROJECT_DIR"
            print_msg "上传完成后，重新运行此脚本" "$YELLOW"
            exit 0
            ;;
    esac
    
    # 创建 SSL 目录
    mkdir -p "$PROJECT_DIR/nginx/ssl"
    
    cd "$PROJECT_DIR"
    print_success "项目目录: $PROJECT_DIR"
}

# 配置环境变量
configure_env() {
    print_step "配置环境变量"
    
    cd "$PROJECT_DIR"
    
    if [ -f ".env" ]; then
        print_warning ".env 文件已存在"
        read -p "是否重新配置? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        # 创建基础 .env 文件
        cat > .env <<'ENVFILE'
# Vibing u - Environment Configuration

# AI Provider 配置 ("openai" 或 "zhipu")
AI_PROVIDER=zhipu

# 智谱AI 配置 (推荐国内用户使用)
ZHIPU_API_KEY=your-zhipu-api-key-here
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# OpenAI 配置 (海外用户使用)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# 模型配置 (智谱AI)
VISION_MODEL=glm-4.6v-flash
TEXT_MODEL=glm-4.7-flash
SMART_MODEL=glm-4.7-flash
EMBEDDING_MODEL=embedding-3

# Database URL
DATABASE_URL=sqlite:///./data/vibingu.db

# Frontend API URL
NEXT_PUBLIC_API_URL=http://backend:8000

# Authentication
AUTH_PASSWORD=your-secure-password

# ChromaDB persistence directory
CHROMA_PERSIST_DIR=/app/chroma_db

# Upload directory
UPLOAD_DIR=/app/uploads

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://frontend:3000

# Debug mode
DEBUG=false

# Log level
LOG_LEVEL=INFO
ENVFILE
    fi
    
    echo ""
    print_msg "请配置以下必要参数:" "$CYAN"
    echo ""
    
    # AI 配置
    print_msg "1. AI 服务配置" "$YELLOW"
    echo "   推荐使用智谱AI (国内访问更稳定)"
    echo "   获取 API Key: https://open.bigmodel.cn/"
    echo ""
    read -p "请选择 AI 服务 (1=智谱AI, 2=OpenAI) [1]: " AI_CHOICE
    AI_CHOICE=${AI_CHOICE:-1}
    
    if [ "$AI_CHOICE" == "1" ]; then
        read -p "请输入智谱AI API Key: " ZHIPU_KEY
        if [ -n "$ZHIPU_KEY" ]; then
            sed -i "s/AI_PROVIDER=.*/AI_PROVIDER=zhipu/" .env
            sed -i "s/ZHIPU_API_KEY=.*/ZHIPU_API_KEY=$ZHIPU_KEY/" .env
        fi
    else
        read -p "请输入 OpenAI API Key: " OPENAI_KEY
        if [ -n "$OPENAI_KEY" ]; then
            sed -i "s/AI_PROVIDER=.*/AI_PROVIDER=openai/" .env
            sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_KEY/" .env
        fi
    fi
    
    # 登录密码
    echo ""
    print_msg "2. 登录密码配置" "$YELLOW"
    read -p "请设置登录密码 (留空使用默认): " AUTH_PASS
    if [ -n "$AUTH_PASS" ]; then
        sed -i "s/AUTH_PASSWORD=.*/AUTH_PASSWORD=$AUTH_PASS/" .env
    fi
    
    # 获取服务器 IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    print_success "服务器 IP: $SERVER_IP"
    
    # 更新 CORS
    sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:3000,http://frontend:3000,http://$SERVER_IP,http://$SERVER_IP:3000|" .env
    
    print_success "环境变量配置完成"
}

# 配置防火墙
configure_firewall() {
    print_step "配置防火墙"
    
    if command -v firewall-cmd &> /dev/null; then
        # 检查防火墙状态
        if systemctl is-active --quiet firewalld; then
            print_msg "开放必要端口..." "$CYAN"
            firewall-cmd --permanent --add-port=80/tcp
            firewall-cmd --permanent --add-port=443/tcp
            firewall-cmd --permanent --add-port=3000/tcp
            firewall-cmd --permanent --add-port=8000/tcp
            firewall-cmd --reload
            print_success "防火墙配置完成"
        else
            print_warning "防火墙未运行"
        fi
    else
        print_warning "未检测到 firewalld，请手动配置防火墙"
    fi
}

# 生成自签名 SSL 证书
generate_ssl() {
    print_step "SSL 证书配置"
    
    SSL_DIR="$PROJECT_DIR/nginx/ssl"
    
    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
        print_success "SSL 证书已存在"
        return
    fi
    
    echo "SSL 证书选项:"
    echo "  1. 生成自签名证书 (开发/测试用)"
    echo "  2. 稍后手动配置 (生产环境推荐使用 Let's Encrypt)"
    echo "  3. 跳过 SSL 配置 (仅使用 HTTP)"
    read -p "请选择 [1]: " SSL_CHOICE
    SSL_CHOICE=${SSL_CHOICE:-1}
    
    case $SSL_CHOICE in
        1)
            print_msg "生成自签名证书..." "$CYAN"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$SSL_DIR/key.pem" \
                -out "$SSL_DIR/cert.pem" \
                -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
            print_success "自签名证书已生成"
            print_warning "自签名证书仅用于测试，生产环境请使用正规证书"
            ;;
        2)
            print_msg "请将证书文件放置到: $SSL_DIR/" "$YELLOW"
            print_msg "  - cert.pem (证书文件)" "$YELLOW"
            print_msg "  - key.pem (私钥文件)" "$YELLOW"
            ;;
        3)
            print_warning "跳过 SSL 配置，将仅使用 HTTP"
            ;;
    esac
}

# 更新 docker-compose.yml 以适应生产环境
update_compose() {
    print_step "优化 Docker Compose 配置"
    
    cd "$PROJECT_DIR"
    
    # 创建生产环境配置覆盖文件
    cat > docker-compose.prod.yml <<'COMPOSE'
version: '3.8'

services:
  backend:
    environment:
      - DATABASE_URL=sqlite:///./data/vibingu.db
      - CORS_ORIGINS=${CORS_ORIGINS}
      - AI_PROVIDER=${AI_PROVIDER}
      - ZHIPU_API_KEY=${ZHIPU_API_KEY}
      - ZHIPU_BASE_URL=${ZHIPU_BASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL}
      - VISION_MODEL=${VISION_MODEL}
      - TEXT_MODEL=${TEXT_MODEL}
      - SMART_MODEL=${SMART_MODEL}
      - EMBEDDING_MODEL=${EMBEDDING_MODEL}
      - AUTH_PASSWORD=${AUTH_PASSWORD}
      - DEBUG=false
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  frontend:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  nginx:
    profiles: []
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
COMPOSE
    
    print_success "生产环境配置已创建"
}

# 创建 HTTP-only nginx 配置
create_http_nginx() {
    print_step "创建 HTTP-only Nginx 配置"
    
    cat > "$PROJECT_DIR/nginx/nginx.conf" <<'NGINX'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;

    upstream frontend {
        server frontend:3000;
        keepalive 32;
    }

    upstream backend {
        server backend:8000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Frontend
        location / {
            limit_req zone=general burst=50 nodelay;
            
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Health check
        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }
    }
}
NGINX
    
    print_success "HTTP-only Nginx 配置已创建"
}

# 构建和启动服务
start_services() {
    print_step "构建和启动服务"
    
    cd "$PROJECT_DIR"
    
    # 检查是否有 SSL 证书
    if [ ! -f "nginx/ssl/cert.pem" ]; then
        print_msg "未检测到 SSL 证书，使用 HTTP-only 模式" "$YELLOW"
        create_http_nginx
    fi
    
    print_msg "拉取基础镜像..." "$CYAN"
    
    # 使用 docker compose 或 docker-compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    # 构建镜像
    print_msg "构建应用镜像 (这可能需要几分钟)..." "$CYAN"
    $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
    
    # 启动服务
    print_msg "启动服务..." "$CYAN"
    $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    # 等待服务启动
    print_msg "等待服务启动..." "$CYAN"
    sleep 10
    
    # 检查服务状态
    print_msg "检查服务状态..." "$CYAN"
    $COMPOSE_CMD ps
}

# 健康检查
health_check() {
    print_step "服务健康检查"
    
    # 等待更多时间让服务完全启动
    sleep 5
    
    # 检查后端
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        print_success "后端服务: 正常"
    else
        print_warning "后端服务: 启动中..."
    fi
    
    # 检查前端
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "前端服务: 正常"
    else
        print_warning "前端服务: 启动中..."
    fi
    
    # 检查 Nginx
    if curl -s http://localhost/health > /dev/null 2>&1; then
        print_success "Nginx 代理: 正常"
    else
        print_warning "Nginx 代理: 启动中..."
    fi
}

# 创建管理脚本
create_management_scripts() {
    print_step "创建管理脚本"
    
    cd "$PROJECT_DIR"
    
    # 创建 scripts 目录
    mkdir -p scripts
    
    # 启动脚本
    cat > scripts/start.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
echo "服务已启动"
SCRIPT
    
    # 停止脚本
    cat > scripts/stop.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
echo "服务已停止"
SCRIPT
    
    # 重启脚本
    cat > scripts/restart.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart
echo "服务已重启"
SCRIPT
    
    # 日志查看脚本
    cat > scripts/logs.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu
SERVICE=${1:-""}
if [ -z "$SERVICE" ]; then
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100
else
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100 $SERVICE
fi
SCRIPT
    
    # 更新脚本（支持 GitHub 镜像加速）
    cat > scripts/update.sh <<'SCRIPT'
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd /opt/vibingu

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Vibing u 更新脚本${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# GitHub 镜像列表
GITHUB_MIRRORS=(
    "https://ghproxy.net/https://github.com"
    "https://mirror.ghproxy.com/https://github.com"
    "https://gh-proxy.com/https://github.com"
    "https://github.moeyy.xyz/https://github.com"
)

# 测试并选择可用的 GitHub 地址
select_github_url() {
    # 先测试直连
    if curl -s --connect-timeout 3 https://github.com > /dev/null 2>&1; then
        echo "https://github.com/Color2333/vibingu.git"
        return 0
    fi
    
    # 测试镜像
    for mirror in "${GITHUB_MIRRORS[@]}"; do
        if curl -s --connect-timeout 3 "${mirror}" > /dev/null 2>&1; then
            echo "${mirror}/Color2333/vibingu.git"
            return 0
        fi
    done
    
    return 1
}

echo -e "${YELLOW}[1/4] 检测 GitHub 连接...${NC}"
GITHUB_URL=$(select_github_url)
if [ -z "$GITHUB_URL" ]; then
    echo -e "${RED}无法连接到 GitHub，请检查网络${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 使用: ${GITHUB_URL}${NC}"

echo ""
echo -e "${YELLOW}[2/4] 拉取最新代码...${NC}"
if [ -d ".git" ]; then
    git remote set-url origin "$GITHUB_URL" 2>/dev/null || true
    git fetch origin
    git reset --hard origin/main
    echo -e "${GREEN}✓ 代码已更新${NC}"
else
    echo -e "${RED}未检测到 git 仓库${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}[3/4] 重新构建镜像...${NC}"
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
echo -e "${GREEN}✓ 镜像构建完成${NC}"

echo ""
echo -e "${YELLOW}[4/4] 重启服务...${NC}"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ 服务已重启${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  更新完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
SCRIPT
    
    # 快速更新脚本（仅拉取代码，不重新构建）
    cat > scripts/quick-update.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu

# GitHub 镜像列表
GITHUB_MIRRORS=(
    "https://ghproxy.net/https://github.com"
    "https://mirror.ghproxy.com/https://github.com"
    "https://gh-proxy.com/https://github.com"
)

# 选择可用地址
for mirror in "" "${GITHUB_MIRRORS[@]}"; do
    if [ -z "$mirror" ]; then
        URL="https://github.com/Color2333/vibingu.git"
        TEST_URL="https://github.com"
    else
        URL="${mirror}/Color2333/vibingu.git"
        TEST_URL="${mirror}"
    fi
    
    if curl -s --connect-timeout 3 "$TEST_URL" > /dev/null 2>&1; then
        git remote set-url origin "$URL" 2>/dev/null || true
        echo "使用: $URL"
        git pull origin main
        echo "代码更新完成（无需重启，静态文件已更新）"
        exit 0
    fi
done

echo "无法连接 GitHub"
exit 1
SCRIPT

    # 备份脚本
    cat > scripts/backup.sh <<'SCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/vibingu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

echo "备份数据..."
docker run --rm \
    -v vibingu-backend-data:/data \
    -v $BACKUP_DIR:/backup \
    alpine tar czf /backup/data_$DATE.tar.gz -C /data .

docker run --rm \
    -v vibingu-backend-uploads:/uploads \
    -v $BACKUP_DIR:/backup \
    alpine tar czf /backup/uploads_$DATE.tar.gz -C /uploads .

echo "备份完成: $BACKUP_DIR"
ls -la $BACKUP_DIR
SCRIPT
    
    # 状态检查脚本
    cat > scripts/status.sh <<'SCRIPT'
#!/bin/bash
cd /opt/vibingu
echo "=== 容器状态 ==="
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
echo ""
echo "=== 健康检查 ==="
curl -s http://localhost/health && echo " - Nginx OK" || echo " - Nginx 异常"
curl -s http://localhost:8000/api/health && echo " - Backend OK" || echo " - Backend 异常"
curl -s http://localhost:3000 > /dev/null && echo " - Frontend OK" || echo " - Frontend 异常"
echo ""
echo "=== 资源使用 ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
SCRIPT
    
    # 配置 Git 镜像脚本
    cat > scripts/setup-git-mirror.sh <<'SCRIPT'
#!/bin/bash
# 配置 Git 使用镜像加速

echo "配置 Git 镜像加速..."

# 设置 Git 代理（使用 ghproxy）
git config --global url."https://ghproxy.net/https://github.com/".insteadOf "https://github.com/"

echo "Git 镜像配置完成"
echo "现在可以直接使用 git clone https://github.com/xxx 了"
echo ""
echo "如需取消镜像，运行:"
echo "  git config --global --unset url.https://ghproxy.net/https://github.com/.insteadOf"
SCRIPT

    chmod +x scripts/*.sh
    
    print_success "管理脚本已创建"
    print_msg "可用命令:" "$CYAN"
    echo "  ./scripts/start.sh        - 启动服务"
    echo "  ./scripts/stop.sh         - 停止服务"
    echo "  ./scripts/restart.sh      - 重启服务"
    echo "  ./scripts/logs.sh         - 查看日志"
    echo "  ./scripts/status.sh       - 检查状态"
    echo "  ./scripts/backup.sh       - 备份数据"
    echo "  ./scripts/update.sh       - 完整更新（拉取+构建+重启）"
    echo "  ./scripts/quick-update.sh - 快速更新（仅拉取代码）"
}

# 显示部署完成信息
show_completion() {
    SERVER_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}✨ 部署完成！${NC}                                           ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}访问地址:${NC}"
    echo -e "  本地访问: ${CYAN}http://localhost${NC}"
    echo -e "  远程访问: ${CYAN}http://$SERVER_IP${NC}"
    echo ""
    echo -e "${YELLOW}管理命令:${NC}"
    echo -e "  查看状态: ${CYAN}cd $PROJECT_DIR && ./scripts/status.sh${NC}"
    echo -e "  查看日志: ${CYAN}cd $PROJECT_DIR && ./scripts/logs.sh${NC}"
    echo -e "  重启服务: ${CYAN}cd $PROJECT_DIR && ./scripts/restart.sh${NC}"
    echo -e "  更新版本: ${CYAN}cd $PROJECT_DIR && ./scripts/update.sh${NC}"
    echo -e "  备份数据: ${CYAN}cd $PROJECT_DIR && ./scripts/backup.sh${NC}"
    echo ""
    echo -e "${YELLOW}配置文件:${NC}"
    echo -e "  环境变量: ${CYAN}$PROJECT_DIR/.env${NC}"
    echo -e "  Nginx:    ${CYAN}$PROJECT_DIR/nginx/nginx.conf${NC}"
    echo ""
    echo -e "${YELLOW}数据位置:${NC}"
    echo -e "  数据库:   ${CYAN}Docker Volume: vibingu-backend-data${NC}"
    echo -e "  上传文件: ${CYAN}Docker Volume: vibingu-backend-uploads${NC}"
    echo ""
    echo -e "${YELLOW}GitHub 仓库:${NC}"
    echo -e "  ${CYAN}https://github.com/Color2333/vibingu${NC}"
    echo ""
    print_warning "首次启动可能需要 1-2 分钟，请稍后再访问"
    echo ""
}

# 主函数
main() {
    print_header
    check_root
    check_system
    install_docker
    install_docker_compose
    setup_project_dir
    configure_env
    configure_firewall
    generate_ssl
    update_compose
    start_services
    create_management_scripts
    health_check
    show_completion
}

# 运行主函数
main "$@"
