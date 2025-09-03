# SmartCurator - AI 기반 개인 지식 큐레이션 플랫폼

> **GPT-5와 RAG 시스템을 활용한 지능형 개인 지식 관리 백엔드 서비스**

## 🎯 프로젝트 개요

**SmartCurator**는 사용자가 저장한 다양한 컨텐츠(웹 링크, PDF, 텍스트)를 AI가 자동으로 요약하고 태그를 생성하여, 개인화된 지식 검색과 질의응답이 가능한 지능형 큐레이션 플랫폼입니다.

단순한 북마크 서비스를 넘어, **GPT-5의 강력한 언어 이해 능력**과 **RAG(Retrieval-Augmented Generation) 시스템**을 결합하여 저장된 지식을 기반으로 한 맞춤형 AI 어시스턴트 기능을 제공합니다.

## ✨ 핵심 기능

### 📄 **스마트 컨텐츠 수집**
- URL, PDF, 텍스트 파일 등 다양한 소스 자동 처리
- 웹 페이지 크롤링 및 텍스트 추출
- 비동기 백그라운드 처리로 빠른 응답

### 🤖 **GPT 기반 지능형 요약**
- 수집된 컨텐츠의 핵심 내용 자동 요약
- 컨텍스트를 고려한 정확한 태그 자동 생성
- 사용자 맞춤형 요약 스타일 적용

### 🔍 **RAG 기반 의미론적 검색**
- 벡터 데이터베이스(Qdrant)를 활용한 의미 기반 검색
- 키워드가 아닌 의미로 찾는 지능형 검색
- 관련도 기반 검색 결과 랭킹

### 💬 **개인 AI 어시스턴트**
- 저장된 지식을 기반으로 한 질의응답
- 실시간 채팅을 통한 정보 검색
- 개인화된 추천 및 인사이트 제공

### 📊 **지식 네트워크 시각화**
- 태그 기반 지식 연결 관계 분석
- 개인 학습 패턴 및 관심사 통계
- 지식 활용도 및 검색 분석

## 🛠 기술 스택

### **Backend Framework**
- **FastAPI** - 고성능 비동기 웹 프레임워크
- **Python 3.12** - 최신 파이썬 기능 활용

### **Database & Storage**
- **PostgreSQL** - 관계형 데이터 및 JSON 지원
- **Qdrant** - 벡터 데이터베이스 (의미론적 검색)
- **Redis** - 캐싱 및 작업 큐

### **AI & Machine Learning**
- **OpenAI GPT-5** - 텍스트 요약 및 태그 생성
- **Sentence Transformers** - 텍스트 임베딩 생성
- **LangChain** - RAG 파이프라인 구축

### **Data Processing**
- **Celery** - 비동기 작업 처리
- **Beautiful Soup** - 웹 스크래핑
- **SQLAlchemy** - ORM 및 데이터베이스 관리

### **DevOps & Deployment**
- **Docker** - 컨테이너화
- **AWS EC2 + RDS** - 클라우드 배포
- **GitHub Actions** - CI/CD 파이프라인

## 🚀 주요 API 엔드포인트

```
🔐 인증
POST   /auth/register     # 회원가입
POST   /auth/login        # 로그인
GET    /auth/me          # 내 정보 조회

📚 컨텐츠 관리
POST   /contents/         # 컨텐츠 저장 (자동 요약/태그 생성)
GET    /contents/my       # 내 컨텐츠 목록
GET    /contents/public   # 공개 컨텐츠 탐색
PUT    /contents/{id}     # 컨텐츠 수정
DELETE /contents/{id}     # 컨텐츠 삭제

🔍 검색 & AI
GET    /search/semantic   # 의미론적 검색
POST   /chat/ask         # AI 어시스턴트 질의응답
GET    /recommendations  # 개인화 추천

📊 분석
GET    /stats/personal   # 개인 사용 통계
GET    /network/tags     # 태그 네트워크 데이터
```

## 📁 프로젝트 구조

```
smartcurator-backend/
├── app/
│   ├── core/           # 핵심 설정 (DB, 보안, 설정)
│   ├── models/         # SQLAlchemy ORM 모델
│   ├── schemas/        # Pydantic 스키마
│   ├── api/           # API 라우터
│   ├── services/      # 비즈니스 로직
│   ├── utils/         # 유틸리티 함수
│   └── tasks/         # Celery 비동기 작업
├── tests/             # 테스트 코드
├── alembic/          # 데이터베이스 마이그레이션
└── docs/             # 프로젝트 문서
```

## 🎯 프로젝트의 차별점

### **1. 실무급 아키텍처**
- 마이크로서비스 지향 모듈화 설계
- 비동기 처리로 높은 성능과 확장성
- 현업에서 사용하는 표준 기술 스택

### **2. 최신 AI 기술 통합**
- GPT-5의 향상된 추론 능력 활용
- RAG 시스템으로 환각(hallucination) 방지
- 벡터 검색으로 정확한 정보 검색

### **3. 개인화된 지식 관리**
- 사용자별 맞춤형 요약 및 태그
- 학습 패턴 기반 추천 시스템
- 지식 네트워크 시각화
- **확장 가능한 설계**로 실무 적응력 증명

***


