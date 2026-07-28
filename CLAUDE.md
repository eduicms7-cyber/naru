@AGENTS.md

# Naru 개발 가이드

Naru는 휴대폰을 열었을 때 오늘 할 일과 기억할 정보를 바로 확인하는 개인용 모바일 앱입니다.

## 기술 스택

- Expo (React Native) + TypeScript — `npm run web`으로 같은 코드베이스를 PC 웹앱으로도 서빙합니다.
- 네비게이션: `@react-navigation/native` + `@react-navigation/bottom-tabs`
- 백엔드/동기화: Supabase (Postgres + Auth + Storage) — 로그인 후 휴대폰/웹이 같은 데이터를 공유합니다. (`src/lib/supabase.ts`, `src/auth/AuthContext.tsx`)
- 이미지 첨부: `expo-image-picker` (저장 시 Supabase Storage `memo-images` 버킷에 업로드됨)
- 아이콘: `@expo/vector-icons` (Ionicons)

## 실행 방법

```
npm install
cp .env.example .env   # Supabase 프로젝트 URL/anon key 채우기
npm run start   # Expo 개발 서버
npm run android
npm run ios
npm run web
```

최초 1회, Supabase 대시보드의 SQL Editor에서 `supabase/schema.sql`을 실행해 테이블/RLS/Storage 버킷을 만들어야 합니다.

웹 배포는 Vercel에 이 리포를 연결하면 `vercel.json`의 빌드 설정(`npx expo export --platform web` → `dist/`)을 그대로 사용합니다. Vercel 프로젝트 환경변수에도 `.env`와 동일한 `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`를 등록해야 합니다.

## 폴더 구조

```
App.tsx                     # 앱 엔트리, NavigationContainer 구성
src/
  navigation/
    TabNavigator.tsx         # 하단 탭 3개 (오늘 / 메모 / 캘린더) 구성
  screens/
    LoginScreen.tsx            # 이메일/비밀번호 로그인·회원가입
    TodayScreen.tsx           # 오늘 탭: 할일 추가/완료체크/삭제
    MemoScreen.tsx             # 메모 탭: 텍스트+이미지 메모 작성/조회/삭제
    CalendarScreen.tsx         # 캘린더 탭: 날짜별 일정 등록/조회
  auth/
    AuthContext.tsx            # 세션 상태 + signIn/signUp/signOut
  lib/
    supabase.ts                 # Supabase 클라이언트 생성
  storage/
    storage.ts                  # Supabase 공용 헬퍼 (loadItems / saveItems, 테이블별 snake_case 매핑)
    migrateLegacyData.ts        # 옛 AsyncStorage 데이터를 최초 로그인 시 1회 업로드
  types/
    index.ts                   # Todo, Memo, ScheduleEvent 타입 + STORAGE_KEYS(테이블명)
  theme/
    colors.ts                  # 공용 색상 팔레트
  utils/
    date.ts                    # 날짜 포맷 / 월간 캘린더 그리드 계산
supabase/
  schema.sql                    # 테이블 + RLS + Storage 버킷 정의 (Supabase SQL Editor에서 실행)
```

## 데이터 모델

- `Todo { id, title, done, createdAt }` — 테이블: `todos`
- `Memo { id, text, imageUri?, createdAt, reviewStage, nextReviewAt, lastReviewedAt?, isPriority? }` — 테이블: `memos`
- `ScheduleEvent { id, date(YYYY-MM-DD), title, createdAt }` — 테이블: `schedules`

각 화면은 탭에 포커스될 때마다(`useFocusEffect`) `loadItems`로 Supabase에서 다시 불러오고, 변경 시 state와 Supabase를 함께 갱신하는 `persist` 패턴을 사용합니다 — 다른 기기에서 바뀐 내용은 탭을 다시 열면 반영됩니다(실시간 푸시는 아직 없음). 새 도메인을 추가할 때는 이 패턴(타입 정의 → `STORAGE_KEYS`에 테이블명 추가 → `supabase/schema.sql`에 테이블+RLS 추가 → 화면에서 `loadItems`/`saveItems` 사용)을 따르세요. 모든 테이블은 RLS로 `auth.uid() = user_id` 본인 데이터만 접근 가능합니다.

## 코드 컨벤션

- 모든 사용자 노출 텍스트(UI 라벨, 버튼, placeholder, 알림)는 한국어로 작성합니다.
- 디자인은 깔끔하고 단순하게 유지합니다 — `src/theme/colors.ts`의 팔레트를 재사용하고, 화면마다 새 색상을 임의로 추가하지 않습니다.
- 화면 컴포넌트는 `src/screens/`에, 화면에서 공유하지 않는 로직은 해당 화면 파일 내에 두고, 여러 화면에서 쓰이는 로직만 `utils/`, `storage/`로 분리합니다.
- 새로운 의존성은 가능하면 `npx expo install`로 SDK 호환 버전을 맞춥니다. (현재 환경에서 해당 명령이 인증서 오류로 실패하면 `npm install <package>`로 대체하고, 설치 후 `package.json`의 버전이 Expo SDK와 호환되는지 확인합니다.)

## 향후 계획

- ~~AsyncStorage → Supabase 연동 (로그인 후 기기 간 동기화)~~ — 완료 (2026-06-26)
- Supabase Realtime 구독으로 진짜 실시간 동기화 (현재는 탭 포커스 시 새로고침)
- 알림/리마인더 기능 검토
