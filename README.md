# Exhibition

전시회 일정과 장소, 이미지를 관리하는 Supabase 기반 PWA입니다.

## 기능

- FAB 기반 전시 일정 등록/수정 모달
- 전시명 / 장소 / 날짜 / 이미지 첨부
- 날짜 오름차순 섹션 정렬
- 세로형(포트레이트) 이미지 썸네일과 원본 이미지 보기
- 수정, 삭제 동작
- 오프라인 캐시가 적용된 기본 PWA 구성

## 실행 방법

1. `.env.example`를 복사해서 `.env` 파일을 만듭니다.
2. `.env` 값을 실제 Supabase 프로젝트 값으로 채웁니다.
3. Supabase SQL Editor에서 `supabase-schema.sql`을 실행합니다.
4. `npm install`
5. `npm run dev`

## 환경 변수

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=exhibition-images
```

## 참고

- 로그인/PIN 인증이 없는 오픈 액세스 앱입니다.
- 현재 SQL 정책은 빠른 개인 사용을 위한 공개 정책입니다.
