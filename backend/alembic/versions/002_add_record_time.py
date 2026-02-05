"""Add record_time column for actual event time

Revision ID: 002_add_record_time
Revises: 001_initial
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_record_time'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 添加 record_time 字段（实际发生时间，由 AI 分析得出）
    op.add_column('life_stream', 
        sa.Column('record_time', sa.DateTime(), nullable=True, 
                  comment='实际发生时间（AI分析得出，区别于提交时间 created_at）'))
    
    # 创建索引
    op.create_index('ix_life_stream_record_time', 'life_stream', ['record_time'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_life_stream_record_time', table_name='life_stream')
    op.drop_column('life_stream', 'record_time')
