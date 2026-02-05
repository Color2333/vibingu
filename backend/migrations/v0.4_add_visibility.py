"""
v0.4 数据库迁移脚本
添加 is_public 和 is_deleted 列到 life_stream 表
"""
import sqlite3
import os

def migrate():
    """执行迁移"""
    db_path = os.path.join(os.path.dirname(__file__), "..", "vibingu.db")
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查列是否已存在
    cursor.execute("PRAGMA table_info(life_stream)")
    columns = [col[1] for col in cursor.fetchall()]
    
    migrations_done = []
    
    # 添加 is_public 列
    if "is_public" not in columns:
        try:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN is_public BOOLEAN DEFAULT 0")
            migrations_done.append("is_public")
            print("✅ 添加 is_public 列成功")
        except sqlite3.OperationalError as e:
            print(f"❌ 添加 is_public 列失败: {e}")
    else:
        print("ℹ️ is_public 列已存在")
    
    # 添加 is_deleted 列
    if "is_deleted" not in columns:
        try:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN is_deleted BOOLEAN DEFAULT 0")
            migrations_done.append("is_deleted")
            print("✅ 添加 is_deleted 列成功")
        except sqlite3.OperationalError as e:
            print(f"❌ 添加 is_deleted 列失败: {e}")
    else:
        print("ℹ️ is_deleted 列已存在")
    
    conn.commit()
    conn.close()
    
    if migrations_done:
        print(f"\n迁移完成: {', '.join(migrations_done)}")
    else:
        print("\n没有需要执行的迁移")
    
    return True


if __name__ == "__main__":
    migrate()
