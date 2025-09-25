import asyncio
import logging
from celery import current_task
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_content_task(self, content_id: int):
    """컨텐츠 처리 태스크 - 단일 이벤트 루프 재사용"""
    try:
        import os
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))

        # 전역 이벤트 루프를 생성/재사용하여 loop 간 Future 충돌 방지
        global _celery_event_loop
        try:
            _celery_event_loop  # type: ignore[name-defined]
        except NameError:
            _celery_event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_celery_event_loop)

        result = _celery_event_loop.run_until_complete(process_single_content(content_id))
        logger.info(f"✅ 처리 완료: content_id={content_id}")
        return result

    except Exception as exc:
        logger.error(f"❌ 태스크 실패: content_id={content_id}, error={exc}")
        if self.request.retries < self.max_retries:
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            logger.info(f"🔄 재시도: content_id={content_id}, retry={self.request.retries+1}")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            logger.error(f"💀 재시도 포기: content_id={content_id}")
            raise

async def process_single_content(content_id: int):
    """단일 컨텐츠 처리 - 각 단계마다 새로운 세션 사용"""
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from app.core.database import engine
    
    # 새로운 세션 메이커
    AsyncSessionMaker = async_sessionmaker(engine, expire_on_commit=False)
    
    try:
        # 1단계: 상태를 processing으로 변경
        async with AsyncSessionMaker() as session:
            from app.services.content_service import ContentService
            service = ContentService(session)
            await service.update_content_status(content_id, "processing")
            await session.commit()
            logger.info(f"📝 상태 변경 완료: content_id={content_id}")
        
        # 2단계: 실제 컨텐츠 처리 (새 세션)
        async with AsyncSessionMaker() as session:
            service = ContentService(session)
            content = await service.process_content_async(content_id)
            await session.commit()
            logger.info(f"🚀 컨텐츠 처리 완료: content_id={content_id}")
            
            return {
                "content_id": content_id,
                "status": "completed",
                "title": content.title if content else "Unknown"
            }
            
    except Exception as e:
        logger.error(f"❌ 처리 실패: content_id={content_id}, error={e}")
        
        # 실패 상태 업데이트 (완전히 새로운 세션)
        try:
            async with AsyncSessionMaker() as session:
                service = ContentService(session)
                await service.update_content_status(content_id, "failed")
                await session.commit()
                logger.info(f"💥 실패 상태 업데이트: content_id={content_id}")
        except:
            logger.warning("실패 상태 업데이트도 실패")
        
        raise

@celery_app.task
def health_check():
    """헬스체크"""
    import datetime
    return {
        "status": "healthy", 
        "timestamp": datetime.datetime.now().isoformat(),
        "worker_id": getattr(current_task.request, 'id', 'unknown')
    }
