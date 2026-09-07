# Envpin Privacy Policy

Effective date: September 7, 2026

Envpin is an API key vault for Chrome. This policy describes how the extension handles the information you choose to store.

## Information handled

You can enter API keys or other secrets, service names, key names, website URLs, and notes. Envpin also records entry identifiers and creation/update times. Your master password is used locally to derive an encryption key; Envpin does not save the password.

## Storage and synchronization

API keys, service names, key names, website URLs, and notes are encrypted locally using AES-GCM before being written to Chrome Sync storage. Vault metadata, including a random salt, vault identifier, key derivation parameters, and encrypted password-verification data, is stored alongside encrypted entries. Record identifiers, update times, and deletion markers are not confidential; the contents of secrets and notes are encrypted.

When Chrome Sync is enabled, Chrome may transmit and store this encrypted data through Google's synchronization service for your signed-in Chrome account. This is necessary to provide the cross-device feature. Google operates that service under its own [Privacy Policy](https://policies.google.com/privacy). With synchronization disabled, Chrome keeps the data on the current device.

After unlocking, the derived encryption key is stored in Chrome's memory-based extension session storage to keep the vault unlocked when the popup closes. Decrypted entries are held in the popup's memory while it is open. Locking the vault invalidates the session and clears the popup's references to those entries. A browser restart clears Chrome session storage. This is not a guarantee of forensic erasure of device memory.

## Data use and sharing

Envpin uses the information only to store, display, search, edit, delete, and copy your secrets and to synchronize the encrypted vault. The developer does not operate an Envpin backend and does not receive your vault contents. The extension includes no analytics, advertising, or tracking SDKs. It does not read web pages or automatically send your keys to API providers.

Envpin does not sell data or use it for advertising. Its use and transfer of user data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Clipboard

When you click Copy, the selected secret is written to your system clipboard. Envpin does not automatically clear it. Your operating system, clipboard history/synchronization tools, and applications into which you paste may retain or access that value according to their own behavior.

## Retention and deletion

Saved entries remain until you delete them. Deleting an entry first saves a separate encrypted deletion record containing its identifier and deletion time, then removes its saved encrypted content. If cleanup is interrupted, the deletion record takes precedence and hides any remaining outdated copy. Envpin retains these records without automatic expiry to prevent outdated copies on offline devices from restoring deleted entries. Deletion records consume Chrome Sync space. Previously offline devices may retain older copies until they synchronize; deletion is not a guarantee of immediate removal from every device or Google's internal backups.

Per-vault metadata is retained to detect conflicting vault creation and avoid losing the information needed to decrypt affected entries. Envpin has no automated full-vault reset or backup recovery feature. Chrome manages the lifecycle of extension storage. To request assistance with removal or a conflict, use the support link below. Never post secrets or storage dumps publicly.

## Security and limitations

New master passwords must contain at least eight characters. A long, unique passphrase provides better protection. There is no password reset or recovery. Encryption does not protect a secret after it is copied elsewhere or protect an unlocked device from malware. Envpin has not received an independent security audit.

## Support and changes

Contact the developer through [GitHub Issues](https://github.com/rheeeuro/envpin/issues). Do not include API keys, passwords, exported storage, or screenshots showing secret values. GitHub processes issue content under its own privacy policy.

This policy may be updated when the extension's data handling changes. The effective date above identifies the current policy.
