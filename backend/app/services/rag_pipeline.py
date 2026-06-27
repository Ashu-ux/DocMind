"""
RAG Pipeline — LangChain + OpenAI generation layer.
Response format is contractually aligned with the frontend.
"""
import logging
from typing import Any, Dict, List

from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document
from langchain_openai import ChatOpenAI

logger = logging.getLogger("docmind.rag")

# ── System prompt ──────────────────────────────────────────────────────
_SYSTEM = """\
You are DocMind, an expert enterprise document analyst.
Answer the user's question using ONLY the context documents provided below.

Rules:
- Answer thoroughly and accurately if the information exists in the context.
- If the answer is NOT in the context, respond exactly with:
  "The provided documents do not contain information about this topic."
- Cite the source file and page number when referencing specific content.
- Use bullet points or numbered lists for multi-part answers.
- Never fabricate information that isn't explicitly stated in the context.
- Keep responses professional and concise.

Context Documents:
{context}
"""

_HUMAN = "Question: {question}\n\nAnswer:"


class RAGPipeline:
    """
    Orchestrates the LangChain RAG chain:
    context formatting → prompt → OpenAI LLM → structured response.
    """

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", temperature: float = 0.1):
        self._llm = ChatOpenAI(
            openai_api_key=api_key,
            model=model,
            temperature=temperature,
        )
        self._prompt = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM), ("human", _HUMAN)]
        )
        self._chain = self._prompt | self._llm

    # ── Internal helpers ──────────────────────────────────────────────
    @staticmethod
    def _build_context(docs: List[Document]) -> str:
        parts = []
        for i, doc in enumerate(docs, start=1):
            source = doc.metadata.get("source", "Unknown")
            page   = doc.metadata.get("page", None)
            label  = f"[Doc {i} | {source}"
            if page is not None:
                label += f" | Page {int(page) + 1}"
            label += "]"
            parts.append(f"{label}\n{doc.page_content.strip()}")
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _build_sources(docs: List[Document]) -> List[Dict[str, Any]]:
        """
        Returns deduplicated source list.
        Shape: [{"file": str, "page": int | None}]
        Matches the frontend SourceItem model exactly.
        """
        seen: set = set()
        sources: List[Dict[str, Any]] = []
        for doc in docs:
            src  = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", None)
            key  = f"{src}::{page}"
            if key in seen:
                continue
            seen.add(key)
            entry: Dict[str, Any] = {"file": src}
            if page is not None:
                entry["page"] = int(page) + 1   # 0-indexed → 1-indexed
            sources.append(entry)
        return sources

    # ── Public API ────────────────────────────────────────────────────
    def query(self, question: str, docs: List[Document]) -> Dict[str, Any]:
        """
        Run a RAG query.

        Returns a dict matching the QueryResponse Pydantic model:
        {
            "answer":       str,
            "sources":      [{"file": str, "page"?: int}],
            "context_used": int,   ← number of chunks fed to LLM
        }
        """
        context  = self._build_context(docs)
        response = self._chain.invoke({"context": context, "question": question})
        sources  = self._build_sources(docs)

        logger.debug("Generated answer (%d chars) from %d chunks", len(response.content), len(docs))

        return {
            "answer":       response.content,
            "sources":      sources,
            "context_used": len(docs),
        }
