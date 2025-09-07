# app/core/celery_app.py
from celery import Celery
import logging


# 로거 설정
logger = logging.getLogger(__name__)


# Celery 앱 생성
celery_app = Celery(
    "smartcurator",
    broker="redis://localhost:6379/0",         # Redis 브로커 주소
    backend="redis://localhost:6379/1",        # 결과 저장소 주소
    include=["app.tasks.content_tasks"]        # 등록할 태스크 모듈 리스트
)


# Celery 설정 업데이트
celery_app.conf.update(
    # 직렬화 포맷 지정
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # 시간대 및 UTC 사용 여부
    timezone="Asia/Seoul",
    enable_utc=True,
    
    # 태스크 재시도 및 워커 장애 시 동작 설정
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # 결과 만료 시간 (초 단위, 1시간)
    result_expires=3600,
    
    # 워커 작업 처리 설정
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    
    # 워커 로그 형식
    worker_log_format="[%(asctime)s: %(levelname)s] %(message)s",
    worker_task_log_format="[%(asctime)s: %(levelname)s][%(task_name)s(%(task_id)s)] %(message)s"
)


def test_celery_connection():
    """
    Celery 브로커 및 워커 연결 상태 테스트 함수

    Returns:
        bool: 연결 성공하면 True, 실패하면 False 반환
    """
    try:
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        if stats:
            logger.info("✅ Celery 브로커 연결 성공")
            return True
        else:
            logger.warning("⚠️ Celery 워커가 실행되지 않음")
            return False
    except Exception as e:
        logger.error(f"❌ Celery 연결 실패: {e}")
        return False


if __name__ == "__main__":
    test_celery_connection()
