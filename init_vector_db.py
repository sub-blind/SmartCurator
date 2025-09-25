import asyncio
from app.core.vector_config import vector_db

async def init_vector_db():
    await vector_db.setup_collection()

if __name__ == "__main__":
    asyncio.run(init_vector_db())
