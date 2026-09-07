# 개발 및 보안 참고

## 실행

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run package
```

`npm run dev`는 UI 개발용입니다. 실제 확장 기능은 빌드된 `dist`를 Chrome에 로드해 확인합니다. 브라우저 설치 경로를 따로 지정한 경우 실행 시에도 동일한 `PLAYWRIGHT_BROWSERS_PATH` 환경 변수를 사용하세요.

## 암호화와 저장

- Web Crypto PBKDF2-SHA-256 600,000회, 16바이트 무작위 salt, AES-GCM-256, 암호화마다 새 12바이트 IV.
- 새 Master Password는 Unicode 코드 포인트 기준 8자 이상. 기존 v1 Vault는 짧은 비밀번호도 그대로 Unlock 가능.
- Vault metadata는 salt, KDF 설정, 생성 시간, 암호화된 verification을 보관. v2는 Vault ID를 verification의 AES-GCM additional data에도 바인딩.
- v1 Secret은 기존 인증 컨텍스트로 읽음. 수정 시 v2로 전환하며 ID, Vault ID, 레코드 종류와 수정 시간을 인증 컨텍스트에 포함.
- 서비스명·이름·API Key·웹사이트·메모는 모두 암호화. 레코드 ID, Vault ID, 삭제 여부, 시간은 공개 메타데이터.
- 삭제 시 `deleted:<id>`에 암호화된 삭제 기록을 먼저 저장한 뒤 `secret:<id>`를 제거. 읽기는 삭제 기록을 우선해 worker 처리 전에도 오래된 키를 표시하지 않음. 일반 키 저장에는 삭제용 1KB와 항목 1개를 예약. 자동 만료 없음. 같은 ID의 후속 수정보다 삭제가 우선.
- 형식·버전·ID·시간·Base64·IV 길이·암호문 크기·KDF 반복 수를 검증. 잘못된 데이터는 그대로 보존하고 안전한 오류 표시.
- `storage.local`, LocalStorage, IndexedDB, 외부 서버는 사용하지 않음.

## 세션과 잠금

파생 암호화 키만 `chrome.storage.session`에 저장합니다. 비밀번호나 복호화된 Secret은 저장하지 않습니다. 세션에는 무작위 세션 ID와 잠금 세대(epoch)를 함께 보관합니다.

`navigator.locks`로 extension origin 전체의 세션 저장/삭제를 직렬화합니다. Lock은 해당 popup의 generation을 즉시 바꾸고, 공유 epoch를 변경한 후 세션을 삭제합니다. 진행 중인 Unlock/복원은 generation과 epoch를 재검사합니다. 늦게 완료된 세션 저장은 자신이 작성한 세션만 정리합니다. 초기화 실패 시 키와 복호화 데이터 참조를 비웁니다.

파생 키를 세션에 저장하기 위해 최초 CryptoKey는 export 가능하게 생성합니다. 복원한 키는 export 불가능하게 import합니다. 키를 담는 임시 byte 배열은 가능한 범위에서 덮어쓰지만 JavaScript 문자열/메모리의 포렌식 삭제는 보장하지 않습니다.

## 동기화

로컬 sync 읽기/검사/쓰기는 Web Locks로 직렬화합니다. 원격 Chrome Sync 전달은 전역 트랜잭션이 아니므로, 쓰기 직전 재검사와 onChanged 조정을 함께 사용합니다.

각 Vault의 메타데이터는 `vault:descriptor:<vaultId>`에 보존합니다. 동시에 다른 Vault가 생성되면 검출 후 쓰기를 중단합니다. v1 메타데이터는 salt에서 결정적으로 계산한 내부 식별자를 사용하므로, 읽기만 하는 경우 원본 메타데이터를 변경하지 않습니다. 관련 절차와 보장 한계는 [복구 안내](recovery.md)를 참고하세요.

Background worker는 암호문만 다룹니다. 잠금 상태에서 암호문을 인증할 수는 없으므로 구조와 순서만 비교하며, 실제 인증은 Unlock 후 수행합니다. 악성 클라이언트가 Sync 데이터를 직접 덮어쓰는 상황에서 서비스 가용성을 보장하지 않습니다.

## 검증

단위/통합 테스트는 실제 Web Crypto와 메모리 기반 Chrome Storage mock을 사용합니다. UI는 jsdom, E2E는 격리된 실제 Chromium 프로필에서 빌드된 확장을 로드해 검증합니다.

E2E의 두 프로필 간 전달은 테스트가 암호문을 명시적으로 복사하는 방식입니다. Chrome Storage와 onChanged의 실제 동작은 확인하지만 Google Sync 네트워크 전달을 검증한 것은 아닙니다. 자동 테스트는 실제 두 PC QA를 대체하지 않습니다.

테스트 데이터는 실제 자격증명이 아닙니다. Playwright trace, 영상, 자동 실패 스크린샷은 비활성화했습니다. 스토어용 이미지는 별도의 테스트용 샘플만 포함합니다.

## 배포물

`npm run package`는 권한, 파일 목록, 매니페스트 자산, inline/remote script와 외부 요청 코드를 검사하고 `release/envpin-<version>.zip`과 SHA-256 파일을 생성합니다. 이는 정적 검사이며 보안 감사를 대신하지 않습니다. `release/`, 테스트 산출물과 개발 의존성은 Git과 ZIP에서 제외합니다.

[개인정보처리방침](../PRIVACY.md) · [수동 QA](manual-qa.md) · [웹스토어 제출 초안](../store/listing.md)
