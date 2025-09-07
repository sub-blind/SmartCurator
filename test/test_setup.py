# test_setup.py - 전체 설정 테스트
import asyncio
import redis
from app.core.celery_app import celery_app, test_celery_connection

def test_redis_connection():
    """Redis 연결 테스트"""
    try:
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        print("✅ Redis 연결 성공!")
        
        # 테스트 데이터
        r.set('test_key', 'hello_smartcurator')
        value = r.get('test_key').decode()
        print(f"✅ Redis 읽기/쓰기 테스트: {value}")
        r.delete('test_key')
        return True
        
    except Exception as e:
        print(f"❌ Redis 연결 실패: {e}")
        return False

def test_celery_basic():
    """Celery 기본 연결 테스트"""
    return test_celery_connection()

def test_celery_task():
    """Celery 태스크 테스트"""
    try:
        from app.tasks.content_tasks import health_check
        
        # 비동기 태스크 실행
        result = health_check.delay()
        print(f"✅ 태스크 실행: task_id={result.id}")
        
        # 결과 대기 (최대 10초)
        task_result = result.get(timeout=10)
        print(f"✅ 태스크 결과: {task_result}")
        return True
        
    except Exception as e:
        print(f"❌ 태스크 실행 실패: {e}")
        return False

if __name__ == "__main__":
    print("🔍 SmartCurator 환경 테스트 시작\n")
    
    # 1. Redis 테스트
    print("1. Redis 연결 테스트")
    redis_ok = test_redis_connection()
    print()
    
    # 2. Celery 연결 테스트  
    print("2. Celery 연결 테스트")
    celery_ok = test_celery_basic()
    print()
    
    # 3. 태스크 실행 테스트 (Celery 워커가 실행 중일 때만)
    print("3. Celery 태스크 테스트")
    if celery_ok:
        task_ok = test_celery_task()
    else:
        print("⚠️ Celery 워커를 먼저 실행하세요")
        task_ok = False
    
    print("\n" + "="*50)
    print("📋 테스트 결과 요약:")
    print(f"  Redis: {'✅ 성공' if redis_ok else '❌ 실패'}")
    print(f"  Celery 연결: {'✅ 성공' if celery_ok else '❌ 실패'}")
    print(f"  태스크 실행: {'✅ 성공' if task_ok else '❌ 실패'}")
    
    if redis_ok and celery_ok:
        print("\n🎉 환경 설정 완료! 개발을 시작할 수 있습니다.")
    else:
        print("\n⚠️ 일부 설정에 문제가 있습니다. 위 결과를 확인해주세요.")
