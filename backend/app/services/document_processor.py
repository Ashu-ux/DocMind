import os
from pathlib import Path
from typing import List

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document


class DocumentProcessor:
    """
    Handles loading raw files (PDF, DOCX, TXT) and splitting them
    into overlapping text chunks ready for embedding.
    """

    SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""],
        )

    # ------------------------------------------------------------------
    def load_document(self, file_path: str) -> List[Document]:
        ext = Path(file_path).suffix.lower()

        if ext == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader
            loader = PyPDFLoader(file_path)
        elif ext == ".docx":
            from langchain_community.document_loaders import Docx2txtLoader
            loader = Docx2txtLoader(file_path)
        elif ext == ".txt":
            from langchain_community.document_loaders import TextLoader
            loader = TextLoader(file_path, encoding="utf-8")
        else:
            raise ValueError(
                f"Unsupported file type: '{ext}'. "
                f"Supported: {', '.join(self.SUPPORTED_EXTENSIONS)}"
            )

        return loader.load()

    # ------------------------------------------------------------------
    def process(self, file_path: str) -> List[Document]:
        """Load and chunk a document; returns a list of Document chunks."""
        documents = self.load_document(file_path)
        chunks = self.text_splitter.split_documents(documents)
        return chunks
