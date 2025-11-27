import logging
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import async_session_maker
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.content import Content


logger = logging.getLogger(__name__)


# ⭐ 동기 DB 엔진 (Celery용 - asyncpg 안 씀)
sync_engine = create_engine(
    settings.DATABASE_URL,  # 동기 URL 사용
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)
SyncSessionLocal = sessionmaker(bind=sync_engine)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_content_task(self, content_id: int):
    """컨텐츠 처리 태스크 - 동기 래퍼"""
    try:
        logger.info(f"🚀 Celery 태스크 시작: content_id={content_id}")
        
        result = _process_content_sync(content_id)
        
        logger.info(f"✅ Celery 태스크 완료: content_id={content_id}")
        return result
        
    except Exception as exc:
        logger.error(f"❌ 태스크 실패: content_id={content_id}, error={exc}")
        
        if self.request.retries < self.max_retries:
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            logger.info(f"🔄 재시도: content_id={content_id}, retry={self.request.retries+1}")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            logger.error(f"💀 재시도 포기: content_id={content_id}")
            # 실패 상태 저장
            try:
                session = SyncSessionLocal()
                session.execute(
                    update(Content)
                    .where(Content.id == content_id)
                    .values(status="failed")
                )
                session.commit()
            except Exception as e:
                logger.warning(f"실패 상태 업데이트 실패: {e}")
            finally:
                session.close()
            raise


def _process_content_sync(content_id: int):
    """동기 래퍼 - 비동기 메서드를 동기로 실행"""
    from app.services.content_service import ContentService
    from app.services.vector_service import vector_service
    import asyncio
    
    # 새로운 이벤트 루프 생성
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    async_session = None
    
    try:
        logger.info(f"🔄 컨텐츠 처리 시작: content_id={content_id}")
        
        # 비동기 세션 생성
        from app.core.database import async_session_maker
        
        async def _async_process():
            """비동기 처리 로직"""
            nonlocal async_session
            async_session = async_session_maker()
            
            try:
                service = ContentService(async_session)
                
                # ⭐ 기존 비동기 메서드 사용
                logger.info(f"🔄 process_content_async 호출: content_id={content_id}")
                content = await service.process_content_async(content_id)
                
                logger.info(f"✅ 컨텐츠 처리 완료: {content.title}")
                
                # DB 커밋
                await async_session.commit()
                logger.info(f"💾 DB 커밋 완료")
                
                # 벡터 저장
                if content.summary:
                    logger.info(f"🔢 벡터 저장 시작: content_id={content_id}")
                    await vector_service.store_content_vector(
                        content_id=content.id,
                        title=content.title,
                        summary=content.summary,
                        tags=content.tags or [],
                        user_id=content.user_id,
                        is_public=content.is_public
                    )
                    logger.info(f"✅ 벡터 저장 완료")
                
                return {
                    "content_id": content_id,
                    "status": "success",
                    "title": content.title,
                    "summary_length": len(content.summary) if content.summary else 0
                }
            finally:
                if async_session:
                    await async_session.close()
        
        # 비동기 함수 실행
        result = loop.run_until_complete(_async_process())
        return result
        
    except Exception as e:
        logger.error(f"❌ 처리 실패: content_id={content_id}, error={e}", exc_info=True)
        raise
        
    finally:
        # 루프 정리
        try:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        except:
            pass
        finally:
            loop.close()


@celery_app.task
def health_check():
    """헬스체크"""
    import datetime
    return {
        "status": "healthy", 
        "timestamp": datetime.datetime.now().isoformat()
    }
