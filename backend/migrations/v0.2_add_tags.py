"""
v0.2 数据库迁移脚本
添加 tags 和 dimension_scores 列到 life_stream 表
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
    
    # 添加 tags 列
    if "tags" not in columns:
        try:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN tags TEXT")
            migrations_done.append("tags")
            print("✅ 添加 tags 列成功")
        except sqlite3.OperationalError as e:
            print(f"❌ 添加 tags 列失败: {e}")
    else:
        print("ℹ️ tags 列已存在")
    
    # 添加 dimension_scores 列
    if "dimension_scores" not in columns:
        try:
            cursor.execute("ALTER TABLE life_stream ADD COLUMN dimension_scores TEXT")
            migrations_done.append("dimension_scores")
            print("✅ 添加 dimension_scores 列成功")
        except sqlite3.OperationalError as e:
            print(f"❌ 添加 dimension_scores 列失败: {e}")
    else:
        print("ℹ️ dimension_scores 列已存在")
    
    # 创建 token_usage 表
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                model VARCHAR(50) NOT NULL,
                model_type VARCHAR(20) NOT NULL,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                estimated_cost FLOAT DEFAULT 0.0,
                task_type VARCHAR(30) NOT NULL,
                task_description VARCHAR(200),
                related_record_id VARCHAR(50)
            )
        """)
        print("✅ token_usage 表创建/确认成功")
        migrations_done.append("token_usage_table")
    except sqlite3.OperationalError as e:
        print(f"❌ 创建 token_usage 表失败: {e}")
    
    conn.commit()
    conn.close()
    
    if migrations_done:
        print(f"\n迁移完成: {', '.join(migrations_done)}")
    else:
        print("\n没有需要执行的迁移")
    
    return True


if __name__ == "__main__":
    migrate()
