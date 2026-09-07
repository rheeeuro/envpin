# 개발 및 보안 참고

## 구조와 보안

- `src/core/crypto.ts`: Web Crypto PBKDF2-SHA-256 600,000회, 16바이트 무작위 salt, AES-GCM-256, 매 암호화마다 12바이트 무작위 IV.
- `src/core/storage.ts`: Chrome 어댑터, 항목당 8KB/전체 100KB/512개 제한 사전 검사와 오류 처리.
- `src/core/vault.ts`: Vault와 Secret의 생명주기. 독립 verification payload로 비밀번호 검증.
- `src/core/session.ts`: 파생 키만 메모리 기반 `chrome.storage.session`에 저장. 비밀번호나 복호화된 Secret을 저장하지 않음.
- `src/core/sync.ts`, `src/background.ts`: 팝업이 닫히거나 Vault가 잠겨 있어도 암호문의 `updatedAt` 비교. 동률일 때 암호문으로 결정적 순서 적용. 삭제 이벤트는 복원하지 않음.
- `src/popup`: React UI. 컴포넌트는 Crypto/Chrome Storage API를 직접 호출하지 않음.

Sync에는 Vault metadata(salt, KDF 반복 횟수, 암호화된 verification)와 Secret별 암호문만 저장합니다. 서비스명·이름·웹사이트·메모도 암호화됩니다. AES-GCM additional data에 레코드 ID와 수정 시각을 포함해 레코드 바꿔치기를 검출합니다. `storage.local`, LocalStorage, IndexedDB는 사용하지 않습니다.

권한은 `storage` 하나입니다. 외부 요청, content script, host permission, 추적 SDK는 없습니다. 복사는 사용자 클릭 안에서 Clipboard API를 호출하며 실패 시 실패 피드백을 표시합니다.

Chrome Sync는 트랜잭션이나 전역 compare-and-swap을 제공하지 않습니다. 관측한 변경에는 timestamp 기반 Last Write Wins를 적용하지만, 기기들이 모두 오프라인인 상태에서의 동시 Vault 생성 및 삭제/수정 경합을 원자적으로 해결할 수는 없습니다. 편집 중 관측된 원격 변경은 저장/삭제 전에 충돌로 알립니다. 동기화가 비활성화되어 있으면 같은 기기의 저장소로만 동작합니다.

Chrome Storage 동작 참고: https://developer.chrome.com/docs/extensions/reference/api/storage

## 검증

`npm test`는 Web Crypto 실제 구현과 메모리 기반 Chrome Storage mock을 사용합니다. UI는 jsdom에서 검증합니다. 테스트용 문자열은 실제 자격증명이 아닙니다.

자동 검증: 암호화 round trip, 잘못된 비밀번호, IV 고유성, 인증 데이터 변조, 마스킹, 검색 제외 대상, 평문 저장 방지, CRUD, 세션 복원/삭제, 새 기기 복원 시뮬레이션, 저장 용량, 동기화 충돌, 복사 피드백, 10초 자동 숨김, 키보드 UX, 삭제 확인.

실제 Chrome 수동 검증은 [수동 QA 체크리스트](manual-qa.md)를 참고하세요. 자동 테스트는 실제 Chrome Sync 네트워크 검증을 대체하지 않습니다.
