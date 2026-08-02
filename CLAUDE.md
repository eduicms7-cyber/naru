@AGENTS.md

# Naru 개발 가이드

Naru는 휴대폰을 열었을 때 오늘 할 일과 기억할 정보를 바로 확인하는 개인용 모바일 앱입니다.

지식창고(태그·고정·색상을 지원하는 구글킵 스타일 카드 보관함)에 쌓아둔 카드를,
잠금화면/화면 켜짐 시 또는 앱 내 버튼으로 "기억의 궁전"(플래시카드 슬라이드)을 통해
망각곡선에 맞춰 복습하는 것이 핵심 기능입니다. 할일 탭은 부가 기능입니다.

## 기술 스택

- Expo (React Native) + TypeScript — `npm run web`으로 같은 코드베이스를 PC 웹앱으로도 서빙합니다.
- 네비게이션: `@react-navigation/native` + `@react-navigation/bottom-tabs`
- 백엔드/동기화: Supabase (Postgres + Auth + Storage) — 로그인 후 휴대폰/웹이 같은 데이터를 공유합니다. (`src/lib/supabase.ts`, `src/auth/AuthContext.tsx`)
- 이미지 첨부: `expo-image-picker` (저장 시 Supabase Storage `memo-images` 버킷에 업로드됨)
- 아이콘: `@expo/vector-icons` (Ionicons)

### 로컬 전용 모드 (로그인/인터넷 없이 폰에만 저장)

같은 코드베이스에서 빌드 시점 환경변수 `EXPO_PUBLIC_STORAGE_MODE=local`을 주면 로그인 화면 없이 바로 쓰는 "Naru Local" 버전이 됩니다(미설정 시 지금까지와 동일한 Supabase 클라우드 모드).
- `App.tsx`: `IS_LOCAL_MODE`면 세션 유무와 무관하게 바로 `<TabNavigator />`를 렌더링(로그인 화면 스킵).
- `src/storage/storage.ts`: `loadItems`/`createItem`/`updateItem`/`deleteItem` 각 함수 맨 앞에서 로컬 모드면 `src/storage/localStorage.ts`(AsyncStorage 전용, Supabase 미사용, 테이블당 `naru_local_${table}` 키에 배열 통째로 저장)로 위임 — 화면 코드는 이 분기를 몰라도 됨. 클라우드 로직(업로드/캐시/재시도 큐)은 로컬 모드에서 전혀 실행되지 않습니다.
- `src/screens/TodayScreen.tsx`: 로컬 모드에서는 로그아웃 버튼을 숨깁니다.
- app.json/네이티브 빌드 설정(패키지명, 앱 이름 등 실제로 두 개의 APK를 구분하는 부분)은 이 문서의 범위가 아니며 빌드할 때 별도로 관리합니다.

## 실행 방법

```
npm install
cp .env.example .env   # Supabase 프로젝트 URL/anon key 채우기
npm run start   # Expo 개발 서버
npm run android
npm run ios
npm run web
```

최초 1회, Supabase 대시보드의 SQL Editor에서 `supabase/schema.sql`을 실행해 테이블/RLS/Storage 버킷을 만들어야 합니다. 이미 `memos`/`todos` 테이블이 있는 기존 프로젝트라면 `schema.sql` 하단에 있는 마이그레이션(`memos`: `is_priority`→`is_pinned` rename, `tags`/`color`/`note_type`/`checklist_items` 컬럼 추가 · `todos`: `completed_at`/`tags` 컬럼 추가)도 한 번 실행해야 합니다.

웹 배포는 Vercel에 이 리포를 연결하면 `vercel.json`의 빌드 설정(`npx expo export --platform web` → `dist/`)을 그대로 사용합니다. Vercel 프로젝트 환경변수에도 `.env`와 동일한 `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`를 등록해야 합니다.

## 폴더 구조

```
App.tsx                     # 앱 엔트리, NavigationContainer 구성
src/
  navigation/
    TabNavigator.tsx         # 하단 탭 4개 (오늘 / 지식창고 / 캘린더 / 즐겨찾기) 구성
  screens/
    LoginScreen.tsx            # 이메일/비밀번호 로그인·회원가입
    TodayScreen.tsx           # 오늘 탭: 할일 추가/완료체크/삭제
    KnowledgeVaultScreen.tsx   # 지식창고 탭: 태그·고정·색상이 있는 카드 작성/조회/삭제, 기억의 궁전 실행
    MemoryPalaceScreen.tsx     # 기억의 궁전: 오늘 복습할 카드를 플래시카드 슬라이드로 보여주는 모달(앱 내 실행용)
    CalendarScreen.tsx         # 캘린더 탭: 일정 등록/조회 + 할일(작성일, 완료 시 완료일로 이동)·지식창고 카드(작성일)를 날짜별로 함께 보여주고 탭하면 해당 탭으로 이동
    FavoritesScreen.tsx        # 즐겨찾기 탭: 자주 가는 링크(제목+URL) 등록/삭제, 탭하면 브라우저로 열기, 화살표 버튼으로 순서 변경
  auth/
    AuthContext.tsx            # 세션 상태 + signIn/signUp/signOut
  components/
    MemoBody.tsx                # 지식창고 카드/기억의 궁전이 공유하는 본문 렌더러 (서식·헤딩·체크리스트)
    MemoImage.tsx                # 이미지 썸네일 (원본 비율 유지, 탭하면 ImageViewerModal로 확대)
    ImageViewerModal.tsx         # 이미지 전체화면 뷰어 — 모바일은 두 손가락 핀치줌(PanResponder 직접 구현), 웹은 +/- 버튼
  lib/
    supabase.ts                 # Supabase 클라이언트 생성
  storage/
    storage.ts                  # Supabase 공용 헬퍼 (loadItems / createItem / updateItem / deleteItem, 테이블별 snake_case 매핑, 개별 실패 op 재시도 큐)
    migrateLegacyData.ts        # 옛 AsyncStorage 데이터를 최초 로그인 시 1회 업로드
  types/
    index.ts                   # Todo, Memo, ChecklistItem, ScheduleEvent, Favorite 타입 + STORAGE_KEYS(테이블명)
  theme/
    colors.ts                  # 공용 색상 팔레트 + 지식창고 카드 색 프리셋(cardColors)
  utils/
    date.ts                    # 날짜 포맷(formatShortDate 등) / 월간 캘린더 그리드 계산
    tags.ts                    # 쉼표 구분 태그 입력 파싱 (지식창고/오늘 탭 공용)
    richText.ts                # **굵게**/_기울임_/~~취소선~~/# 헤딩 마크업 파싱 + 평문 변환
supabase/
  schema.sql                    # 테이블 + RLS + Storage 버킷 정의 (Supabase SQL Editor에서 실행)
```

## 데이터 모델

- `Todo { id, title, done, createdAt, completedAt?, tags? }` — 테이블: `todos`. `completedAt`은 `done`을 켤 때 채워지고 끄면 지워집니다.
- `Memo { id, text, imageUri?, createdAt, reviewStage, nextReviewAt, lastReviewedAt?, isPinned?, tags?, color?, noteType?, checklistItems? }` — 지식창고 카드. 테이블: `memos` (테이블/컬럼명은 마이그레이션 부담 때문에 그대로 유지, 화면·UI 용어만 "지식창고"). `isPinned`은 목록 상단 고정(구글킵 스타일, 별 아이콘)용이며 복습 간격에는 영향을 주지 않습니다. `tags`는 자유 라벨, `color`는 `cardColors` 프리셋 중 하나. `noteType`이 `'checklist'`면 `text`는 선택적 제목으로, `checklistItems: { id, text, done }[]`가 본문으로 쓰입니다(없으면 `'text'`로 취급하고 `text`에 `**굵게**`/`_기울임_`/`~~취소선~~`/`# 헤딩` 마크업을 쓸 수 있음 — `src/utils/richText.ts` 파싱, `src/components/MemoBody.tsx`가 렌더링).
- `ScheduleEvent { id, date(YYYY-MM-DD), title, createdAt }` — 테이블: `schedules`
- `Favorite { id, title, url, order, createdAt }` — 즐겨찾기 링크. 테이블: `favorites` (`order` 필드는 DB 컬럼 `position`에 매핑 — `order`가 SQL 예약어라 컬럼명은 다르게 둠). `order`가 작을수록 목록 위쪽에 표시되며, 화살표 버튼으로 순서를 바꿀 때는 인접한 두 항목의 `order` 값을 서로 맞바꿔 각각 개별 `updateItem`으로 저장합니다.

## 기억의 궁전 (잠금화면 복습 위젯)

`isDueForReview`로 오늘 복습할 메모(`src/memory/spacedRepetition.ts`)가 있으면:
- 앱 내: 지식창고 화면의 "기억의 궁전" 버튼 또는 배너 → `MemoryPalaceScreen` 모달에서 스와이프로 카드를 넘기고 카드별 "기억완료" 버튼으로 `markRemembered` 적용.
- 잠금화면: `src/native/ReviewWidget.ts`가 `setDueMemos`로 due 목록(+색상)을 네이티브(`android/app/src/main/java/com/naru/app/reviewwidget/`)에 전달 → 화면이 켜지면 `WakeReviewActivity`가 풀스크린으로 카드를 슬라이드 보여줌. 카드별 "기억완료"는 JS 없이 `PendingCompletionStore`(SharedPreferences)에 쌓이고, 앱이 다음에 포커스될 때(`getPendingCompletions`) `KnowledgeVaultScreen`이 이를 읽어 `markRemembered`를 적용합니다. 체크하지 않은 카드는 `nextReviewAt`이 그대로라 다음 실행 때도 다시 나타납니다.

기억의 궁전은 오늘 할 일(미완료)이 있으면 그 목록을 스와이프 덱의 **첫 카드**로 보여줍니다(카드 안 항목을 탭하면 그 줄만 완료 처리되어 사라짐, 카드 자체는 세션 중 유지) — `KnowledgeVaultScreen`이 `Todo`도 함께 불러와 `setTodos`로 네이티브에 전달하고, 앱 내/잠금화면 모두 체크한 항목은 각각 memo와 완전히 별도인 `PendingTodoCompletionStore`/`getPendingTodoCompletions`를 거쳐 `TodayScreen`이 `done`/`completedAt`으로 반영합니다. 네이티브 쪽은 할일 카드가 있으면 `WakeReviewActivity`의 슬라이드 인덱스가 1칸 밀리므로(`memoOffset`), 복습 카드 인덱스 계산과 "기억완료" 버튼 표시 여부가 여기에 맞춰져 있습니다.

탭 간 "링크"는 `TabParamList`(`src/navigation/TabNavigator.tsx`)의 `focusTodoId`/`focusMemoId` 파라미터로 구현합니다 — `CalendarScreen`이 `navigation.navigate('오늘'|'지식창고', { focusTodoId | focusMemoId })`로 이동시키면, 해당 화면이 목록 로드 후 그 id를 찾아 수정화면을 자동으로 열고 `navigation.setParams`로 파라미터를 비웁니다.

각 화면은 탭에 포커스될 때마다(`useFocusEffect`) `loadItems`로 Supabase에서 전체 목록을 다시 불러오고, 변경(추가/수정/삭제)이 생기면 로컬 state를 먼저 낙관적으로 갱신한 뒤 `createItem`/`updateItem`/`deleteItem`으로 그 항목 하나만 서버에 반영합니다 — 다른 기기에서 바뀐 내용은 탭을 다시 열면 반영됩니다(실시간 푸시는 아직 없음). **주의: 화면 전체 배열을 통째로 서버에 밀어넣고 거기 없는 id를 삭제하는 "diff 기반 저장"은 절대 쓰지 않습니다** — 기기별로 로컬 캐시가 서로 어긋난 상태에서 그런 방식을 쓰면 다른 기기가 방금 추가한 데이터를 통째로 삭제해버리는 사고가 날 수 있습니다(실제로 발생했던 데이터 유실 버그). 네트워크 실패 시에는 실패한 작업(op) 하나만 AsyncStorage 큐(`naru_pending_ops_*`)에 쌓아 두었다가 다음 `loadItems` 때 개별 재생(`flushPendingOps`)합니다. 새 도메인을 추가할 때는 이 패턴(타입 정의 → `STORAGE_KEYS`에 테이블명 추가 → `supabase/schema.sql`에 테이블+RLS 추가 → 화면에서 `loadItems`/`createItem`/`updateItem`/`deleteItem` 사용)을 따르세요. 모든 테이블은 RLS로 `auth.uid() = user_id` 본인 데이터만 접근 가능합니다.

## 코드 컨벤션

- 모든 사용자 노출 텍스트(UI 라벨, 버튼, placeholder, 알림)는 한국어로 작성합니다.
- 디자인은 깔끔하고 단순하게 유지합니다 — `src/theme/colors.ts`의 팔레트를 재사용하고, 화면마다 새 색상을 임의로 추가하지 않습니다.
- 화면 컴포넌트는 `src/screens/`에, 화면에서 공유하지 않는 로직은 해당 화면 파일 내에 두고, 여러 화면에서 쓰이는 로직만 `utils/`, `storage/`로 분리합니다.
- 새로운 의존성은 가능하면 `npx expo install`로 SDK 호환 버전을 맞춥니다. (현재 환경에서 해당 명령이 인증서 오류로 실패하면 `npm install <package>`로 대체하고, 설치 후 `package.json`의 버전이 Expo SDK와 호환되는지 확인합니다.)

## 향후 계획

- ~~AsyncStorage → Supabase 연동 (로그인 후 기기 간 동기화)~~ — 완료 (2026-06-26)
- ~~메모 → 지식창고 리브랜딩(태그/고정/색상) + 기억의 궁전(플래시카드 슬라이드) 통합~~ — 완료 (2026-07-28)
- Supabase Realtime 구독으로 진짜 실시간 동기화 (현재는 탭 포커스 시 새로고침)
- 구글킵 스타일 시간 지정 알림(리마인더) 검토 — 현재는 복습 예정일 기반 알림만 존재
