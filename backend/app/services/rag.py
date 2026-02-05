"""RAG (Retrieval-Augmented Generation) 服务

基于 ChromaDB 的个人知识库系统：
1. 将生活记录向量化并索引
2. 支持语义搜索
3. 结合 LLM 生成个性化回答
"""
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import chromadb
from chromadb.config import Settings
from openai import OpenAI
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import LifeStream
from app.config import get_settings


settings = get_settings()


class RAGService:
    """RAG 服务 - 个人知识库"""
    
    def __init__(self, persist_dir: str = None):
        # 使用配置中的目录，或传入的目录，或默认值
        self.persist_dir = persist_dir or settings.get_chroma_persist_dir()
        os.makedirs(self.persist_dir, exist_ok=True)
        
        # 初始化 ChromaDB
        self.client = chromadb.PersistentClient(
            path=persist_dir,
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
            print(f"索引记录失败: {e}")
            return False
    
    def index_all_records(self, batch_size: int = 100) -> Dict[str, Any]:
        """索引所有记录"""
        records = self.db.query(LifeStream).order_by(LifeStream.created_at.desc()).all()
        
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
            LifeStream.created_at >= start_date
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
            print(f"获取嵌入向量失败: {e}")
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
            
            # 构建过滤条件
            where_filter = None
            if category:
                where_filter = {"category": category}
            
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
            print(f"搜索失败: {e}")
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
                max_tokens=500,
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
            print(f"RAG 问答失败: {e}")
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


# 全局单例
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """获取 RAGService 单例"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
