"""
图片存储服务 - Phase 3
管理图片的保存、压缩和访问
"""

import os
import base64
import uuid
import logging
from datetime import datetime
from typing import Optional, Tuple
from PIL import Image
import io

logger = logging.getLogger(__name__)


class ImageStorage:
    """图片存储服务"""
    
    # 默认存储路径
    DEFAULT_UPLOAD_DIR = "uploads"
    
    # 图片质量设置
    JPEG_QUALITY = 85
    MAX_SIZE = (1920, 1920)  # 最大尺寸
    THUMBNAIL_SIZE = (400, 400)  # 缩略图尺寸
    
    def __init__(self, upload_dir: Optional[str] = None):
        self.upload_dir = upload_dir or self.DEFAULT_UPLOAD_DIR
        self._ensure_upload_dir()
    
    def _ensure_upload_dir(self):
        """确保上传目录存在"""
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)
    
    def _get_date_path(self) -> str:
        """获取基于日期的子路径"""
        now = datetime.now()
        return f"{now.year}/{now.month:02d}"
    
    def _generate_filename(self, image_type: str, extension: str = "jpg") -> str:
        """生成唯一文件名"""
        unique_id = uuid.uuid4().hex[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{image_type}_{timestamp}_{unique_id}.{extension}"
    
    async def save_image(
        self,
        image_base64: str,
        image_type: str,
        compress: bool = True,
        create_thumbnail: bool = True,
    ) -> Tuple[str, Optional[str]]:
        """
        保存图片
        
        Args:
            image_base64: Base64 编码的图片
            image_type: 图片类型 (food/scenery/selfie/etc)
            compress: 是否压缩
            create_thumbnail: 是否创建缩略图
            
        Returns:
            (image_path, thumbnail_path)
        """
        try:
            # 解码图片
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))
            
            # 转换为 RGB（处理 PNG 透明通道）
            if image.mode in ('RGBA', 'P'):
                image = image.convert('RGB')
            
            # 压缩和调整大小
            if compress:
                image = self._resize_image(image, self.MAX_SIZE)
            
            # 生成路径
            date_path = self._get_date_path()
            full_dir = os.path.join(self.upload_dir, date_path)
            os.makedirs(full_dir, exist_ok=True)
            
            # 保存主图
            filename = self._generate_filename(image_type)
            image_path = os.path.join(date_path, filename)
            full_path = os.path.join(self.upload_dir, image_path)
            
            image.save(full_path, 'JPEG', quality=self.JPEG_QUALITY, optimize=True)
            
            # 创建缩略图
            thumbnail_path = None
            if create_thumbnail:
                thumbnail = self._resize_image(image.copy(), self.THUMBNAIL_SIZE)
                thumb_filename = f"thumb_{filename}"
                thumbnail_path = os.path.join(date_path, thumb_filename)
                thumb_full_path = os.path.join(self.upload_dir, thumbnail_path)
                thumbnail.save(thumb_full_path, 'JPEG', quality=75, optimize=True)
            
            return image_path, thumbnail_path
            
        except Exception as e:
            logger.error(f"图片保存错误: {e}")
            raise
    
    def _resize_image(self, image: Image.Image, max_size: Tuple[int, int]) -> Image.Image:
        """调整图片大小，保持比例"""
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        return image
    
    def get_image_url(self, image_path: str) -> str:
        """获取图片访问 URL"""
        return f"/uploads/{image_path}"
    
    def delete_image(self, image_path: str) -> bool:
        """删除图片"""
        try:
            full_path = os.path.join(self.upload_dir, image_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception as e:
            logger.error(f"删除图片错误: {e}")
            return False
    
    def get_storage_stats(self) -> dict:
        """获取存储统计"""
        total_size = 0
        file_count = 0
        
        for root, dirs, files in os.walk(self.upload_dir):
            for file in files:
                file_path = os.path.join(root, file)
                total_size += os.path.getsize(file_path)
                file_count += 1
        
        return {
            "total_files": file_count,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "upload_dir": self.upload_dir,
        }
