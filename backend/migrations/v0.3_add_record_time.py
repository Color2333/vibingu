"""
v0.3 数据库迁移脚本
添加 record_time 列到 life_stream 表
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
    
    # 添加 record_time 列（实际发生时间）
    if "record_time" not in columns:
        try:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN record_time DATETIME")
            migrations_done.append("record_time")
            print("✅ 添加 record_time 列成功")
        except sqlite3.OperationalError as e:
            print(f"❌ 添加 record_time 列失败: {e}")
    else:
        print("ℹ️ record_time 列已存在")
    
    conn.commit()
    conn.close()
    
    if migrations_done:
        print(f"\n迁移完成: {', '.join(migrations_done)}")
    else:
        print("\n没有需要执行的迁移")
    
    return True


if __name__ == "__main__":
    migrate()
