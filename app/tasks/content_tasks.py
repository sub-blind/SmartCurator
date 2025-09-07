import asyncio
import logging
from celery import current_task
from app.core.celery_app import celery_app
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.core.database import engine
from app.services.content_service import ContentService

logger = logging.getLogger(__name__)

# 세션 메이커 직접 생성
AsyncSessionMaker = async_sessionmaker(
    engine,
    expire_on_commit=False
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_content_task(self, content_id: int):
    """컨텐츠 비동기 처리 메인 태스크"""
    async def _async_process():
        session: AsyncSessionMaker = None
        try:
            # ① 세션 컨텍스트 열기
            async with AsyncSessionMaker() as session:
                logger.info(f"🚀 컨텐츠 처리 시작: content_id={content_id}")
                service = ContentService(session)

                # 상태 업데이트: processing
                await service.update_content_status(content_id, "processing")

                # 크롤링 + AI 요약 처리
                content = await service.process_content_async(content_id)

                logger.info(f"✅ 컨텐츠 처리 완료: content_id={content_id}")
                return {
                    "content_id": content_id,
                    "status": "completed",
                    "title": content.title,
                    "summary_length": len(content.summary or ""),
                    "tags_count": len(content.tags or []),
                }

        except Exception as exc:
            logger.error(f"❌ 컨텐츠 처리 실패: content_id={content_id}, error={exc}", exc_info=True)
            # 실패 상태 업데이트
            try:
                async with AsyncSessionMaker() as session:
                    service = ContentService(session)
                    await service.update_content_status(content_id, "failed")
            except Exception:
                logger.warning("실패 상태 업데이트 중 예외 발생", exc_info=True)

            # 재시도 로직
            if self.request.retries < self.max_retries:
                countdown = self.default_retry_delay * (2 ** self.request.retries)
                logger.info(f"🔄 재시도 예약: content_id={content_id}, retry={self.request.retries+1}, delay={countdown}s")
                raise self.retry(exc=exc, countdown=countdown)
            else:
                logger.error(f"💀 최대 재시도 초과: content_id={content_id}")
                raise

    # 비동기 처리 실행
    return asyncio.run(_async_process())

@celery_app.task
def health_check():
    """Celery 워커 상태 확인용 태스크"""
    import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "worker_id": current_task.request.id
    }
