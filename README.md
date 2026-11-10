# 도담 프론트엔드

아이 건강 기록, 병원 방문, 복약 알림, 예방접종, 성장 발달, 복지 서비스, 메모와 AI 상담을 한곳에서 관리하는 모바일 퍼스트 웹앱 프로토타입입니다.

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

---

## 📚 팀 개발 컨벤션

도담(DODAM) 프로젝트는 프론트엔드, Spring 백엔드, AI 백엔드가 공통 개발 컨벤션을 따릅니다.

- [브랜치 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/BRANCH_CONVENTION.md)
- [커밋 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/COMMIT_CONVENTION.md)
- [PR 컨벤션](https://github.com/ieum-connect/Dodam_backend/blob/develop/docs/convention/PR_CONVENTION.md)

개발 절차: Issue 생성 → 브랜치 생성 → 개발 및 커밋 → PR 생성 → 코드 리뷰 → 승인 → 병합

## 일정 및 복약 관리

홈의 복용약에서 복약 제목, 시간, 용량·복용 방법 메모를 저장합니다. 종료일을 지정하거나 종료 없이 매일 같은 시간에 반복 등록할 수 있고, 각 날짜의 일정을 개별 수정·취소하거나 복용 완료로 기록합니다. 가족 건강 일정에서도 같은 기록을 확인할 수 있습니다.

시간이 된 일정은 백엔드가 앱 내 알림으로 전달합니다. 로그인한 화면은 15초마다 알림을 갱신하며, 알림을 누르면 해당 아이와 날짜의 일정으로 이동합니다. 운영체제 푸시 알림은 제공하지 않습니다. 완료·취소한 일정은 새 알림 대상에서 제외합니다.

로컬 확인 시 `VITE_API_BASE_URL`에 백엔드 주소를 지정합니다. 이 화면의 등록·조회·완료·알림에는 AI 호출이 필요하지 않습니다.


## 기록 화면
- 육아 메모: 아이별 가족 공용 태그 관리·필터, 날짜별 타임라인, 메모에서 복약 입력으로 연결합니다. 약 이름과 복용 시각은 직접 확인해 입력하며 저장 전에는 일정이 생성되지 않습니다.
- 성장: 실제 키·몸무게 입력과 수정·삭제, 3/6/12개월·전체 기간의 날짜축, 측정점 선택을 제공합니다. 정상 범위 판정 기능이 아닙니다.
- 통합 기록: 병원 방문·문서·메모·일정을 날짜별로 조회하며 첫 페이지만이 아닌 전체 커서를 읽습니다.
- 회귀 검사: `node --test src/growth.test.js src/timeline.test.js` 및 `npm run build`.
- 필요한 API: Backend의 복약·메모 연동 PR 및 성장 기록 PR을 먼저 반영합니다. 실제 앱 푸시·운영 배포는 별도입니다.

## PWA 설치
- 확인: `npm run build && npm run preview` 후 http://localhost:4173 에서 개발자도구 Application 탭(Manifest, Service Workers)을 봅니다. 개발 서버(`npm run dev`)에서는 서비스 워커를 등록하지 않습니다. LAN IP 주소는 HTTPS가 아니라 서비스 워커가 동작하지 않습니다.
- 캐시 정책: `/api`, `/oauth2`, `/login`, `/logout`과 GET이 아닌 요청, 다른 출처 요청은 서비스 워커가 처리하지 않습니다. 페이지는 네트워크 우선이고 오프라인이면 마지막으로 받은 화면 또는 `offline.html`을 보여 줍니다. `/assets/` 해시 파일만 캐시 우선입니다.
- 배포 주의: HTTPS가 필요합니다. `sw.js`, `index.html`, `manifest.webmanifest`는 `Cache-Control: no-cache`로 내려야 새 버전이 바로 반영됩니다(`/assets/*`는 길게 캐시해도 됩니다). `.webmanifest`는 `application/manifest+json` MIME 타입으로 내려 주세요. `public/sw.js`의 캐시 로직을 바꿀 때만 `VERSION`을 올립니다.
