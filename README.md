# Envpin

**English** | [한국어](README-ko.md)

**Pin. Copy. Build.**

A small, private API key vault for Chrome. Store developer secrets, copy them when you need them, and sync locally encrypted vault data across your Chrome installations.

**No Envpin account · No backend · No website access · No analytics**

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/envpin-%E2%80%94-api-key-vault/jbgcepnmfgekljldjlfakmjphbomgkec) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Report an issue](https://github.com/rheeeuro/envpin/issues)

## Why Envpin

API keys often end up scattered across notes, chat messages, and local `.env` files. Envpin gives individual developers one small vault in Chrome without asking for access to the websites they visit or sending the vault to an Envpin server.

Envpin requests only Chrome's `storage` permission. Secret contents are encrypted locally before they are written to Chrome Sync, and the master password is not stored.

## Trust model at a glance

| Property | Envpin |
| --- | --- |
| Envpin backend | None |
| Separate Envpin account | Not required |
| Website or host access | None |
| Analytics or advertising | None |
| Chrome permission | `storage` only |
| Secret storage | AES-GCM encrypted before storage |
| Cross-device sync | Locally encrypted vault data via Chrome Sync |
| Master password | Used locally; not stored |

<p align="center">
  <img src="store/screenshot-keys-1280x800.png" width="49%" alt="Envpin API key list" />
  <img src="store/screenshot-lock-1280x800.png" width="49%" alt="Envpin locked vault" />
</p>

## Features

- **One-click copy** — Copy a secret directly from the popup.
- **Fast search** — Search service names, key names, websites, and notes. Secret values are not searched.
- **Organize your vault** — Pin frequently used keys and reorder entries from the Manage page.
- **Masked by default** — Revealed secrets are hidden again after 10 seconds.
- **Session locking** — Keep the vault unlocked across popup closes and lock it immediately whenever you want. Chrome restart clears the session.
- **Encrypted before sync** — Sync locally encrypted entries between Chrome installations through Chrome Sync.

## Security at a glance

Envpin uses Web Crypto with PBKDF2-SHA-256 (600,000 iterations), a random 16-byte salt, and AES-GCM-256. Each encryption operation uses a fresh 12-byte IV. The current vault format binds vault and record context as AES-GCM additional authenticated data.

The derived encryption key is kept in Chrome's extension session storage while the vault is unlocked and is cleared when the browser session ends. Envpin does not store decrypted secrets in `storage.local`, LocalStorage, IndexedDB, or an Envpin server.

Encryption does not protect a secret after you copy it to the system clipboard, and it cannot protect an already-unlocked device from malware or a compromised browser environment. Envpin has not received an independent security audit. Read [Security](SECURITY.md) and [development and security notes](docs/development.md) for the threat model and implementation details.

## Quick start

1. Install Envpin and create a vault with a long, unique master passphrase.
2. Add a service, key name, and secret. A website and notes are optional.
3. Search for the entry and copy the secret from the popup whenever you need it.

There is no password reset. If you lose the master password, Envpin cannot recover your vault.

## Cross-device sync

1. Sign in to Chrome with the same Google account and enable extension synchronization.
2. Install Envpin with the same extension ID on the other computer.
3. Wait for the existing vault to synchronize.
4. When `Existing Envpin Vault Found` appears, unlock it with the existing master password.

Envpin encrypts vault contents locally before writing them to Chrome Sync. On September 16, 2026, physical-device QA between Windows and macOS verified creation, modification, deletion, offline recovery, browser restart, and concurrent-edit scenarios through Chrome Sync. See the [physical-device Sync results](docs/physical-sync-verification-2026-09-16.md) and [automated verification results](docs/verification-0.2.0.md) for the exact scope.

> A source build may have a different extension ID from the Chrome Web Store version. Chrome Sync does not share extension storage between different extension IDs.

## Installation from source

Git and Node.js 22 or later are required.

```sh
git clone https://github.com/rheeeuro/envpin.git
cd envpin
npm ci
npm test
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the generated `envpin/dist` directory.

## Using the vault

### Create a vault

Open Envpin, enter the master password twice, and select `Create Vault`. New passwords must contain at least eight characters; a long, unique passphrase is recommended.

### Add an API key

Select `+` or `Add API Key`, then enter the following information:

| Field | Description |
| --- | --- |
| Service | The service name, such as OpenAI or GitHub |
| Name | A name that identifies the key, such as Personal or Development |
| Secret | The original API key value |
| Website | An associated website URL (optional) |
| Note | Usage details or other notes (optional) |

### Copy and manage keys

- `Copy` copies the secret to the system clipboard. Envpin does not automatically clear it.
- `Show` reveals a secret for 10 seconds; `Hide` masks it immediately.
- `Edit` updates the saved entry.
- `Delete` removes the encrypted entry after confirmation and retains an encrypted deletion marker so a stale offline device cannot restore it.
- `Lock vault` immediately clears the active session.
- `Manage` opens the management page, where entries can be pinned or reordered within a group.

Search filters service names, key names, websites, and notes. Secret values are never included in search.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd + K` / `Ctrl + K` | Focus the key search field |
| `Enter` | Submit the password or key form |
| `Escape` | Clear the search, cancel editing, or close the delete confirmation dialog |

## Known limitations

- Chrome Sync storage has a limited quota. Encrypted deletion markers also consume space and are retained to prevent stale offline devices from restoring deleted entries.
- Import, export, backup recovery, and team sharing are not available yet. Keep a recovery path through each secret's original service.
- Concurrent edits on multiple computers can still require conflict handling. Wait for synchronization before editing the same entry elsewhere.
- Envpin has not received an independent security audit.

## Roadmap

Near-term priorities are encrypted backup and restore, configurable auto-lock, clipboard safety controls, and improved sync diagnostics. Later candidates include explicit `.env` import and export, project tags, and faster keyboard-driven copy workflows. Roadmap items are proposals, not shipped features.

## Development and verification

```sh
npm test
npm run build
```

`npm run dev` is intended for UI development. Vault functionality requires the Chrome extension environment. After updating the source, rebuild the extension and reload Envpin from the Chrome extensions page.

[Security](SECURITY.md) · [Privacy policy](PRIVACY.md) · [Physical-device Sync results](docs/physical-sync-verification-2026-09-16.md) · [Automated verification](docs/verification-0.2.0.md) · [Manual QA checklist](docs/manual-qa.md) · [Vault conflict recovery](docs/recovery.md) · [Design document](docs/envpin-design.md)
