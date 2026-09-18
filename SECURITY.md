# Envpin Security Policy

Envpin is a Chrome extension that stores developer secrets locally encrypted in Chrome Sync. This document defines the supported versions, reporting process, threat model, cryptographic format, and current assurance limits.

## Supported versions

Security fixes are provided for the latest released version only. Before reporting a problem, reproduce it on the current Chrome Web Store release or the latest source on the default branch when possible.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Do not post API keys, passwords, exported Chrome storage, proof-of-concept secrets, or screenshots containing secrets in a public issue.

This repository does not currently publish a private security-reporting address. To request a private contact route, open a minimal [GitHub issue](https://github.com/rheeeuro/envpin/issues) that describes only the affected Envpin version and the general class of problem. Do not include exploit details until a private route has been agreed.

Reports should include the affected version, Chrome version and operating system, the security impact, minimal reproduction steps, and whether the issue requires an unlocked vault or local device access. No response-time or disclosure deadline is guaranteed, but reports will be evaluated before public technical details are discussed.

## Security design

- Envpin requests only Chrome's `storage` permission. It has no host permissions and does not read visited websites.
- Envpin has no application backend, account system, analytics, advertising, or tracking SDK.
- Service names, key names, websites, notes, and secret values are encrypted locally before being written to Chrome Sync.
- The master password is used locally to derive an encryption key and is not stored.
- The derived key is kept in `chrome.storage.session` while the vault is unlocked. Locking invalidates and removes the session; a browser restart clears session storage.
- The background worker handles ciphertext and metadata only and does not receive the session key.
- Deletion records take precedence over stale entry records so an offline device cannot silently restore a deleted entry with the same ID.
- Conflicting vault metadata pauses writes and preserves available metadata for manual recovery.

## Cryptographic format

Current vaults use Web Crypto PBKDF2 with SHA-256, 600,000 iterations, and a random 16-byte salt to derive an AES-GCM-256 key. Each encryption operation uses a fresh random 12-byte IV. Vault and record identity, record kind, and update time are bound as AES-GCM additional authenticated data in the current format.

Vault metadata includes the format version, salt, KDF parameters, creation time, vault identifier, and encrypted password-verification data. Record identifiers, vault identifiers, timestamps, record type, and deletion status are metadata and are not treated as confidential. See [development and security notes](docs/development.md) for implementation details and migration behavior.

## Threat model

Envpin is designed to reduce exposure of secrets stored in Chrome and synchronized through Chrome Sync. It aims to protect secret contents from disclosure in raw extension storage and to detect tampering with encrypted contents through AES-GCM authentication.

Envpin does not claim to protect against:

- Malware, a malicious extension, or an attacker controlling an unlocked device or browser profile.
- Clipboard history, clipboard synchronization, or applications that read a secret after the user copies it.
- A weak or reused master password and offline password guessing against copied vault data.
- Denial of service, rollback, deletion, or quota exhaustion by an actor able to modify Chrome Sync data.
- Compromise of Chrome, the operating system, the Google account, or Google's infrastructure.
- Immediate deletion from every offline device or from provider backups.
- Loss of the master password. Envpin has no password reset or backup recovery feature.

## Verification and audit status

Automated tests cover cryptographic validation, storage behavior, session races, conflict handling, deletion precedence, and built-extension flows in isolated Chromium profiles. The exact tested versions and limits are documented in [verification results](docs/verification-0.2.0.md).

The automated cross-profile test copies encrypted storage data explicitly and does not by itself verify Google's Sync network. Separate physical-device QA between Windows and macOS passed creation, modification, deletion, offline recovery, browser restart, and concurrent-edit scenarios through Chrome Sync on September 16, 2026. See the [physical-device Sync results](docs/physical-sync-verification-2026-09-16.md). Envpin has not received an independent security review or audit. Passing the project's tests, physical-device QA, package checks, or `npm audit` is not equivalent to a security audit.

## Release integrity

`npm run package` builds the extension, checks its permission and runtime-file set, rejects inline or remote scripts and external-request primitives, and produces a versioned ZIP with a SHA-256 file under `release/`. Release artifacts are not committed to the repository. Compare an artifact only with the source tag and checksum published for that release.

[Privacy policy](PRIVACY.md) · [Manual QA checklist](docs/manual-qa.md) · [Vault conflict recovery](docs/recovery.md)
