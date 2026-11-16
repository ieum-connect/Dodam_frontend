<div align="center">

<img src="./docs/assets/dodam_logo_effect.gif" width="100%" alt="도담 애니메이션 배너" />

# 도담 Frontend

![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=20232A)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase_Cloud_Messaging-FFCA28?style=flat-square&logo=firebase&logoColor=20232A)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=20232A)

[Spring Backend](https://github.com/ieum-connect/Dodam_backend) · [AI Backend](https://github.com/ieum-connect/Dodam_AI_backend)

</div>

---

## 1. 🧭 전체 시스템 구조

```mermaid
flowchart LR
    USER["👨‍👩‍👧 보호자<br/>Mobile · Desktop"] -->|화면 조작| FE
    subgraph FRONT["🎨 Frontend · React PWA"]
        FE["화면 · 사용자 경험"] --> STATE["아이 · 기록 · 문서<br/>화면 상태"]
        STATE --> API["API Client<br/>Cookie 인증 · 오류 처리"]
        FE --> PWA["Service Worker<br/>설치 · 캐시 · Push"]
    end
    API -->|HTTPS · /api/*| BE
    subgraph SPRING["⚙️ Spring Backend"]
        BE["인증 · 권한 · 비즈니스 로직"]
        BE --> CORE["아이 · 방문 · 일정<br/>메모 · 성장 · 복지"]
        BE --> DOC["문서 업로드<br/>AI 작업 요청"]
    end
    CORE --> DB[("🗄️ PostgreSQL")]
    DOC --> STORAGE[("📁 문서 저장소")]
    DOC -->|Internal API<br/>X-Internal-Token| AI
    subgraph FASTAPI["🤖 AI Backend · FastAPI"]
        AI["의료 문서 분석"] --> RAG["문서 검색 · RAG"]
        AI --> MODEL["LLM · VLM · Embedding"]
        WELFARE["복지 추천 설명"] --> MODEL
    end
    AI --> DB
    AI --> STORAGE
    BE -->|상담 · 복지 설명 요청| AI
    BE -->|Push 발송| FCM["🔔 Firebase Cloud Messaging"]
    FCM -->|Web Push| PWA
```

<details>
<summary><b>🔎 서비스별 책임 자세히 보기</b></summary>

| 영역 | 주요 책임 |
|---|---|
| 🎨 Frontend | 화면 렌더링, 사용자 입력, 아이 선택, API 요청, 처리 상태 표시, PWA와 Push |
| ⚙️ Spring Backend | 로그인, 접근 권한, 데이터 검증, 핵심 도메인 관리, AI 요청 중계와 결과 조회 |
| 🤖 AI Backend | 의료 문서 분석, 문서 임베딩, 근거 검색, AI 상담, 복지 추천 설명 |
| 🗄️ PostgreSQL | 사용자·아이·방문·문서·일정·AI 결과 저장 |
| 📁 문서 저장소 | 원본 건강 문서와 처리 파일 저장 |
| 🔔 Firebase | 브라우저와 설치형 PWA에 Web Push 전달 |

</details>

---

## 2. 🎨 프론트엔드의 위치와 역할

> 프론트엔드는 **AI 서버를 직접 호출하지 않습니다.**
> 모든 요청은 Spring Backend에서 인증과 아이 접근 권한을 확인한 뒤 필요한 작업만 AI Backend로 전달합니다.

```mermaid
flowchart LR
    USER["👤 사용자"] --> UI["React UI"] --> CLIENT["src/api.js"]
    CLIENT -->|credentials: include| SPRING["Spring Backend"]
    SPRING -->|일반 기능| DATA["일정 · 기록 · 가족 · 복지"]
    SPRING -->|AI 작업 중계| AI["AI Backend"]
    DATA --> SPRING
    AI --> SPRING
    SPRING --> CLIENT --> UI
```

<details>
<summary><b>🧩 프론트엔드가 담당하는 일</b></summary>

- 📱 모바일 우선 화면과 데스크톱 반응형 UI
- 👶 로그인 상태, 현재 사용자와 선택한 아이 관리
- 🏥 병원 방문·문서·메모·성장·예방접종 화면 연결
- 🤖 AI 작업의 대기·진행·완료·실패 상태 표시
- 💊 복약·일정 등록, 수정, 취소와 완료 처리
- 🔔 알림 클릭 후 관련 아이와 날짜로 이동
- 📲 PWA 설치, 캐시와 오프라인 대체 화면
- 🔐 Firebase Token 등록·해제와 Push 설정
- 💬 API 오류를 사용자 친화적인 메시지로 변환

AI API Key, 데이터베이스 계정, JWT Secret과 내부 통신 Token은 브라우저에 저장하지 않습니다.

</details>

---

## 3. 🔄 주요 서비스 흐름

<details open>
<summary><b>📄 건강 문서 업로드 → AI 분석</b></summary>

```mermaid
sequenceDiagram
    actor User as 👤 보호자
    participant FE as 🎨 Frontend
    participant BE as ⚙️ Spring Backend
    participant FS as 📁 문서 저장소
    participant AI as 🤖 AI Backend
    participant DB as 🗄️ PostgreSQL
    User->>FE: 검사 결과지·처방전 선택
    FE->>BE: multipart 업로드 + Idempotency-Key
    BE->>BE: 로그인·아이 접근 권한 검사
    BE->>FS: 원본 문서 저장
    BE->>DB: 문서 상태 UPLOADED 저장
    BE-->>FE: 문서 ID·처리 상태 반환
    BE->>AI: POST /internal/documents/{id}/analyze
    AI-->>BE: 202 Accepted
    AI->>FS: 원본 문서 읽기
    AI->>AI: 페이지 변환 · 정보 추출<br/>쉬운 설명 · 근거 · 임베딩 생성
    AI->>DB: 분석 결과와 할 일 후보 저장
    loop 분석 완료까지 상태 확인
        FE->>BE: 문서·설명 상태 조회
        BE->>DB: 최신 처리 상태 조회
        BE-->>FE: PROCESSING / READY / FAILED
    end
    FE-->>User: AI 설명·근거·주의 항목 표시
```

> 일정이나 복약 후보는 보호자가 내용을 확인하고 승인해야 실제 일정으로 생성됩니다.

</details>

<details>
<summary><b>💬 문서 기반 AI 건강 상담</b></summary>

```mermaid
sequenceDiagram
    actor User as 👤 보호자
    participant FE as 🎨 Frontend
    participant BE as ⚙️ Spring Backend
    participant AI as 🤖 AI Backend
    participant DB as 🗄️ PostgreSQL
    User->>FE: 아이와 참고 문서 선택
    User->>FE: 건강 관련 질문 입력
    FE->>BE: 질문·대화 세션·문서 ID 전송
    BE->>BE: 사용자·문서 접근 권한 확인
    BE->>AI: 상담 응답 요청
    AI->>DB: 관련 문서 청크와 근거 검색
    AI->>AI: 검색 근거 기반 답변 생성
    AI-->>BE: 답변과 근거 반환
    BE->>DB: 대화 내용 저장
    BE-->>FE: 답변·참고 문서 반환
    FE-->>User: 대화형 답변 표시
```

</details>

<details>
<summary><b>📝 메모·일정 저장과 조회</b></summary>

```mermaid
sequenceDiagram
    actor User as 👤 보호자
    participant FE as 🎨 Frontend
    participant BE as ⚙️ Spring Backend
    participant DB as 🗄️ PostgreSQL
    User->>FE: 아이 선택·기록 조회
    FE->>BE: GET /api/... + 인증 Cookie
    BE->>BE: 로그인·아이 접근 권한 확인
    BE->>DB: 기록 조회
    DB-->>BE: 조회 결과
    BE-->>FE: JSON 응답
    FE-->>User: 메모·일정 화면 렌더링
    User->>FE: 등록·수정·완료·취소
    FE->>BE: POST / PUT / PATCH / DELETE
    BE->>BE: 입력값·권한·Version 검증
    BE->>DB: 데이터 저장
    BE-->>FE: 최신 데이터 반환
    FE-->>User: 목록과 상세 화면 갱신
```

</details>

---

## 4. 🛠️ 기술 스택

<details open>
<summary><b>🎨 Frontend</b></summary>

| 분류 | 기술 | 사용 목적 |
|---|---|---|
| UI | React | Component 기반 화면 구현 |
| Build | Vite | 개발 서버와 Production Bundle 생성 |
| Language | JavaScript · JSX | Frontend Application 구현 |
| Styling | CSS | Mobile First 반응형 UI |
| Icons | Lucide React | 서비스 아이콘 |
| API | Fetch API | Spring Backend HTTP 통신 |
| Push | Firebase Cloud Messaging | Browser·PWA Web Push |
| PWA | Service Worker · Web App Manifest | 설치, 캐시와 Offline 대응 |
| Test | Node.js Test Runner | 성장 그래프·Timeline 회귀 테스트 |

</details>

<details>
<summary><b>🔗 연동 시스템</b></summary>

| 분류 | 기술 |
|---|---|
| Business Backend | Spring Boot |
| AI Backend | FastAPI |
| Database | PostgreSQL |
| Authentication | Kakao OAuth2 · 인증 Cookie |
| AI | LLM · VLM · Embedding · RAG |
| Push Provider | Firebase Cloud Messaging |

</details>

---

## 5. 📲 PWA와 푸시 알림

```mermaid
flowchart LR
    A["💊 일정·복약 등록"] --> B["🎨 Frontend"]
    B -->|/api/schedules| C["⚙️ Spring Backend"]
    C --> D[("일정 저장")] --> E["알림 시각 확인"]
    E --> F["앱 내 알림"]
    E --> G["Firebase Push"]
    F --> H["알림 목록"] --> J["관련 아이·날짜로 이동"]
    G --> I["Browser · 설치형 PWA"] --> J
```

<details>
<summary><b>🔔 Web Push 등록 흐름</b></summary>

1. `/api/push/config`에서 공개 설정을 받습니다.
2. 사용자가 Browser 알림 권한을 허용합니다.
3. Firebase Push Token을 발급받습니다.
4. Token을 Spring Backend에 등록합니다.
5. 알림 발생 시 Firebase를 통해 Push를 전송합니다.
6. 알림을 누르면 도담 알림 화면으로 이동합니다.

로그아웃 또는 계정 전환 시 등록된 기기 Token을 해제합니다.

</details>

<details>
<summary><b>📦 PWA 캐시 정책</b></summary>

- Production Build에서만 Service Worker를 등록합니다.
- 페이지 요청은 **Network First**로 처리합니다.
- `/assets/` Hash 파일은 **Cache First**로 처리합니다.
- API·OAuth·Login·Logout 요청은 Service Worker Cache에서 제외합니다.
- Network와 필수 Cache를 사용할 수 없으면 `offline.html`을 표시합니다.

</details>

<details>
<summary><b>🚀 운영 배포 체크리스트</b></summary>

- Service Worker와 Push API 사용을 위해 HTTPS가 필요합니다.
- iOS는 Safari에서 홈 화면에 추가한 PWA로 Push를 사용합니다.
- `index.html`, `sw.js`, `manifest.webmanifest`는 `Cache-Control: no-cache`를 권장합니다.
- Hash가 포함된 `/assets/*` 파일은 장기 Cache할 수 있습니다.
- `manifest.webmanifest`는 `application/manifest+json` MIME Type으로 제공합니다.
- API와 OAuth 경로는 Frontend와 동일 출처로 제공하는 구성을 권장합니다.

</details>

---

## 6. 🖼️ 화면 미리보기

> 현재 Frontend와 Local Demo Data를 기준으로 직접 캡처한 화면입니다.

### 📝 메모 · 📅 일정

<table>
  <tr>
    <td align="center"><b>육아 메모</b></td>
    <td align="center"><b>가족 건강 일정</b></td>
  </tr>
  <tr>
    **추후 추가**
  </tr>
</table>

### 📄 건강 문서 업로드

**추후 추가**

### 🤖 문서 기반 AI 채팅

**추후 추가**

---

## 7. 🗂️ 프로젝트 구조

<details>
<summary><b>📂 디렉터리 구조 펼쳐보기</b></summary>

```text
Dodam_frontend
├── public
│   ├── dodam-logo.png          # 서비스 로고
│   ├── manifest.webmanifest    # PWA 정보
│   ├── sw.js                   # Cache·Offline·Push Service Worker
│   ├── offline.html            # Offline 대체 화면
│   └── icon-*.png              # PWA 아이콘
├── docs
│   ├── screenshots             # README 화면 이미지
│   ├── care-ui                 # 기록 화면 검증 자료
│   └── PUSH_AND_VISIT_FLOW.md  # Push·방문 기록 검증
├── src
│   ├── main.jsx                # App 진입점과 주요 화면 흐름
│   ├── api.js                  # Spring Backend API Client
│   ├── styles.css              # 공통 UI Style
│   ├── care-workspace.css      # 기록 관리 Layout
│   ├── CalendarScreen.jsx      # 일정·복약·방문 Calendar
│   ├── RecordTimeline.jsx      # 통합 기록 Timeline
│   ├── MemoScreen.jsx          # 육아 메모와 Tag
│   ├── GrowthScreen.jsx        # 성장 기록
│   ├── ChildSheet.jsx          # 아이 선택·등록·관리
│   ├── ProfileEditSheet.jsx    # 보호자 Profile 수정
│   ├── PushSettings.jsx        # Push 설정
│   ├── PushOnboarding.jsx      # 알림 권한 안내
│   ├── push.js                 # Firebase Token 관리
│   ├── vaccination/            # 예방접종 화면
│   ├── welfare/                # 복지 서비스 화면
│   ├── growth.js               # 성장 Chart 계산
│   ├── timeline.js             # Timeline 병합·Page 조회
│   └── *.test.js               # 회귀 테스트
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

</details>

---

## 8. 🚀 로컬 실행

<details open>
<summary><b>▶️ 설치 및 실행</b></summary>

```bash
git clone https://github.com/ieum-connect/Dodam_frontend.git
cd Dodam_frontend
npm ci
npm run dev
```

기본 개발 주소는 `http://localhost:4173`입니다.

Vite는 `/api`, `/oauth2`, `/login/oauth2`, `/logout` 요청을 Local Spring Backend로 Proxy합니다.

</details>

<details>
<summary><b>📦 Production Build와 Preview</b></summary>

```bash
npm run build
npm run preview
```

Build 결과는 `dist/`에 생성됩니다.

</details>

<details>
<summary><b>🔗 함께 실행해야 하는 저장소</b></summary>

- [Dodam Backend](https://github.com/ieum-connect/Dodam_backend)
- [Dodam AI Backend](https://github.com/ieum-connect/Dodam_AI_backend)

AI 서버가 없어도 일정, 메모와 성장 기록 같은 일반 기능은 확인할 수 있습니다. 문서 분석·AI 상담·AI 복지 설명에는 AI Backend가 필요합니다.

</details>

---

## 9. 🔐 환경 변수와 프록시

<details>
<summary><b>⚙️ Frontend 환경 변수 예시</b></summary>

```env
# 개발 Proxy 사용 시 비워 두는 것을 권장합니다.
VITE_API_BASE_URL=

# 고정 AI 테스트 응답임을 화면에 표시합니다.
VITE_AI_TEST_MODE=false
```

</details>

<details>
<summary><b>🛡️ Browser 환경 변수 보안</b></summary>

`VITE_`로 시작하는 값은 Browser Bundle에 포함될 수 있습니다. 다음 정보는 절대 넣지 않습니다.

- AI API Key
- Database 계정
- Firebase 관리자 인증 파일
- JWT Secret
- Spring ↔ AI 내부 통신 Token
- OAuth Client Secret

</details>

<details>
<summary><b>🔀 개발 Proxy 대상 변경</b></summary>

```powershell
$env:DODAM_BACKEND_URL="http://127.0.0.1:8081"
npm run dev
```

</details>

---

## 10. ✅ 테스트와 빌드

<details open>
<summary><b>🧪 검증 명령어</b></summary>

```bash
node --test src/growth.test.js src/timeline.test.js
npm run build
```

```text
Tests: 9 passed
Production build: passed
```

</details>

<details>
<summary><b>📋 회귀 테스트 범위</b></summary>

- 3개월·6개월·12개월 성장 Graph 날짜 범위
- 월말과 윤년 날짜 계산
- 범위 밖이거나 값이 없는 측정 Data 제외
- 최신 성장 기록 정렬
- 병원 방문·문서·메모 날짜 병합
- 취소 일정 제외와 완료 일정 표시
- Cursor 기반 전체 Page 조회
- 반복 Cursor 감지와 요청 취소 처리

</details>

---

## 11. 🤝 개발 컨벤션

<details>
<summary><b>📚 공통 컨벤션 문서</b></summary>

- [브랜치 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/BRANCH_CONVENTION.md)
- [커밋 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/COMMIT_CONVENTION.md)
- [PR 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/PR_CONVENTION.md)

</details>

```mermaid
flowchart LR
    ISSUE["📌 Issue"] --> BRANCH["🌿 Branch"] --> DEVELOP["💻 Develop"]
    DEVELOP --> TEST["✅ Test"] --> COMMIT["📝 Commit"]
    COMMIT --> PR["🔍 Pull Request"] --> REVIEW["👀 Code Review"] --> MERGE["🎉 Merge"]
```

---

<div align="center">

### 아이의 검진 결과를 읽고, 필요한 돌봄으로 💗

Made by **Team IEUM**

</div>
