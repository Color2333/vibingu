#!/bin/bash

# Vibing u - Docker Helper Commands
# Usage: ./scripts/docker-commands.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

case "$1" in
  dev)
    echo -e "${GREEN}Starting development environment...${NC}"
    docker-compose -f docker-compose.dev.yml up --build
    ;;
  
  dev-d)
    echo -e "${GREEN}Starting development environment (detached)...${NC}"
    docker-compose -f docker-compose.dev.yml up --build -d
    ;;
  
  prod)
    echo -e "${GREEN}Starting production environment...${NC}"
    docker-compose up --build
    ;;
  
  prod-full)
    echo -e "${GREEN}Starting production environment with Nginx...${NC}"
    docker-compose --profile production up --build
    ;;
  
  stop)
    echo -e "${YELLOW}Stopping all containers...${NC}"
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    ;;
  
  clean)
    echo -e "${RED}Cleaning up containers, volumes, and images...${NC}"
    docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
    docker-compose down -v 2>/dev/null || true
    docker image prune -f
    ;;
  
  logs)
    echo -e "${GREEN}Showing logs...${NC}"
    if [ -n "$2" ]; then
      docker-compose logs -f "$2"
    else
      docker-compose logs -f
    fi
    ;;
  
  logs-dev)
    echo -e "${GREEN}Showing development logs...${NC}"
    if [ -n "$2" ]; then
      docker-compose -f docker-compose.dev.yml logs -f "$2"
    else
      docker-compose -f docker-compose.dev.yml logs -f
    fi
    ;;
  
  shell-backend)
    echo -e "${GREEN}Opening shell in backend container...${NC}"
    docker exec -it vibingu-backend /bin/bash || docker exec -it vibingu-backend-dev /bin/sh
    ;;
  
  shell-frontend)
    echo -e "${GREEN}Opening shell in frontend container...${NC}"
    docker exec -it vibingu-frontend /bin/sh || docker exec -it vibingu-frontend-dev /bin/sh
    ;;
  
  build)
    echo -e "${GREEN}Building all images...${NC}"
    docker-compose build --no-cache
    ;;
  
  status)
    echo -e "${GREEN}Container status:${NC}"
    docker-compose ps
    docker-compose -f docker-compose.dev.yml ps 2>/dev/null || true
    ;;
  
  backup)
    echo -e "${GREEN}Backing up volumes...${NC}"
    BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup data volume
    docker run --rm -v vibingu-backend-data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/backend-data.tar.gz -C /data .
    docker run --rm -v vibingu-backend-uploads:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/backend-uploads.tar.gz -C /data .
    docker run --rm -v vibingu-chroma-data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/chroma-data.tar.gz -C /data .
    
    echo -e "${GREEN}Backup saved to: $BACKUP_DIR${NC}"
    ;;
  
  *)
    echo "Vibing u - Docker Helper Commands"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  dev           Start development environment (with hot reload)"
    echo "  dev-d         Start development environment (detached)"
    echo "  prod          Start production environment"
    echo "  prod-full     Start production environment with Nginx"
    echo "  stop          Stop all containers"
    echo "  clean         Clean up containers, volumes, and images"
    echo "  logs [svc]    Show logs (optionally for specific service)"
    echo "  logs-dev      Show development logs"
    echo "  shell-backend Open shell in backend container"
    echo "  shell-frontend Open shell in frontend container"
    echo "  build         Build all images (no cache)"
    echo "  status        Show container status"
    echo "  backup        Backup volumes to ./backups/"
    echo ""
    ;;
esac
