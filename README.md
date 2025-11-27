# SmartCurator - AI 기반 개인 지식 관리 플랫폼

> 사용자가 저장한 웹 컨텐츠를 AI가 자동 요약하고, 벡터 검색과 RAG 시스템을 통해 개인화된 질의응답을 제공하는 백엔드 서비스

## 프로젝트 개요

SmartCurator는 단순한 북마크 서비스를 넘어 다음과 같은 기능을 제공합니다:

1. **스마트 컨텐츠 처리**: URL 크롤링 → AI 자동 요약 → 태그 자동 생성
2. **의미론적 검색**: 키워드가 아닌 의미 기반으로 저장된 컨텐츠 검색
3. **RAG 기반 질의응답**: 저장된 지식을 기반으로 한 개인 AI 어시스턴트

## 핵심 기능

### 컨텐츠 수집 및 처리
- 웹 URL에서 자동으로 텍스트 추출
- GPT를 통한 자동 요약 및 태그 생성
- Celery 비동기 처리로 백그라운드 실행

### 벡터 임베딩 및 검색
- 한국어 최적화 모델(ko-sroberta-multitask)로 768차원 벡터 생성
- Qdrant 벡터 데이터베이스를 통한 고성능 유사도 검색
- 사용자별 개인 컨텐츠만 검색(격리된 네임스페이스)

### RAG 기반 질의응답
- 질문 관련 컨텐츠 자동 검색
- 검색된 컨텍스트를 기반으로 GPT 답변 생성
- 출처 정보 및 신뢰도 점수 함께 제공

## 기술 스택

### Backend
- **FastAPI** - 비동기 웹 프레임워크
- **SQLAlchemy** - ORM 및 데이터베이스 관리
- **PostgreSQL** - 관계형 데이터베이스

### AI & 벡터 검색
- **OpenAI GPT-3.5** - 텍스트 요약 및 질의응답
- **Sentence Transformers** - 텍스트 임베딩
- **Qdrant** - 벡터 데이터베이스

### 비동기 및 캐싱
- **Celery** - 백그라운드 작업 처리
- **Redis** - 캐싱 및 메시지 브로커
- **asyncpg** - 비동기 PostgreSQL 드라이버

### 웹 스크래핑 및 유틸
- **BeautifulSoup4** - HTML 파싱
- **httpx** - 비동기 HTTP 클라이언트
- **python-jose** - JWT 인증

## API 엔드포인트

### 인증
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
```

### 컨텐츠 관리
```
POST   /api/v1/contents/          # 컨텐츠 저장 (자동 처리)
GET    /api/v1/contents/          # 내 컨텐츠 목록
GET    /api/v1/contents/{id}      # 단일 컨텐츠 조회
PUT    /api/v1/contents/{id}      # 수정
DELETE /api/v1/contents/{id}      # 삭제
```

### 검색 및 질의응답
```
GET    /api/v1/search/semantic    # 의미론적 검색
POST   /api/v1/chat/ask           # AI 질의응답
```

## 프로젝트 구조

```
smartcurator/
├── app/
│   ├── core/              # 설정, DB, 보안
│   ├── models/            # SQLAlchemy ORM
│   ├── schemas/           # Pydantic 스키마
│   ├── api/               # API 라우터
│   ├── services/          # 비즈니스 로직
│   ├── tasks/             # Celery 비동기 작업
│   └── utils/             # 유틸리티
├── tests/                 # 테스트 코드
└── requirements.txt       # 의존성
```

## 로컬 실행

### 필수 서비스 설정
```bash
# Redis 시작
docker run -d -p 6379:6379 redis:latest

# Qdrant 시작
docker run -d -p 6333:6333 qdrant/qdrant:latest

# PostgreSQL 시작
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

### 애플리케이션 실행
```bash
# 환경 설정
cp .env.example .env
# .env 파일 수정 (API 키 등)

# 의존성 설치
pip install -r requirements.txt

# 마이그레이션
alembic upgrade head

# FastAPI 서버 (터미널 1)
uvicorn app.main:app --reload

# Celery 워커 (터미널 2)
celery -A app.core.celery_app worker --loglevel=info
```

## 구현 결과

### 의미론적 검색 예시
```
쿼리: "AI 규제"
→ 저장된 컨텐츠 중 의미상 유사한 기사 검색
→ 점수와 함께 랭킹된 결과 반환
```

### RAG 질의응답 예시
```
질문: "정부가 AI에 대해 어떤 규제 방안을 발표했나요?"
→ 저장된 컨텐츠에서 관련 정보 검색 (유사도 점수)
→ 검색된 정보를 기반으로 GPT 답변 생성
→ 답변 + 출처 + 신뢰도 반환
```

## 핵심 기술 결정

### 왜 Qdrant인가?
- 밀리초 단위의 빠른 벡터 검색 속도
- 필터링을 통한 사용자별 데이터 격리
- 프로덕션 레벨의 안정성

### 왜 RAG 시스템인가?
- 저장된 개인 데이터에 기반한 정확한 답변
- 환각(hallucination) 방지
- 답변의 출처 추적 가능

### 왜 비동기 처리인가?
- 웹 크롤링, AI 호출, 벡터 생성은 시간이 오래 걸림
- Celery를 통한 백그라운드 처리로 사용자 응답 시간 단축
- 대량의 컨텐츠 동시 처리 가능

## 성능 지표

| 항목 | 응답시간 |
|------|----------|
| API 기본 요청 | < 100ms |
| 의미론적 검색 | ~200ms (5개 결과) |
| RAG 질의응답 | 3-5초 (GPT 호출 포함) |

## 배운 점

1. **분산 시스템**: 마이크로서비스 아키텍처와 비동기 작업 처리의 중요성
2. **AI 통합**: RAG 패러다임과 프롬프트 엔지니어링의 실전 경험
3. **데이터 파이프라인**: 수집 → 처리 → 저장 → 검색의 완전한 사이클 구현
4. **벡터 DB**: 대규모 임베딩 저장 및 유사도 검색의 실무 경험

## 향후 개선 사항

- 멀티턴 대화 (대화 컨텍스트 유지)
- 프론트엔드 UI/UX 개발
- 팀 협업 기능 (공유, 권한 관리)
- Slack, Notion 등 외부 서비스 연동

## 참고 자료

- [Qdrant 공식 문서](https://qdrant.tech/documentation/)
- [Sentence Transformers 한국어 모델](https://huggingface.co/jhgan/ko-sroberta-multitask)
- [FastAPI 공식 가이드](https://fastapi.tiangolo.com/)
