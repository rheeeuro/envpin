# Chrome Web Store 제출 초안

## 표시명

Envpin — API Key Vault

## 짧은 설명

Store, organize, and copy your API keys from an encrypted vault in Chrome.

## 상세 설명

Pin. Copy. Build.

Envpin keeps your developer secrets close at hand. Add a service name and key name, save your API key, and copy it whenever you need it.

• Organize API keys with optional website URLs and notes.
• Search by service, name, website, or note.
• Copy a key with one click.
• Keep keys masked by default; reveal them for 10 seconds.
• Encrypt your keys and notes locally before saving them.
• Keep the vault unlocked until you lock it or restart Chrome.
• Synchronize encrypted entries with your signed-in Chrome account when Chrome Sync is enabled.

Create a vault with a master password of at least eight characters. Choose a long, unique passphrase: there is no password recovery. Envpin does not provide an independent backup service.

Envpin requires only the storage permission. It does not read websites, automatically fill keys, operate a backend, or include analytics and advertising.

Deletion removes the saved key content and retains an encrypted deletion marker to keep an outdated offline copy from restoring it. Deletion markers use part of Chrome Sync's limited storage space. Update Envpin on all devices before using the new data format.

## 개인정보 및 지원

- 공개 정책 URL 후보: https://github.com/rheeeuro/envpin/blob/main/PRIVACY.md — 해당 커밋이 공개 저장소에 올라가 익명으로 접근 가능한지 제출 전 확인.
- 문의: https://github.com/rheeeuro/envpin/issues
- 확장 내부: privacy.html에서 동일 정책 열람 가능.
- 지원 문의에 비밀번호, API Key, 저장소 덤프를 첨부하지 않도록 안내.

## Developer Dashboard 입력 지침

- 단일 목적: 사용자가 입력한 API Key를 암호화 보관·동기화하고 찾아 복사하는 개발자용 Vault.
- storage 권한 사유: 암호화된 키와 Vault 메타데이터를 Chrome Sync에 저장하고, 잠금 해제 키를 브라우저 세션 동안 메모리 기반 extension session 저장소에 유지.
- 원격 코드: 사용하지 않음. JavaScript와 CSS는 ZIP 내부 번들로 제공.
- 데이터 처리: 인증 정보(API Key, Master Password), 사용자가 입력한 이름·URL·메모를 취급함. 비밀번호는 파생 키 생성에만 사용하고 저장하지 않음. 데이터 미취급/전혀 전송하지 않음으로 일괄 신고하지 말 것. Chrome Sync 전송과 개발자가 데이터를 수신하는 행위는 구분해 실제 대시보드 문항에 맞게 신고.
- 광고·판매·분석·추적·개발자 서버 전송 없음.
- 개인정보처리방침과 데이터 사용 인증 항목이 실제 구현과 일치하는지 검토 후 제출.

## 이미지

- public/icons/icon-128.png: 아이콘.
- store/promo-440x280.png: 작은 홍보 이미지.
- store/screenshot-keys-1280x800.png: 실제 확장 프로그램 목록 화면(샘플 데이터).
- store/screenshot-lock-1280x800.png: 실제 잠금 화면.

## 제출 보류 조건

실제 동일 Google 계정의 두 기기에서 Chrome Sync 전달과 오프라인 복귀를 확인하기 전에는 제출하지 않습니다. 자동 Chromium 테스트는 실브라우저 동작을 확인하지만 Google Sync 서비스의 실기기 검증을 대신하지 않습니다.

참고: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
참고: https://developer.chrome.com/docs/webstore/images
