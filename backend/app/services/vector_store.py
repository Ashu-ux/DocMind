import shutil
from pathlib import Path
from typing import Dict, List, Optional

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document


class VectorStoreManager:
    """
    Manages per-session FAISS vector stores.
    Each uploaded document gets its own isolated FAISS index (identified by session_id).
    """

    def __init__(self, vector_store_dir: str, api_key: str, embedding_model: str):
        self.vector_store_dir = Path(vector_store_dir)
        self.vector_store_dir.mkdir(parents=True, exist_ok=True)

        self.embeddings = OpenAIEmbeddings(
            openai_api_key=api_key,
            model=embedding_model,
        )

        # In-memory cache so we don't reload from disk every query
        self._cache: Dict[str, FAISS] = {}

    # ------------------------------------------------------------------
    def create_store(self, session_id: str, documents: List[Document]) -> str:
        store = FAISS.from_documents(documents, self.embeddings)
        store_path = self.vector_store_dir / session_id
        store.save_local(str(store_path))
        self._cache[session_id] = store
        return session_id

    # ------------------------------------------------------------------
    def load_store(self, session_id: str) -> Optional[FAISS]:
        if session_id in self._cache:
            return self._cache[session_id]

        store_path = self.vector_store_dir / session_id
        if store_path.exists():
            store = FAISS.load_local(
                str(store_path),
                self.embeddings,
                allow_dangerous_deserialization=True,
            )
            self._cache[session_id] = store
            return store

        return None

    # ------------------------------------------------------------------
    def similarity_search(
        self, session_id: str, query: str, k: int = 5
    ) -> List[Document]:
        store = self.load_store(session_id)
        if store is None:
            raise ValueError(f"No vector store found for session: {session_id}")
        return store.similarity_search(query, k=k)

    # ------------------------------------------------------------------
    def delete_store(self, session_id: str) -> None:
        store_path = self.vector_store_dir / session_id
        if store_path.exists():
            shutil.rmtree(store_path)
        self._cache.pop(session_id, None)

    # ------------------------------------------------------------------
    def list_sessions(self) -> List[str]:
        return [d.name for d in self.vector_store_dir.iterdir() if d.is_dir()]
