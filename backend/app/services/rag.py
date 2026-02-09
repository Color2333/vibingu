"""RAG (Retrieval-Augmented Generation) 服务

基于 ChromaDB 的个人知识库系统：
1. 将生活记录向量化并索引
2. 支持语义搜索
3. 结合 LLM 生成个性化回答

增强版 v0.2:
- 时间感知的上下文构建
- 对话历史支持
- 智能摘要生成
- 主题聚合分析
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import chromadb
from chromadb.config import Settings
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import LifeStream
from app.config import get_settings

logger = logging.getLogger(__name__)


settings = get_settings()


class RAGService:
    """RAG 服务 - 个人知识库"""
    
    def __init__(self, persist_dir: str = None):
        # 使用配置中的目录，或传入的目录，或默认值
        self.persist_dir = persist_dir or settings.get_chroma_persist_dir()
        os.makedirs(self.persist_dir, exist_ok=True)
        
        # 初始化 ChromaDB
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        
        # 获取或创建集合
        self.collection = self.client.get_or_create_collection(
            name="life_records",
            metadata={"description": "Personal life records for RAG"}
        )
        
        # AI 客户端 (支持 OpenAI 或 智谱AI)
        api_key = settings.get_ai_api_key()
        base_url = settings.get_ai_base_url()
        self.openai_client = OpenAI(api_key=api_key, base_url=base_url)
        self.embedding_model = settings.embedding_model
        self.smart_model = settings.smart_model  # 用于问答的高级模型
        
        # 数据库
        self.db: Session = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    # ========== 索引管理 ==========
    
    def index_record(self, record: LifeStream) -> bool:
        """将单条记录索引到向量数据库"""
        try:
            # 构建文档内容
            doc_text = self._build_document_text(record)
            if not doc_text:
                return False
            
            # 生成嵌入向量
            embedding = self._get_embedding(doc_text)
            if not embedding:
                return False
            
            # 构建元数据
            metadata = {
                "record_id": str(record.id),
                "category": record.category or "UNKNOWN",
                "sub_categories": ",".join(record.sub_categories) if record.sub_categories else "",
                "created_at": record.created_at.isoformat() if record.created_at else "",
                "date": record.created_at.strftime("%Y-%m-%d") if record.created_at else "",
                "hour": record.created_at.hour if record.created_at else 0,
            }
            
            # 添加标签
            if record.tags:
                metadata["tags"] = ",".join(record.tags[:10])  # 限制标签数量
            
            # 添加到 ChromaDB
            self.collection.upsert(
                ids=[str(record.id)],
                embeddings=[embedding],
                documents=[doc_text],
                metadatas=[metadata]
            )
            
            return True
        except Exception as e:
            logger.error(f"索引记录失败: {e}")
            return False
    
    def remove_record(self, record_id: str) -> bool:
        """从向量数据库中删除指定记录"""
        try:
            self.collection.delete(ids=[str(record_id)])
            logger.info(f"已从 RAG 索引中删除记录: {record_id}")
            return True
        except Exception as e:
            logger.warning(f"从 RAG 索引删除记录失败 (id={record_id}): {e}")
            return False

    def index_all_records(self, batch_size: int = 100) -> Dict[str, Any]:
        """索引所有未删除的记录"""
        records = self.db.query(LifeStream).filter(
            LifeStream.is_deleted != True
        ).order_by(LifeStream.created_at.desc()).all()
        
        indexed = 0
        failed = 0
        
        for record in records:
            if self.index_record(record):
                indexed += 1
            else:
                failed += 1
        
        return {
            "total": len(records),
            "indexed": indexed,
            "failed": failed,
            "collection_count": self.collection.count()
        }
    
    def index_recent_records(self, days: int = 7) -> Dict[str, Any]:
        """索引最近的记录"""
        start_date = datetime.now() - timedelta(days=days)
        
        records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_date,
            LifeStream.is_deleted != True,
        ).all()
        
        indexed = 0
        for record in records:
            if self.index_record(record):
                indexed += 1
        
        return {
            "period_days": days,
            "total": len(records),
            "indexed": indexed,
            "collection_count": self.collection.count()
        }
    
    def _build_document_text(self, record: LifeStream) -> str:
        """构建用于索引的文档文本"""
        parts = []
        
        # 时间信息
        if record.created_at:
            date_str = record.created_at.strftime("%Y年%m月%d日 %H:%M")
            weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][record.created_at.weekday()]
            parts.append(f"时间: {date_str} {weekday}")
        
        # 类别
        category_names = {
            "SLEEP": "睡眠",
            "DIET": "饮食",
            "ACTIVITY": "运动",
            "SCREEN": "屏幕使用",
            "MOOD": "心情",
            "SOCIAL": "社交",
            "WORK": "工作",
            "GROWTH": "学习成长",
            "LEISURE": "休闲"
        }
        if record.category:
            parts.append(f"类别: {category_names.get(record.category, record.category)}")
        
        # 原始内容
        if record.raw_content:
            parts.append(f"内容: {record.raw_content}")
        
        # AI 洞察
        if record.ai_insight:
            parts.append(f"洞察: {record.ai_insight}")
        
        # 标签
        if record.tags:
            parts.append(f"标签: {', '.join(record.tags)}")
        
        # 维度得分
        if record.dimension_scores:
            scores = []
            dim_names = {
                "body": "身体",
                "mood": "心情",
                "social": "社交",
                "work": "工作",
                "growth": "成长",
                "meaning": "意义",
                "digital": "数字健康",
                "leisure": "休闲"
            }
            for dim, score in record.dimension_scores.items():
                if score and score > 0:
                    scores.append(f"{dim_names.get(dim, dim)}: {score:.0f}")
            if scores:
                parts.append(f"维度得分: {', '.join(scores)}")
        
        return "\n".join(parts)
    
    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """获取文本的嵌入向量"""
        try:
            response = self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"获取嵌入向量失败: {e}")
            return None
    
    # ========== 语义搜索 ==========
    
    def search(
        self, 
        query: str, 
        n_results: int = 5,
        category: Optional[str] = None,
        date_range: Optional[tuple] = None
    ) -> List[Dict[str, Any]]:
        """语义搜索"""
        try:
            # 获取查询向量
            query_embedding = self._get_embedding(query)
            if not query_embedding:
                return []
            
            # 构建过滤条件（category 同时匹配主分类和副分类）
            where_filter = None
            if category:
                where_filter = {
                    "$or": [
                        {"category": category},
                        {"sub_categories": {"$contains": category}},
                    ]
                }
            
            # 搜索
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
            
            # 格式化结果
            formatted = []
            if results and results["ids"] and results["ids"][0]:
                for i, doc_id in enumerate(results["ids"][0]):
                    formatted.append({
                        "id": doc_id,
                        "document": results["documents"][0][i] if results["documents"] else "",
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                        "relevance": 1 - (results["distances"][0][i] if results["distances"] else 0)
                    })
            
            return formatted
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def find_similar_days(self, date: Optional[datetime] = None, n_results: int = 5) -> List[Dict[str, Any]]:
        """找出相似的日子"""
        if date is None:
            date = datetime.now()
        
        # 获取目标日期的记录
        start_time = datetime.combine(date.date(), datetime.min.time())
        end_time = datetime.combine(date.date() + timedelta(days=1), datetime.min.time())
        
        day_records = self.db.query(LifeStream).filter(
            LifeStream.created_at >= start_time,
            LifeStream.created_at < end_time
        ).all()
        
        if not day_records:
            return []
        
        # 构建当天的总结文档
        day_summary_parts = []
        for r in day_records:
            if r.raw_content:
                day_summary_parts.append(r.raw_content)
            if r.category:
                day_summary_parts.append(f"[{r.category}]")
        
        day_summary = " ".join(day_summary_parts)
        
        # 搜索相似的记录
        results = self.search(day_summary, n_results=n_results * 3)
        
        # 按日期聚合，排除当天
        date_str = date.strftime("%Y-%m-%d")
        day_scores: Dict[str, float] = {}
        day_docs: Dict[str, List[str]] = {}
        
        for r in results:
            r_date = r["metadata"].get("date", "")
            if r_date and r_date != date_str:
                if r_date not in day_scores:
                    day_scores[r_date] = 0
                    day_docs[r_date] = []
                day_scores[r_date] += r["relevance"]
                day_docs[r_date].append(r["document"][:100])
        
        # 排序返回
        similar_days = [
            {
                "date": d,
                "similarity_score": round(score, 2),
                "sample_content": day_docs[d][:2]
            }
            for d, score in sorted(day_scores.items(), key=lambda x: x[1], reverse=True)[:n_results]
        ]
        
        return similar_days
    
    # ========== RAG 问答 ==========
    
    def ask(self, question: str, n_context: int = 5) -> Dict[str, Any]:
        """RAG 问答 - 基于个人数据回答问题"""
        try:
            # 1. 检索相关上下文
            search_results = self.search(question, n_results=n_context)
            
            if not search_results:
                return {
                    "answer": "目前没有足够的数据来回答这个问题，请先记录更多生活数据。",
                    "sources": [],
                    "has_context": False
                }
            
            # 2. 构建上下文
            context_parts = []
            for i, r in enumerate(search_results, 1):
                context_parts.append(f"[记录 {i}]\n{r['document']}")
            
            context = "\n\n".join(context_parts)
            
            # 3. 调用 LLM 生成回答
            system_prompt = """你是一个个人生活数据分析助手。根据用户的历史生活记录，回答用户的问题。

规则：
1. 只基于提供的上下文回答，不要编造信息
2. 如果上下文中没有相关信息，诚实地说"根据现有记录无法回答"
3. 回答要简洁、有洞察力
4. 可以发现模式、给出建议
5. 使用中文回答"""
            
            user_prompt = f"""用户问题: {question}

相关生活记录：
{context}

请基于以上记录回答用户的问题。"""
            
            response = self.openai_client.chat.completions.create(
                model=self.smart_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            answer = response.choices[0].message.content
            
            return {
                "answer": answer,
                "sources": [
                    {
                        "date": r["metadata"].get("date", ""),
                        "category": r["metadata"].get("category", ""),
                        "relevance": round(r["relevance"], 2),
                        "preview": r["document"][:100] + "..." if len(r["document"]) > 100 else r["document"]
                    }
                    for r in search_results
                ],
                "has_context": True,
                "context_count": len(search_results)
            }
            
        except Exception as e:
            logger.error(f"RAG 问答失败: {e}")
            return {
                "answer": f"处理问题时出错: {str(e)}",
                "sources": [],
                "has_context": False,
                "error": str(e)
            }
    
    # ========== 统计信息 ==========
    
    def get_stats(self) -> Dict[str, Any]:
        """获取 RAG 系统统计信息"""
        try:
            collection_count = self.collection.count()
            
            # 获取数据库中的记录总数
            db_count = self.db.query(LifeStream).count()
            
            return {
                "indexed_count": collection_count,
                "database_count": db_count,
                "index_coverage": round(collection_count / db_count * 100, 1) if db_count > 0 else 0,
                "embedding_model": self.embedding_model,
                "persist_dir": self.persist_dir,
            }
        except Exception as e:
            return {"error": str(e)}
    
    def clear_index(self) -> Dict[str, Any]:
        """清空索引"""
        try:
            # 删除并重建集合
            self.client.delete_collection("life_records")
            self.collection = self.client.get_or_create_collection(
                name="life_records",
                metadata={"description": "Personal life records for RAG"}
            )
            return {"status": "cleared", "count": 0}
        except Exception as e:
            return {"error": str(e)}
    
    # ========== 增强功能 v0.2 ==========
    
    def ask_with_context(
        self, 
        question: str, 
        conversation_history: Optional[List[Dict[str, str]]] = None,
        n_context: int = 7
    ) -> Dict[str, Any]:
        """
        增强版 RAG 问答 - 支持对话历史
        
        Args:
            question: 用户问题
            conversation_history: 之前的对话历史 [{"role": "user/assistant", "content": "..."}]
            n_context: 检索的上下文数量
        """
        try:
            # 1. 检索相关上下文
            search_results = self.search(question, n_results=n_context)
            
            # 2. 获取时间上下文
            time_context = self._get_time_context()
            
            # 3. 构建上下文
            if not search_results:
                context = "暂无相关历史记录。"
            else:
                context_parts = []
                for i, r in enumerate(search_results, 1):
                    context_parts.append(f"[记录 {i}]\n{r['document']}")
                context = "\n\n".join(context_parts)
            
            # 4. 构建消息
            system_prompt = f"""你是一个智能的个人生活助手，能够基于用户的历史生活记录回答问题、提供洞察和建议。

当前时间背景：
{time_context}

规则：
1. 基于提供的历史记录回答问题，不要编造不存在的信息
2. 如果记录中没有相关信息，诚实地说"根据现有记录无法确定"
3. 可以发现模式、趋势，给出有洞察力的分析
4. 回答要简洁、友好、有帮助
5. 使用中文回答
6. 如果用户问的是一般性问题而非关于历史记录，也可以正常回答"""
            
            messages = [{"role": "system", "content": system_prompt}]
            
            # 添加对话历史
            if conversation_history:
                for msg in conversation_history[-6:]:  # 最多保留6轮历史
                    messages.append(msg)
            
            # 添加当前问题（包含上下文）
            user_prompt = f"""用户问题: {question}

相关生活记录：
{context}

请回答用户的问题。"""
            
            messages.append({"role": "user", "content": user_prompt})
            
            # 5. 调用 LLM
            response = self.openai_client.chat.completions.create(
                model=self.smart_model,
                messages=messages,
                max_tokens=3000,
                temperature=0.7
            )
            
            answer = response.choices[0].message.content
            
            return {
                "answer": answer,
                "sources": [
                    {
                        "date": r["metadata"].get("date", ""),
                        "category": r["metadata"].get("category", ""),
                        "relevance": round(r["relevance"], 2),
                        "preview": r["document"][:100] + "..." if len(r["document"]) > 100 else r["document"]
                    }
                    for r in search_results
                ],
                "has_context": len(search_results) > 0,
                "context_count": len(search_results)
            }
            
        except Exception as e:
            logger.error(f"RAG 问答失败: {e}")
            return {
                "answer": f"处理问题时出错，请稍后重试。",
                "sources": [],
                "has_context": False,
                "error": str(e)
            }
    
    def generate_topic_summary(self, topic: str, days: int = 30) -> Dict[str, Any]:
        """
        生成特定主题的摘要分析
        
        例如: "睡眠"、"运动"、"心情" 等
        """
        try:
            # 搜索相关记录
            search_results = self.search(topic, n_results=20)
            
            if not search_results:
                return {
                    "has_data": False,
                    "message": f"没有找到与 '{topic}' 相关的记录"
                }
            
            # 按日期分组
            by_date: Dict[str, List[str]] = defaultdict(list)
            for r in search_results:
                date = r["metadata"].get("date", "unknown")
                by_date[date].append(r["document"])
            
            # 构建摘要上下文
            context_parts = []
            for date in sorted(by_date.keys(), reverse=True)[:10]:
                docs = by_date[date]
                context_parts.append(f"[{date}]\n" + "\n".join(docs[:2]))
            
            context = "\n\n".join(context_parts)
            
            # 生成摘要
            prompt = f"""基于以下关于"{topic}"的生活记录，生成一个简洁的分析摘要。

记录：
{context}

请分析:
1. 整体情况概述
2. 发现的模式或趋势
3. 值得注意的点
4. 改进建议（如果适用）

用简洁的中文回答，不要超过200字。"""
            
            response = self.openai_client.chat.completions.create(
                model=self.smart_model,
                messages=[
                    {"role": "system", "content": "你是一个善于总结和分析的生活数据助手。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            return {
                "has_data": True,
                "topic": topic,
                "summary": response.choices[0].message.content,
                "record_count": len(search_results),
                "date_range": {
                    "earliest": min(by_date.keys()) if by_date else None,
                    "latest": max(by_date.keys()) if by_date else None
                }
            }
            
        except Exception as e:
            logger.error(f"生成主题摘要失败: {e}")
            return {"has_data": False, "error": str(e)}
    
    def get_life_insights(self, period_days: int = 30) -> Dict[str, Any]:
        """
        生成生活洞察报告
        
        综合分析最近一段时间的生活数据
        """
        try:
            # 获取各维度数据
            dimensions = ["睡眠", "饮食", "运动", "心情", "工作", "社交"]
            insights = []
            
            for dim in dimensions:
                results = self.search(dim, n_results=5)
                if results:
                    insights.append({
                        "dimension": dim,
                        "record_count": len(results),
                        "recent_samples": [r["document"][:80] for r in results[:2]]
                    })
            
            if not insights:
                return {
                    "has_data": False,
                    "message": "数据不足，无法生成洞察报告"
                }
            
            # 构建综合分析上下文
            context_parts = []
            for insight in insights:
                context_parts.append(f"【{insight['dimension']}】({insight['record_count']}条记录)")
                for sample in insight["recent_samples"]:
                    context_parts.append(f"  - {sample}")
            
            context = "\n".join(context_parts)
            
            # 生成综合洞察
            prompt = f"""基于以下生活数据摘要，生成一份简洁的个人生活洞察报告。

数据摘要：
{context}

请分析:
1. 生活状态整体评估（1-2句话）
2. 做得好的地方
3. 需要关注的地方
4. 一个具体的行动建议

用友好、简洁的中文回答。"""
            
            response = self.openai_client.chat.completions.create(
                model=self.smart_model,
                messages=[
                    {"role": "system", "content": "你是一个关心用户健康和生活质量的智能助手。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            return {
                "has_data": True,
                "period_days": period_days,
                "insights": response.choices[0].message.content,
                "dimensions_analyzed": [i["dimension"] for i in insights],
                "total_records": sum(i["record_count"] for i in insights)
            }
            
        except Exception as e:
            logger.error(f"生成生活洞察失败: {e}")
            return {"has_data": False, "error": str(e)}
    
    def _get_time_context(self) -> str:
        """获取当前时间上下文"""
        now = datetime.now()
        weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        
        # 时段
        hour = now.hour
        if 5 <= hour < 9:
            period = "早晨"
        elif 9 <= hour < 12:
            period = "上午"
        elif 12 <= hour < 14:
            period = "中午"
        elif 14 <= hour < 18:
            period = "下午"
        elif 18 <= hour < 21:
            period = "傍晚"
        elif 21 <= hour < 24:
            period = "晚间"
        else:
            period = "深夜"
        
        # 季节
        month = now.month
        if month in [3, 4, 5]:
            season = "春季"
        elif month in [6, 7, 8]:
            season = "夏季"
        elif month in [9, 10, 11]:
            season = "秋季"
        else:
            season = "冬季"
        
        return f"现在是 {now.strftime('%Y年%m月%d日')} {weekday_names[now.weekday()]} {period}，{season}。"


# 全局单例
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """获取 RAGService 单例"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
