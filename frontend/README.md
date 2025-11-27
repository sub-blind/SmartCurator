# SmartCurator Frontend

Next.js 14 + Tailwind 기반의 SmartCurator 프론트엔드 초석입니다. FastAPI 백엔드의 `/auth`, `/contents` 엔드포인트와 1:1로 매핑되는 테스트 UI를 제공합니다.

## 로컬 실행

```bash
cd frontend
cp env.example .env.local
npm install
npm run dev
```

Node.js 20 LTS 이상과 npm이 필요합니다. 설치되어 있지 않다면 [https://nodejs.org](https://nodejs.org)에서 LTS 버전을 내려받아 주세요.

## 구조

- `src/app` – Next.js App Router 페이지
- `src/components/*` – UI 컴포넌트와 폼
- `src/lib/api.ts` – FastAPI 호출 helper

## 다음 단계

1. `/contents/my`를 호출하는 컨텐츠 리스트 컴포넌트 추가
2. `/search/semantic` 결과를 시각화하는 검색 패널
3. `/chat/ask` 스트리밍 응답 UI
4. Vercel에 연결하여 백엔드 API 베이스 URL을 환경 변수로 분리
