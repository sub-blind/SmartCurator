# SmartCurator Frontend

Next.js 14 + Tailwind 기반의 SmartCurator 프론트엔드입니다. FastAPI 백엔드와 연동되어 인증, 콘텐츠 처리, 검색, AI 어시스트까지 한 화면에서 사용할 수 있습니다.

## 로컬 실행

```bash
cd frontend
cp env.example .env.local
npm install
npm run dev
```

Node.js 18 LTS 이상과 npm이 필요합니다. 설치되어 있지 않다면 [https://nodejs.org](https://nodejs.org)에서 LTS 버전을 내려받아 주세요.

## 구조

- `src/app` – Next.js App Router 페이지
- `src/components/*` – UI 컴포넌트와 폼
- `src/lib/api.ts` – FastAPI 호출 helper

## 현재 지원 기능

1. JWT 로그인/회원가입/로그아웃
2. 콘텐츠 추가(URL, 텍스트, PDF/TXT 파일 업로드)
3. 콘텐츠 상태 조회, 재처리, 삭제
4. 의미론적 검색(`/search/semantic`) 결과 표시
5. AI 어시스트(`/chat/ask`) 답변 + 근거 출처 표시

## 개선 후보

1. 검색/챗 결과에 정렬, 필터, 하이라이트 옵션 추가
2. 대용량 파일 업로드 진행률/실패 재시도 UX 보강
3. 토큰 만료 시 자동 로그인 페이지 이동 UX 개선
