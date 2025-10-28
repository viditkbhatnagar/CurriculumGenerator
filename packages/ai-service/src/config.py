import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration management for AI service"""

    PORT = int(os.getenv("PORT", 5000))
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

    # Pinecone
    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
    PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "")
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "curriculum-knowledge-base")

    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/curriculum_db"
    )

    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        required = ["OPENAI_API_KEY"]
        missing = [key for key in required if not getattr(cls, key)]
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")


config = Config()
