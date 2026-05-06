"""
VectorService tests.

These tests keep RAG indexing behavior grounded in original content instead of
summary-only text, so factual Q&A can retrieve details that summaries omit.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_store_content_chunks_prefers_raw_content_over_summary():
    from app.services.vector_service import VectorService

    service = VectorService()
    service._ensure_collection = AsyncMock()
    service.delete_content_vector = AsyncMock(return_value=True)
    service.client = MagicMock()
    service.collection_name = "test_collection"

    captured_points = []

    def fake_point_struct(**kwargs):
        point = SimpleNamespace(**kwargs)
        captured_points.append(point)
        return point

    summary = "아스널이 챔피언스리그 결승에 진출했다."
    raw_content = "아스널의 감독은 미켈 아르테타다. 아스널은 20년 만에 결승에 올랐다."

    with (
        patch("app.services.vector_service.PointStruct", side_effect=fake_point_struct),
        patch("app.services.vector_service.embedding_service.generate_embedding", return_value=[0.1] * 768),
    ):
        result = await service.store_content_chunks(
            content_id=1,
            title="아스널 결승 진출",
            summary=summary,
            tags=["아스널", "챔피언스리그"],
            user_id=10,
            raw_content=raw_content,
        )

    assert result is True
    assert captured_points
    assert "미켈 아르테타" in captured_points[0].payload["chunk_text"]
    assert captured_points[0].payload["summary"] == summary
    service.client.upsert.assert_called_once()
