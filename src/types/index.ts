export interface Secret {
  id: string;
  service: string;
  name: string;
  secret: string;
  website?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}
export type SecretInput = Pick<Secret, 'service' | 'name' | 'secret' | 'website' | 'note'>;
export interface EncryptedPayload { iv: string; ciphertext: string }
export interface LegacyEncryptedSecret extends EncryptedPayload {
  version: 1;
  id: string;
  updatedAt: number;
}
export interface EncryptedRecord extends EncryptedPayload {
  version: 2;
  id: string;
  vaultId: string;
  kind: 'secret' | 'deleted';
  updatedAt: number;
}
export type StoredEncryptedSecret = LegacyEncryptedSecret | EncryptedRecord;
interface MetadataFields {
  salt: string;
  iterations: number;
  verification: EncryptedPayload;
  createdAt: number;
}
export type VaultMetadata = (MetadataFields & { version: 1 }) | (MetadataFields & { version: 2; id: string });
export interface SecretRepository {
  getAll(): Promise<StoredEncryptedSecret[]>;
  get(id: string): Promise<StoredEncryptedSecret | null>;
  set(secret: StoredEncryptedSecret): Promise<void>;
}
