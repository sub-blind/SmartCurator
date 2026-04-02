# SmartCurator 다이어그램

## 1. 순차 흐름 (Sequence Diagram)

콘텐츠를 등록하고 요약·검색·AI 질문까지의 전체 흐름입니다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant FE as Next.js<br/>(Vercel)
    participant CF as Cloudflare<br/>Tunnel
    participant API as FastAPI
    participant DB as PostgreSQL
    participant RD as Redis
    participant CW as Celery Worker
    participant SC as ScraperService
    participant AI as OpenAI GPT
    participant EM as ko-sroberta<br/>(임베딩)
    participant QD as Qdrant

    Note over User,QD: ── ① 인증 ──

    User->>FE: 이메일 + 비밀번호 입력
    FE->>CF: POST /auth/login
    CF->>API: 프록시 전달
    API->>DB: 사용자 조회 + 비밀번호 검증
    DB-->>API: 사용자 정보
    API-->>FE: Access Token (30분)<br/>+ Refresh Token (14일)
    FE->>FE: localStorage 저장

    Note over User,QD: ── ② 콘텐츠 등록 ──

    User->>FE: URL / PDF / 메모 입력 → 「가져오기」
    FE->>API: POST /contents/ (Bearer Token)
    API->>DB: INSERT content (status: pending)
    DB-->>API: content_id
    API->>RD: celery.send_task(content_id)
    API-->>FE: 201 Created (content 객체)
    FE->>FE: 프리뷰 카드 표시 + 폴링 시작

    Note over User,QD: ── ③ 비동기 파이프라인 ──

    RD->>CW: process_content_task(content_id)
    CW->>DB: status → processing

    alt URL (유튜브 / 웹사이트)
        CW->>SC: 본문 추출 요청
        SC-->>CW: raw_content (or fallback via Jina Reader)
    else PDF
        CW->>CW: 파일 텍스트 파싱
    else 메모/본문
        CW->>CW: raw_content 그대로 사용
    end

    CW->>CW: 본문을 chunk 단위로 분할

    CW->>AI: 요약 요청 (chunk별)
    AI-->>CW: summary
    CW->>AI: 태그 추출 요청
    AI-->>CW: tags[]
    CW->>AI: 제목 생성 (필요 시)
    AI-->>CW: title

    CW->>EM: chunk 텍스트 → 벡터 변환
    EM-->>CW: 768차원 벡터[]
    CW->>QD: 벡터 + 메타데이터 저장
    QD-->>CW: OK

    CW->>DB: summary, tags, status → completed
    Note right of CW: 실패 시 status → failed<br/>+ processing_error 기록

    Note over User,QD: ── ④ 결과 확인 ──

    loop 12초 간격 폴링 (대시보드)
        FE->>API: GET /contents/my
        API->>DB: SELECT contents
        DB-->>API: 목록
        API-->>FE: 콘텐츠 배열
    end
    FE->>User: 토스트: 「처리 완료」 or 「실패」

    Note over User,QD: ── ⑤ 의미 검색 ──

    User->>FE: 자연어 검색어 입력
    FE->>API: GET /search/semantic?q=...&mode=balanced
    API->>EM: 검색어 → 벡터
    EM-->>API: query 벡터
    API->>QD: 코사인 유사도 검색
    QD-->>API: 상위 chunk 목록
    API->>API: 하이브리드 리랭킹<br/>(유사도 0.8 + 토큰오버랩 0.2)
    API-->>FE: 검색 결과 (제목, snippet, 점수)
    FE->>User: 결과 카드 표시

    Note over User,QD: ── ⑥ RAG 어시스턴트 ──

    User->>FE: 질문 입력 → 「질문하기」
    FE->>API: POST /chat/ask
    API->>EM: 질문 → 벡터
    EM-->>API: query 벡터
    API->>QD: 상위 12개 chunk 검색
    QD-->>API: 근거 chunk[]
    API->>AI: 질문 + chunk 컨텍스트 → GPT
    AI-->>API: 답변 + 신뢰도
    API-->>FE: answer + confidence + sources[]
    FE->>User: 답변 + 근거 출처 표시
```

## 2. 시스템 아키텍처 (Architecture Diagram)

배포 구조와 컴포넌트 간 관계를 보여줍니다.

```mermaid
graph TB
    subgraph INTERNET["🌐 인터넷"]
        USER["👤 사용자<br/>(브라우저)"]
    end

    subgraph VERCEL["▲ Vercel"]
        FE["Next.js 14<br/>React 18 + Tailwind CSS<br/><i>SSR + CSR</i>"]
    end

    subgraph CLOUDFLARE["☁️ Cloudflare"]
        TUNNEL["Cloudflare Tunnel<br/><i>cloudflared</i>"]
    end

    subgraph LOCAL["🖥️ 로컬 PC"]
        subgraph APP_SERVER["FastAPI 서버 (uvicorn :8000)"]
            AUTH_API["/auth/*<br/>JWT 인증"]
            CONTENT_API["/contents/*<br/>콘텐츠 CRUD"]
            SEARCH_API["/search/*<br/>의미 검색"]
            CHAT_API["/chat/*<br/>RAG 질의"]
        end

        subgraph WORKER["Celery Worker"]
            TASK["process_content_task"]
            SCRAPER["ScraperService<br/><i>BS4 + Jina Reader</i>"]
            AI_SVC["AIService<br/><i>OpenAI GPT</i>"]
            EMBED_SVC["EmbeddingService<br/><i>ko-sroberta-multitask</i>"]
            CHUNKER["TextChunking<br/><i>chunk 분할</i>"]
        end

        subgraph DATA["데이터 저장소 (Docker)"]
            PG["🐘 PostgreSQL 15<br/><i>:5432</i><br/>users · contents"]
            REDIS["📮 Redis<br/><i>:6379</i><br/>Broker + Result"]
            QDRANT["🧬 Qdrant<br/><i>:6333</i><br/>벡터 인덱스"]
        end
    end

    subgraph EXTERNAL["🔗 외부 API"]
        OPENAI["OpenAI API<br/><i>GPT-3.5/4</i>"]
        JINA["Jina Reader<br/><i>r.jina.ai</i>"]
    end

    USER -->|"HTTPS"| FE
    FE -->|"API 호출"| TUNNEL
    TUNNEL -->|"localhost:8000"| APP_SERVER

    AUTH_API --> PG
    CONTENT_API --> PG
    CONTENT_API -->|"task.delay()"| REDIS
    SEARCH_API --> QDRANT
    SEARCH_API --> EMBED_SVC
    CHAT_API --> QDRANT
    CHAT_API --> OPENAI

    REDIS -->|"메시지 수신"| TASK
    TASK --> SCRAPER
    TASK --> CHUNKER
    TASK --> AI_SVC
    TASK --> EMBED_SVC
    SCRAPER -.->|"fallback"| JINA
    AI_SVC --> OPENAI
    EMBED_SVC --> QDRANT
    TASK -->|"결과 저장"| PG

    classDef internet fill:#1e293b,stroke:#475569,color:#f1f5f9
    classDef vercel fill:#0f172a,stroke:#38bdf8,color:#38bdf8
    classDef cloud fill:#0f172a,stroke:#fb923c,color:#fb923c
    classDef server fill:#1e293b,stroke:#a78bfa,color:#e2e8f0
    classDef worker fill:#1e293b,stroke:#fb923c,color:#e2e8f0
    classDef data fill:#1e293b,stroke:#34d399,color:#e2e8f0
    classDef ext fill:#1e293b,stroke:#f472b6,color:#e2e8f0

    class USER internet
    class FE vercel
    class TUNNEL cloud
    class AUTH_API,CONTENT_API,SEARCH_API,CHAT_API server
    class TASK,SCRAPER,AI_SVC,EMBED_SVC,CHUNKER worker
    class PG,REDIS,QDRANT data
    class OPENAI,JINA ext
```

## 3. 콘텐츠 상태 흐름 (State Diagram)

하나의 콘텐츠가 거치는 상태 전이입니다.

```mermaid
stateDiagram-v2
    [*] --> pending: 사용자가 콘텐츠 등록

    pending --> processing: Celery Worker가<br/>태스크 수신

    processing --> completed: 요약 + 태그 +<br/>벡터 인덱싱 성공
    processing --> failed: 스크래핑 실패 /<br/>API 오류 / 타임아웃

    failed --> processing: 사용자가<br/>「재처리」 클릭

    completed --> processing: 사용자가<br/>「재처리」 클릭

    completed --> [*]

    note right of pending
        DB INSERT 직후 상태
        Celery 큐에 태스크 발행됨
    end note

    note right of processing
        파이프라인 실행 중
        ① 스크래핑 → ② 요약/태그 → ③ 벡터
    end note

    note right of completed
        summary, tags 채워짐
        Qdrant에 chunk 벡터 저장됨
        프론트에서 토스트 알림
    end note

    note left of failed
        processing_error에
        실패 원인 기록
    end note
```

## 4. 인증 흐름 (Auth Flow)

토큰 발급부터 자동 갱신까지의 흐름입니다.

```mermaid
flowchart TD
    A["사용자 로그인<br/>(이메일 + 비밀번호)"] --> B["FastAPI /auth/login"]
    B --> C{"비밀번호<br/>일치?"}
    C -->|No| D["에러 반환<br/>401"]
    C -->|Yes| E["Access Token 발급 (30분)<br/>Refresh Token 발급 (14일)"]
    E --> F["localStorage 저장<br/>smartcurator_token<br/>smartcurator_refresh_token"]
    F --> G["AuthProvider<br/>전역 상태 세팅"]

    G --> H{"만료 2분 전?"}
    H -->|No| I["정상 API 호출<br/>Bearer Token"]
    H -->|Yes| J["POST /auth/refresh<br/>(refresh_token)"]
    J --> K{"갱신 성공?"}
    K -->|Yes| L["새 Access + Refresh<br/>localStorage 교체"]
    L --> I
    K -->|No| M["세션 만료 배너 표시"]
    M --> N["로그아웃 처리<br/>localStorage 초기화"]
    N --> A

    style A fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style E fill:#1e293b,stroke:#34d399,color:#34d399
    style D fill:#1e293b,stroke:#f87171,color:#f87171
    style M fill:#1e293b,stroke:#fb923c,color:#fb923c
    style N fill:#1e293b,stroke:#f87171,color:#f87171
```
