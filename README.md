# Envpin

**English** | [한국어](README-ko.md)

**Pin. Copy. Build.**

Keep API keys from multiple services in Chrome and copy them whenever you need them.
Envpin is a small API key vault for developers. Organize keys by service and purpose, protect them with a master password, and synchronize them across computers with Chrome Sync.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/envpin-%E2%80%94-api-key-vault/jbgcepnmfgekljldjlfakmjphbomgkec) · [Report an issue or suggest a feature](https://github.com/rheeeuro/envpin/issues) · [Privacy policy](PRIVACY.md)

<p align="center">
  <img src="store/screenshot-keys-1280x800.png" width="49%" alt="Envpin API key list" />
  <img src="store/screenshot-lock-1280x800.png" width="49%" alt="Envpin locked vault" />
</p>

## Features

- **One-click copy** — Copy any key directly from the popup.
- **Simple organization** — Save a service name, key name, website, and notes with each key.
- **Fast search** — Find keys by service, name, website, or notes.
- **Dedicated management page** — Open `Manage` from the popup to organize keys in a larger view, pin frequently used keys, or drag keys to reorder them.
- **Masked by default** — Keys remain hidden until you select `Show`, and they are automatically hidden again after 10 seconds.
- **Vault locking** — Unlock the vault with your master password. It remains unlocked when the popup closes and locks again when Chrome restarts.
- **Encryption and sync** — Key data and notes are encrypted before storage and synchronized between devices where Chrome Sync is enabled.

## Installation

### Install from the Chrome Web Store

1. Open [Envpin — API Key Vault](https://chromewebstore.google.com/detail/envpin-%E2%80%94-api-key-vault/jbgcepnmfgekljldjlfakmjphbomgkec).
2. Select **Add to Chrome**.
3. Open the extensions menu in the Chrome toolbar and pin **Envpin**.

Envpin requests only the storage permission. It does not read websites, automatically fill API keys, operate its own server, or include analytics or advertising.

### Install from source

For development or verification, you can build and install Envpin directly from this repository. Git and Node.js 22 or later are required.

```sh
git clone https://github.com/rheeeuro/envpin.git
cd envpin
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the upper-right corner.
3. Select **Load unpacked**, then choose the generated `envpin/dist` directory.
4. Open the extensions menu in the Chrome toolbar and pin **Envpin**.

> A build installed from source may have a different extension ID from the Chrome Web Store version. Vault data does not synchronize between installations with different extension IDs.

## Getting started

### 1. Create a vault

Open Envpin from the toolbar, enter your master password twice, and select `Create Vault`. Your password must contain at least eight characters. A long, unique passphrase is recommended.

**If you forget your master password, your saved keys cannot be recovered.** Envpin does not provide password reset or recovery.

### 2. Add an API key

Select `+` or `Add API Key`, then enter the following information:

| Field | Description |
| --- | --- |
| Service | The service name, such as OpenAI or GitHub |
| Name | A name that identifies the key, such as Personal or Development |
| Secret | The original API key value |
| Website | An associated website URL (optional) |
| Note | Usage details or other notes (optional) |

Select `Save key` to return to the key list.

### 3. Copy and manage keys

- `Copy`: Copies the key. `Copied ✓` appears briefly after a successful copy.
- `Show` / `Hide`: Reveals or masks the key. A revealed key is automatically hidden after 10 seconds.
- `Edit`: Updates saved key information.
- `Delete`: Permanently removes the key after confirmation. Envpin retains an encrypted deletion marker to prevent an outdated device from restoring the deleted key. The deletion is synchronized to other Chrome installations.
- `Lock vault`: Immediately locks the vault.
- `Manage`: Opens the dedicated management page. Use `Pin` to keep a key at the top, or drag keys within the same group to reorder them. Changes are reflected in the popup and Chrome Sync.

Enter text in the search field to filter the list immediately. The API key value itself is never included in search. The search field remains visible even when the key list is long.

## Using Envpin on another computer

1. Sign in to Chrome with the same Google account and enable extension synchronization.
2. Install Envpin with the same extension ID on the other computer.
3. Wait for the existing vault to synchronize.
4. When `Existing Envpin Vault Found` appears, unlock it with your existing master password.

> When Envpin is installed from source in Developer mode, its extension ID may differ between environments. Chrome can synchronize vault data only when both installations use the same extension ID.

If your existing vault does not appear on the new computer, check the signed-in account, Chrome Sync settings, and extension ID before creating another vault. When synchronization is disabled, the vault is available only on that device.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd + K` / `Ctrl + K` | Focus the key search field |
| `Enter` | Submit the password or key form |
| `Escape` | Clear the search, cancel editing, or close the delete confirmation dialog |

## How is my data stored?

Envpin encrypts service names, key names, websites, notes, and API key values before storage. Your master password is never stored. The encryption key required to keep the vault unlocked is held in memory-backed browser session storage.

Envpin does not operate its own server or require a separate account. It does not read websites, automatically fill keys, or include analytics or tracking. The extension requests only the storage permission.

## Important notes

- Chrome Sync storage is limited. Shorten long keys or notes if they cannot be saved. Encrypted deletion markers also use storage and are not removed automatically.
- Editing the same key concurrently on multiple computers may cause conflicts. Confirm that synchronization has completed before making changes.
- Import, export, backup recovery, and team sharing are not currently available. Keep a way to manage or recover keys through their original services.
- End-to-end synchronization between two physical computers has not yet been verified in a production environment.
- When upgrading to version 0.2, update Envpin on every device. Existing vaults continue to use their current passwords. If different vaults are detected, Envpin preserves the data and stops making changes. See [vault conflict recovery](docs/recovery.md) for details.

## Development and testing

```sh
npm test
npm run build
```

`npm run dev` is intended for UI development. Vault functionality requires the Chrome extension environment. After updating the source, rebuild the extension and reload Envpin from the Chrome extensions page.

[Chrome Web Store](https://chromewebstore.google.com/detail/envpin-%E2%80%94-api-key-vault/jbgcepnmfgekljldjlfakmjphbomgkec) · [Support and issues](https://github.com/rheeeuro/envpin/issues) · [Privacy policy](PRIVACY.md) · [Development and security](docs/development.md) · [Verification results](docs/verification-0.2.0.md) · [Manual QA checklist](docs/manual-qa.md) · [Design document](docs/envpin-design.md)
