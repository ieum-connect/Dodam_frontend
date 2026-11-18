# 운영 API를 사용하는 로컬 화면 확인

PowerShell에서 승인된 운영 데이터로 화면을 확인할 때만 실행합니다.

```powershell
$env:DODAM_BACKEND_URL='https://dodam-ieum.duckdns.org'
npm run dev -- --host 127.0.0.1 --port 4175
```

- 이 모드는 예시 데이터가 아닙니다. 입력·수정·삭제는 운영에 반영됩니다.
- `/api`와 `/logout`은 지정한 서버로 전달합니다. 로컬 HTTP의 동일 출처 요청에 한해 Origin을 대상 서버 출처로 맞추고, loopback 응답 쿠키의 Secure 속성을 제거합니다. HttpOnly·SameSite는 유지합니다.
- 이 처리는 Vite 개발 프록시에만 적용하며 운영 HTTPS 쿠키나 운영 CORS 설정은 바꾸지 않습니다. 외부 인터페이스에 공개해서 실행하지 않습니다.
- 카카오 OAuth는 로컬 백엔드 설정을 따릅니다. 이 원격 API 확인 모드에서는 테스트 계정 로그인을 사용합니다.
- `JIHUN`은 기존 테스트 계정 키입니다. 현재 운영 데이터의 표시 이름은 이지훈이며 김민지와 같은 이하린 프로필에 연결되어 있습니다. 새 DB에서 기본 계정을 생성하는 백엔드 이름 변경은 이 프론트 PR의 범위가 아닙니다.

검증: `node --test src/*.test.js`, `npm run build`.
