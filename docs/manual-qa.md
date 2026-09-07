# 실제 Chrome QA

아래 항목은 실 브라우저에서 확인해야 하는 체크리스트이며, 체크되지 않은 항목은 아직 실환경 검증되지 않았습니다. 실제 API Key 대신 폐기 가능한 테스트 문자열을 사용하세요.

- [ ] `npm run build` 후 `dist`를 Load unpacked하여 설치 오류가 없는지 확인.
- [ ] Vault 생성 → 키 추가 → 팝업 닫기/열기 → Unlock 유지 및 키 표시.
- [ ] Lock vault → 잘못된 비밀번호 오류 → 올바른 비밀번호로 복구.
- [ ] Chrome 완전 종료 후 재시작 → 잠금 상태.
- [ ] Copy → 임시 편집기에 붙여넣기 → 값 일치 및 Copied 피드백.
- [ ] Show → 10초 경과 → 자동 마스킹. 팝업을 다시 열어도 마스킹.
- [ ] Service/Name/Website/Note 검색 및 Secret 자체로 검색 불가.
- [ ] Cmd/Ctrl+K, Enter 제출, Escape 취소, Tab 포커스와 삭제 모달 확인.
- [ ] 키 수정 후 재실행 → 변경 유지. 삭제 취소와 확인 각각 검사.
- [ ] 매우 긴 Note 저장 → 용량 오류 및 기존 데이터 유지.
- [ ] DevTools에서 `chrome.storage.sync.get(null)` 검사: 테스트 Secret, 서비스명, Note, Master Password 원문 없음. `chrome.storage.local` 비어 있음.
- [ ] 동일 계정의 다른 PC에서 Sync 활성화 → metadata 도착 확인 → 기존 Vault 발견 → 비밀번호로 복구.
- [ ] 다른 PC에서 추가/수정/삭제 → 열린 팝업에 반영. 잠긴 상태와 팝업 닫힌 상태에서도 반복.
- [ ] 두 PC에서 같은 키를 변경하고 동기화 후 최신 timestamp의 변경이 남는지 확인.

실제 PC 두 대의 동기화 테스트에는 동일 확장 ID가 필요합니다. Chrome Web Store의 동일 배포본을 사용하거나 개발 환경에서 동일 ID가 유지되도록 구성하세요. 새 기기에서 Sync 도착 전에 별도 Vault를 생성하지 마세요.
