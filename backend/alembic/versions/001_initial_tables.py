"""Initial tables creation

Revision ID: 001_initial
Revises: 
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 daily_summary 表
    op.create_table(
        'daily_summary',
        sa.Column('date', sa.Date(), nullable=False, comment='日期'),
        sa.Column('wake_time', sa.DateTime(), nullable=True, comment='起床时间'),
        sa.Column('bed_time', sa.DateTime(), nullable=True, comment='入睡时间'),
        sa.Column('sleep_duration', sa.Float(), nullable=True, comment='睡眠时长(小时)'),
        sa.Column('screen_time', sa.Float(), nullable=True, comment='屏幕总时长(小时)'),
        sa.Column('vibe_score', sa.Integer(), nullable=True, comment='当日Vibing指数(0-100)'),
        sa.Column('energy_level', sa.Integer(), nullable=True, comment='主观能量值(1-10)'),
        sa.Column('daily_summary_text', sa.Text(), nullable=True, comment='AI生成的当天日记摘要'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('date')
    )

    # 创建输入类型枚举
    input_type_enum = postgresql.ENUM('IMAGE', 'TEXT', 'AUDIO', 'SCREENSHOT', name='inputtype', create_type=True)
    input_type_enum.create(op.get_bind(), checkfirst=True)

    # 创建分类枚举
    category_enum = postgresql.ENUM('SLEEP', 'DIET', 'SCREEN', 'ACTIVITY', 'MOOD', name='category', create_type=True)
    category_enum.create(op.get_bind(), checkfirst=True)

    # 创建 life_stream 表
    op.create_table(
        'life_stream',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='唯一标识'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True, comment='用户ID(为未来多用户预留)'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True, comment='发生时间'),
        sa.Column('input_type', sa.Enum('IMAGE', 'TEXT', 'AUDIO', 'SCREENSHOT', name='inputtype'), nullable=False, comment='输入类型'),
        sa.Column('category', sa.Enum('SLEEP', 'DIET', 'SCREEN', 'ACTIVITY', 'MOOD', name='category'), nullable=True, comment='分类'),
        sa.Column('raw_content', sa.Text(), nullable=True, comment='文字内容或图片URL'),
        sa.Column('meta_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='AI解析后的所有细节'),
        sa.Column('ai_insight', sa.Text(), nullable=True, comment='AI当时给出的一句话点评'),
        sa.PrimaryKeyConstraint('id')
    )

    # 创建索引
    op.create_index('ix_life_stream_created_at', 'life_stream', ['created_at'], unique=False)
    op.create_index('ix_life_stream_category', 'life_stream', ['category'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_life_stream_category', table_name='life_stream')
    op.drop_index('ix_life_stream_created_at', table_name='life_stream')
    op.drop_table('life_stream')
    op.drop_table('daily_summary')
    
    # 删除枚举类型
    op.execute('DROP TYPE IF EXISTS inputtype')
    op.execute('DROP TYPE IF EXISTS category')
