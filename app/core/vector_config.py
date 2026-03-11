import logging

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorDBConfig:
    """Qdrant client configuration and collection management."""

    def __init__(self):
        if settings.QDRANT_URL:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
                timeout=30,
            )
        else:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                timeout=30,
            )

        self.collection_name = "content_embeddings"
        self.vector_size = 768

    async def setup_collection(self):
        try:
            collections = self.client.get_collections()
            collection_names = [collection.name for collection in collections.collections]

            if self.collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE,
                    ),
                    on_disk_payload=False,
                )
                logger.info("Created Qdrant collection: %s", self.collection_name)
            else:
                logger.info("Using existing Qdrant collection: %s", self.collection_name)

        except Exception as e:
            logger.error("Failed to configure Qdrant: %s", e)
            raise

    async def recreate_collection(self):
        try:
            self.client.delete_collection(self.collection_name)
            logger.info("Deleted existing Qdrant collection: %s", self.collection_name)
        except Exception:
            logger.info("Qdrant collection did not exist before recreate.")

        await self.setup_collection()


vector_db = VectorDBConfig()
