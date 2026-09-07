export interface Secret { id: string; service: string; name: string; secret: string; website?: string; note?: string; createdAt: number; updatedAt: number }
export type SecretInput = Pick<Secret, 'service' | 'name' | 'secret' | 'website' | 'note'>;
export interface EncryptedPayload { iv: string; ciphertext: string }
export interface StoredEncryptedSecret extends EncryptedPayload { version: 1; id: string; updatedAt: number }
export interface VaultMetadata { version: 1; salt: string; iterations: number; verification: EncryptedPayload; createdAt: number }
export interface SecretRepository { getAll(): Promise<StoredEncryptedSecret[]>; get(id: string): Promise<StoredEncryptedSecret | null>; set(secret: StoredEncryptedSecret): Promise<void>; remove(id: string): Promise<void> }
