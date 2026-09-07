# Envpin Chrome Extension
## Product & Technical Design Document v0.1

### 1. 프로젝트 개요

Chrome Extension에서 여러 서비스의 API Key를 저장하고 필요할 때 빠르게 복사할 수 있는 개발자용 API Key Vault를 만든다.

핵심 경험은 API Key 발급 사이트의 Secret Key 목록 화면과 유사하게 구성한다.

사용자는 Chrome Extension을 열고 원하는 Key의 Copy 버튼을 누르는 것만으로 API Key를 사용할 수 있어야 한다.

Chrome Sync를 이용해 같은 Google/Chrome 계정으로 로그인된 다른 PC에서도 저장된 API Key 목록을 사용할 수 있도록 한다.

---

## 2. 제품 목표

### 핵심 목표

1. API Key를 한곳에서 관리한다.
2. Extension Popup을 열자마자 저장된 Key를 확인할 수 있다.
3. 한 번의 클릭으로 API Key를 복사할 수 있다.
4. API Key는 기본적으로 마스킹한다.
5. 같은 Chrome 계정의 다른 PC에서도 Key를 사용할 수 있다.
6. 웹사이트 접근 권한 없이 동작한다.
7. API Key 원문을 Chrome Sync에 그대로 저장하지 않는다.
8. 최대한 작은 권한만 요구한다.

### 제품 포지셔닝

> **Envpin — Pin. Copy. Build.**
>
> 개발에 필요한 API Key와 secret을 Chrome에 안전하게 저장하고, 어디서든 빠르게 복사해 사용하는 browser-native developer secret vault.

1Password 같은 범용 Password Manager를 대체하는 것이 목적이 아니다.

`.env`, 메모장, Slack 나에게 보내기 등에 흩어진 API Key를 빠르게 찾고 복사하기 위한 도구다.

---

# 3. MVP 범위

## 포함

- API Key 등록
- API Key 목록
- API Key 수정
- API Key 삭제
- API Key 이름 지정
- Service 이름 지정
- 선택적 Website URL
- 선택적 Note
- API Key 마스킹
- API Key 일시적으로 표시
- API Key Clipboard 복사
- Copy 완료 피드백
- 생성일 표시
- 검색
- Chrome Sync
- 암호화 저장
- Vault Lock / Unlock
- 다른 PC에서 Vault 복구

## 제외

MVP에서는 아래 기능을 구현하지 않는다.

- Content Script
- 웹페이지 API Key 자동 입력
- API Key 자동 감지
- 특정 웹사이트와 통신
- API 요청 Proxy
- API 사용량 조회
- 서버 Backend
- 자체 계정 시스템
- 팀 공유
- API Key Rotation
- Cloud Backend
- Browser 외부 동기화
- Safari / Firefox 지원

---

# 4. 핵심 사용자 흐름

## 4.1 최초 실행

Extension 설치

→ Popup 실행

→ `Create Vault`

→ Master Password 입력

→ Vault 생성

→ API Key 추가

---

## 4.2 일상적인 사용

Extension 클릭

→ Vault Unlock 상태 확인

→ API Key 목록 표시

→ 원하는 API Key의 `Copy` 클릭

→ Clipboard 복사

→ `Copied` 표시

→ Popup 닫기

---

## 4.3 Vault가 잠긴 경우

Extension 클릭

→ Master Password 입력

→ Unlock

→ Key 목록 표시

---

## 4.4 새로운 PC

Chrome 로그인

→ Extension 설치

→ Chrome Sync를 통해 encrypted vault 다운로드

→ `Existing Envpin Vault Found`

→ Master Password 입력

→ 기존 API Key 복호화

→ 사용

---

# 5. 보안 모델

## 기본 원칙

API Key 원문을 다음 위치에 저장하지 않는다.

- `chrome.storage.sync`
- `chrome.storage.local`
- LocalStorage
- IndexedDB
- 소스 코드
- 로그
- Analytics
- Error Tracking

Chrome 공식 Storage API상 `storage.sync` 데이터는 Chrome Sync를 통해 다른 브라우저로 동기화되며, 약 100KB의 전체 제한과 항목당 약 8KB 제한을 가진다.

Vault 용량에는 충분하지만 민감 데이터 원문 저장소로 취급해서는 안 된다.

따라서 `storage.sync`에는 암호문만 저장한다.

---

# 6. 암호화 구조

## Encryption

AES-GCM 256

Web Crypto API 사용.

```text
API Key
    │
    ▼
AES-GCM Encrypt
    │
    ▼
Ciphertext
    │
    ▼
chrome.storage.sync
```

## Key Derivation

Master Password로부터 encryption key를 만든다.

```text
Master Password
      │
      ▼
PBKDF2
      │
      ▼
AES Key
```

MVP:

- PBKDF2
- SHA-256
- random salt
- 충분한 iteration 수
- AES-GCM 256

향후 Argon2id 도입을 검토할 수 있지만 MVP에서는 Web Crypto API만 이용한다.

---

# 7. Master Password 처리

Master Password 자체는 절대 저장하지 않는다.

저장 금지:

```text
chrome.storage.sync
chrome.storage.local
localStorage
IndexedDB
```

Unlock 이후 생성된 CryptoKey 또는 이에 준하는 세션 상태만 메모리에 유지한다.

가능한 경우 `chrome.storage.session`을 사용하여 브라우저 세션 동안 Unlock 상태를 유지한다.

브라우저 재시작 시 Vault는 다시 Lock된다.

---

# 8. Storage 설계

Chrome Storage API 사용을 위해 Manifest에는 최소한 다음 권한만 둔다.

```json
{
  "permissions": ["storage"]
}
```

Content Script를 사용하지 않는다.

다음 권한은 요청하지 않는다.

```text
tabs
activeTab
scripting
webRequest
cookies
history
<all_urls>
```

외부 사이트 접근 권한도 요청하지 않는다.

---

# 9. Storage Access Level

`storage.sync`가 Content Script에서 읽힐 필요가 없으므로 가능하면 trusted extension contexts에서만 접근 가능하도록 설정한다.

예:

```ts
chrome.storage.sync.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS"
})
```

프로젝트 전체에서 Content Script를 만들지 않는 것을 기본 원칙으로 한다.

---

# 10. Vault 저장 구조

가능하면 모든 Key를 거대한 하나의 storage item으로 저장하지 않는다.

Chrome Sync에는 항목당 약 8KB 제한이 존재하므로 metadata와 secret을 적절히 분리한다.

예:

```ts
type VaultMetadata = {
  version: 1
  salt: string
  verification: string
  createdAt: number
}

type EncryptedSecret = {
  version: 1

  id: string

  iv: string
  ciphertext: string

  updatedAt: number
}
```

storage 예:

```text
vault:metadata

secret:<uuid>
secret:<uuid>
secret:<uuid>
```

---

# 11. 복호화 전 데이터 노출 최소화

서비스 이름이나 Note 역시 민감할 수 있다.

따라서 MVP에서는 다음 데이터를 하나의 encrypted payload 안에 넣는다.

```ts
type SecretPayload = {
  id: string

  service: string
  name: string
  secret: string

  website?: string
  note?: string

  createdAt: number
  updatedAt: number
}
```

Chrome Sync에는 아래만 존재해야 한다.

```ts
type StoredEncryptedSecret = {
  id: string
  iv: string
  ciphertext: string
  updatedAt: number
}
```

즉 Chrome Sync만 봐서는 사용자가 OpenAI Key를 저장했는지 GitHub Key를 저장했는지 알기 어렵게 만든다.

---

# 12. Vault Verification

Master Password가 맞는지 확인하기 위해 실제 API Key를 복호화해서 검사하지 않는다.

Vault 생성 시 verification payload를 만든다.

예:

```text
"API_KEY_VAULT_VERIFICATION_V1"
```

이를 Vault Key로 암호화한다.

Unlock 시 해당 ciphertext를 복호화하여 verification string과 일치하는지 확인한다.

---

# 13. Secret 모델

애플리케이션 내부 모델:

```ts
export interface Secret {
  id: string

  service: string
  name: string
  secret: string

  website?: string
  note?: string

  createdAt: number
  updatedAt: number
}
```

예:

```ts
{
  id: "01994c...",
  service: "OpenAI",
  name: "Personal",
  secret: "sk-proj-...",
  website: "https://platform.openai.com",
  note: "Personal development",
  createdAt: 1788400000000,
  updatedAt: 1788400000000
}
```

---

# 14. UI 구조

Popup 크기는 일반 Chrome Extension보다 약간 넉넉하게 잡는다.

권장:

```text
width: 380px
min-height: 480px
max-height: 600px
```

스크롤 가능.

---

# 15. Main Screen

예시:

```text
┌─────────────────────────────────┐
│ Envpin                     +    │
│                                 │
│ Search keys...                  │
│                                 │
│ OpenAI                          │
│ Personal                        │
│                                 │
│ sk-proj-•••••••••••••••8Kp2   │
│                                 │
│              Show    Copy       │
│                                 │
│ ─────────────────────────────   │
│                                 │
│ Anthropic                       │
│ Personal                        │
│                                 │
│ sk-ant-••••••••••••••••3Df    │
│                                 │
│              Show    Copy       │
│                                 │
└─────────────────────────────────┘
```

---

# 16. Secret Card

각 Secret Card에 표시:

- Service
- Name
- masked secret
- Show / Hide
- Copy
- Optional menu

Menu:

```text
Edit
Delete
```

Secret은 기본적으로 다음처럼 마스킹한다.

```text
sk-proj-••••••••••••••••K29F
```

가능하면 prefix와 마지막 4자리 정도만 보여준다.

Secret 형식이 짧으면 더 보수적으로 마스킹한다.

---

# 17. Copy Interaction

Copy 클릭:

```ts
await navigator.clipboard.writeText(secret)
```

성공:

```text
Copy
↓
Copied ✓
```

약 1.5초 후 다시 `Copy`.

복사 이벤트를 Analytics 등에 기록하지 않는다.

Secret 값 자체를 로그에 출력해서는 안 된다.

---

# 18. Show Secret Interaction

Show 클릭 시 마스킹을 해제한다.

10초 후 다시 자동으로 Hide 한다.

Popup이 닫히면 UI 메모리에서 secret reference도 가능한 범위에서 정리한다.

---

# 19. Add Secret Screen

```text
← Add API Key

Service

[ OpenAI                    ]

Name

[ Personal                  ]

Secret

[ sk-proj-________________ ]

Website
optional

[ https://                  ]

Note
optional

[                           ]

                    Save
```

필수:

```text
service
name
secret
```

선택:

```text
website
note
```

---

# 20. Service 처리

OpenAI / Anthropic / Gemini 등을 enum으로 제한하지 않는다.

사용자가 자유롭게 입력할 수 있어야 한다.

```ts
service: string
```

향후 알려진 Service에 대해서만 자동으로 icon / metadata를 보여줄 수 있다.

데이터 모델 자체는 vendor-independent하게 유지한다.

---

# 21. 검색

Popup 상단에 검색을 제공한다.

검색 대상:

```text
service
name
website
note
```

Secret 값 자체는 검색 대상에서 제외한다.

검색은 복호화된 in-memory 데이터에 대해서만 수행한다.

---

# 22. Empty State

Secret이 하나도 없는 경우:

```text
No API keys yet

Keep your API keys in one place
and copy them whenever you need.

[ Add API Key ]
```

---

# 23. Lock Screen

```text
┌─────────────────────────────────┐
│                                 │
│             Envpin              │
│                                 │
│          Vault Locked           │
│                                 │
│ Master Password                 │
│                                 │
│ [ ********************** ]      │
│                                 │
│            Unlock               │
│                                 │
└─────────────────────────────────┘
```

Enter 키로 Unlock 가능.

잘못된 Password:

```text
Unable to unlock vault.
Check your password and try again.
```

---

# 24. Header

Main Screen:

```text
Envpin

[Search]       [+]
```

Optional menu:

```text
Lock Vault
Settings
```

MVP에서는 Settings는 최소화한다.

---

# 25. Delete Interaction

실수 방지를 위해 확인이 필요하다.

```text
Delete API key?

"OpenAI / Personal" will be permanently removed
from all synced Chrome browsers.

Cancel     Delete
```

삭제 후 Sync storage에서 해당 encrypted item을 제거한다.

---

# 26. Sync 동작

Chrome Storage `sync` 사용.

Chrome Sync가 활성화되어 있다면 같은 계정의 Chrome 브라우저 간 데이터를 동기화한다.

주요 제한:

```text
Total: 102400 bytes
Per Item: 8192 bytes
Max Items: 512
```

Secret 하나를 하나의 storage item으로 관리한다.

---

# 27. Conflict 처리

두 PC에서 같은 Secret을 수정할 수 있다.

MVP에서는 Last Write Wins 정책을 사용한다.

```ts
updatedAt
```

기준으로 최신 데이터를 선택한다.

---

# 28. Sync Change Handling

`chrome.storage.onChanged`를 구독한다.

다른 PC에서 변경된 데이터가 동기화되면 현재 Popup 상태에도 반영한다.

Vault가 Unlock 상태라면 해당 item을 복호화하여 UI 상태를 갱신한다.

Vault가 Lock 상태라면 암호문만 갱신하고 복호화하지 않는다.

---

# 29. 기술 스택

권장:

```text
Chrome Extension
Manifest V3

TypeScript
React

Vite
Web Crypto API

chrome.storage.sync
chrome.storage.session
```

스타일링:

```text
Tailwind CSS
```

또는 CSS Modules.

UI 컴포넌트 의존성은 가능한 적게 유지한다.

---

# 30. Chrome Manifest

예상 Manifest:

```json
{
  "manifest_version": 3,
  "name": "Envpin",
  "version": "0.1.0",
  "description": "Securely store, sync, and copy your developer secrets across Chrome.",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

MVP에서 다음을 추가하지 않는다.

```text
host_permissions
content_scripts
externally_connectable
```

---

# 31. 프로젝트 구조

```text
src/
├── popup/
│   ├── App.tsx
│   ├── main.tsx
│   ├── pages/
│   │   ├── LockPage.tsx
│   │   ├── CreateVaultPage.tsx
│   │   ├── SecretListPage.tsx
│   │   ├── AddSecretPage.tsx
│   │   └── EditSecretPage.tsx
│   └── components/
│       ├── Header.tsx
│       ├── SearchInput.tsx
│       ├── SecretCard.tsx
│       ├── SecretValue.tsx
│       ├── CopyButton.tsx
│       ├── EmptyState.tsx
│       └── ConfirmDialog.tsx
│
├── core/
│   ├── crypto/
│   │   ├── deriveKey.ts
│   │   ├── encrypt.ts
│   │   ├── decrypt.ts
│   │   ├── vaultVerification.ts
│   │   └── encoding.ts
│   ├── storage/
│   │   ├── vaultStorage.ts
│   │   ├── secretStorage.ts
│   │   └── sessionStorage.ts
│   ├── vault/
│   │   ├── createVault.ts
│   │   ├── unlockVault.ts
│   │   ├── lockVault.ts
│   │   └── vaultState.ts
│   └── secret/
│       ├── createSecret.ts
│       ├── updateSecret.ts
│       ├── deleteSecret.ts
│       └── maskSecret.ts
│
├── types/
│   ├── Secret.ts
│   ├── Vault.ts
│   └── Storage.ts
│
└── styles/
    └── global.css
```

---

# 32. 계층 분리 원칙

React Component에서 직접 다음을 호출하지 않는다.

```ts
chrome.storage.sync
crypto.subtle
```

반드시 core layer를 거친다.

---

# 33. Crypto Interface

```ts
interface CryptoService {
  deriveKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey>

  encrypt<T>(
    value: T,
    key: CryptoKey
  ): Promise<EncryptedPayload>

  decrypt<T>(
    payload: EncryptedPayload,
    key: CryptoKey
  ): Promise<T>
}
```

---

# 34. Storage Interface

```ts
interface SecretRepository {
  getAll(): Promise<StoredEncryptedSecret[]>
  get(id: string): Promise<StoredEncryptedSecret | null>
  set(secret: StoredEncryptedSecret): Promise<void>
  remove(id: string): Promise<void>
}
```

Chrome-specific 구현은 별도 파일에 위치한다.

---

# 35. Error Handling

사용자에게 raw exception을 노출하지 않는다.

개발 모드 로그에서도 API Key 또는 plaintext payload 전체를 출력하면 안 된다.

금지:

```ts
console.log(secret)
console.log(payload)
console.log(apiKey)
```

가능:

```ts
console.error("Failed to decrypt secret", {
  secretId
})
```

---

# 36. 보안 규칙

## MUST

- API Key는 encryption 후 storage.sync에 저장
- crypto.getRandomValues로 salt 생성
- crypto.getRandomValues로 IV 생성
- 각각의 encrypt operation마다 새로운 IV 사용
- Web Crypto API 사용
- HTTPS 외부 요청 없음
- 외부 서버 사용 없음
- storage permission만 요청
- Secret log 금지
- Content Script 없음

## MUST NOT

```text
API key plaintext를 storage.sync에 저장
API key plaintext를 storage.local에 저장
Master Password 저장
hardcoded encryption key
static IV
Math.random으로 crypto 값 생성
eval
remote JavaScript
analytics SDK
external API 호출
content script
host permission
```

---

# 37. CSP

Manifest V3 기본 Content Security Policy를 유지한다.

Inline script 사용 금지.

모든 script는 빌드된 extension 내부 파일이어야 한다.

---

# 38. UX 세부사항

- Popup open: Unlock 상태이면 바로 목록
- Lock 상태이면 Lock Screen
- Copy: 복사 후 `Copied`를 1~2초 표시
- Show: 10초 후 자동 Hide
- Search: 입력 즉시 filtering
- Add: 저장 성공 후 목록으로 이동
- Edit: 저장 후 목록으로 이동
- Delete: Confirm 필요

---

# 39. Keyboard UX

지원:

```text
Enter
Escape
Cmd/Ctrl + K → Search focus
```

가능하면 다음도 지원:

```text
Arrow Up
Arrow Down
Enter → Copy
```

---

# 40. Accessibility

모든 icon button에 `aria-label`을 지정한다.

Keyboard focus visible 유지.

Color만으로 상태를 표현하지 않는다.

---

# 41. 테스트 전략

## Unit Test

우선순위 높음:

```text
maskSecret
deriveKey
encrypt/decrypt round trip
wrong password
vault verification
storage serialization
```

---

# 42. 중요 보안 테스트

### API Key plaintext 검사

저장 이후:

```ts
await chrome.storage.sync.get(null)
```

결과 JSON 어디에도 API Key 문자열이 존재하지 않아야 한다.

### Master Password 검사

`storage.sync`, `storage.local`에 Master Password가 없어야 한다.

### Wrong Password

잘못된 Password로 Vault가 unlock되지 않아야 한다.

### IV uniqueness

동일한 secret을 두 번 저장하더라도 ciphertext 또는 IV가 달라야 한다.

---

# 43. 수동 QA

### Case 1
Vault 생성 → Key 추가 → Extension 재실행 → Unlock → Key 존재

### Case 2
Key Copy → Clipboard 확인

### Case 3
Key Show → 10초 후 다시 Mask

### Case 4
다른 Chrome Profile 또는 PC → 동일 계정 Sync → Vault 발견 → Master Password → 기존 Key 복구

### Case 5
Chrome 재시작 → Vault Lock

### Case 6
Key 삭제 → Sync → 다른 PC에서도 삭제

---

# 44. MVP 개발 순서

## Phase 1 — Project Setup

- React
- TypeScript
- Vite
- Manifest V3
- Popup render
- 기본 styling

완료 조건:

Extension을 Chrome Developer Mode에서 Load unpacked 가능.

## Phase 2 — Crypto

구현:

```text
generateSalt
deriveEncryptionKey
encrypt
decrypt
encodeBase64
decodeBase64
```

Unit Test 작성.

## Phase 3 — Vault

구현:

```text
createVault
verifyPassword
unlockVault
lockVault
```

## Phase 4 — Storage

구현:

```text
getSecrets
getSecret
saveSecret
deleteSecret
```

완료 조건:

storage.sync에서 plaintext secret을 발견할 수 없어야 함.

## Phase 5 — Main UI

구현:

```text
Lock Page
Secret List
Secret Card
Copy
Show / Hide
```

## Phase 6 — CRUD

구현:

```text
Add Secret
Edit Secret
Delete Secret
```

## Phase 7 — Search / Polish

구현:

```text
Search
Empty State
Loading
Error State
Keyboard UX
Animations
```

## Phase 8 — Sync QA

다른 Chrome Profile 또는 다른 PC에서 실제 Chrome Sync 테스트.

---

# 45. MVP 완료 기준

- Extension 설치 가능
- Vault 생성 가능
- Master Password로 Unlock 가능
- API Key 추가 가능
- API Key 수정 가능
- API Key 삭제 가능
- API Key 기본 마스킹
- API Key Show 가능
- API Key Copy 가능
- 검색 가능
- Chrome Sync 동작
- 새로운 PC에서 Vault 복원 가능
- Sync storage에 plaintext API Key 없음
- Sync storage에 Master Password 없음
- Chrome 재시작 시 Lock
- Content Script 없음
- Host Permission 없음

---

# 46. 구현 우선순위 원칙

```text
Security
↓
Correctness
↓
Simple UX
↓
Visual polish
↓
Additional features
```

기능을 추가하기 위해 보안 모델을 완화하지 않는다.

---

# 47. 디자인 방향

비밀번호 관리자처럼 복잡한 UI를 만들지 않는다.

API 제공업체의 API Key 관리 화면에서 영감을 얻는다.

키워드:

```text
minimal
developer tool
clean
dense but readable
fast
neutral
technical
```

과도한 gradient, glassmorphism, 3D, animation, dashboard, sidebar 사용을 피한다.

---


# 48. 브랜딩

제품명:

```text
Envpin
```

Chrome Web Store 표시명:

```text
Envpin — API Key Vault
```

Tagline:

```text
Pin. Copy. Build.
```

제품 설명:

```text
Securely store, sync, and copy your API keys and developer secrets across Chrome.
```

브랜드 의미:

```text
ENV + PIN
```

개발에 필요한 secret을 Chrome에 Pin 해두고 필요할 때 즉시 복사한다는 컨셉이다.

브랜드 톤:

```text
minimal
developer-first
fast
technical
secure
lightweight
```

로고는 일반적인 자물쇠 아이콘보다 개발자 도구 느낌을 우선한다.

권장 방향:

```text
.env의 점(dot) + pin
terminal prompt(>) + pin
simple pin glyph + monospace wordmark
```

비밀번호 관리자처럼 보이지 않도록 과도한 lock/shield 중심의 브랜딩은 피한다.

---

# 49. 향후 기능 후보

```text
Service icons
Favorite keys
Folder / Project grouping
Keyboard-first navigation
Import / Export
Backup recovery
Passkey unlock
Biometric unlock
Key expiration reminder
Key rotation reminder
Last copied timestamp
Usage history
Firefox support
Team vault
```

---

# 50. Codex 작업 지침

이 문서를 Source of Truth로 사용한다.

명시되지 않은 기능을 임의로 추가하지 않는다.

특히 다음을 구현하지 않는다.

```text
Backend
Login
Content Script
API Proxy
API Key Autofill
Webpage Injection
Analytics
Tracking
```

코드는 가능한 작은 module로 분리하고 crypto/storage/business logic을 React component와 분리한다.

새 dependency를 설치하기 전에 브라우저 내장 API로 해결 가능한지 먼저 확인한다.

특히 암호화는 별도 Crypto Library보다 Web Crypto API를 우선한다.

보안과 관련된 shortcut을 사용하지 않는다.

---

# 51. Codex 최초 작업 Prompt

```text
이 저장소에 첨부된 설계문서를 기준으로 Envpin Chrome Extension을 구현해줘.

우선 설계문서를 전체적으로 읽고 Phase 1부터 순서대로 진행해.

기술 스택은 React + TypeScript + Vite + Chrome Manifest V3를 사용하고, 암호화에는 Web Crypto API를 사용해.

중요한 제약사항:

- chrome.storage.sync에는 plaintext API Key를 절대 저장하지 않는다.
- Master Password를 저장하지 않는다.
- Content Script를 만들지 않는다.
- host_permissions를 요청하지 않는다.
- API Key 또는 복호화된 payload를 console에 출력하지 않는다.
- 외부 Backend나 API를 사용하지 않는다.
- UI Component에서 chrome.storage나 crypto.subtle을 직접 사용하지 않고 core layer를 거친다.
- 설계문서에 없는 기능을 임의로 추가하지 않는다.

각 Phase가 완료될 때마다 관련 테스트까지 작성해.

먼저 저장소 구조를 확인한 다음 Phase 1의 프로젝트 기본 구조부터 구현해.
```

---

# 52. 최종 제품 경험

핵심 경험:

```text
Chrome Extension 클릭
        ↓
OpenAI
sk-proj-•••••••••••K92F
                 Copy
        ↓
Copied ✓
```

다른 PC에서는:

```text
Chrome 로그인
       ↓
Extension 설치
       ↓
Envpin Vault Found
       ↓
Master Password
       ↓
모든 API Key 사용 가능
```

이 두 흐름이 자연스럽게 동작하는 것이 제품의 가장 중요한 성공 기준이다.
