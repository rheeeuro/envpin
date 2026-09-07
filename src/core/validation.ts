import type { EncryptedPayload, StoredEncryptedSecret, VaultMetadata } from '../types';
import { UserError } from './errors';
const invalid = () => new UserError('Some synced data is invalid or unsupported. Your saved data has not been changed.');
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const onlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
export const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
export const validTime = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 8_640_000_000_000_000;
export function base64Bytes(v: unknown, min: number, max: number): number {
  if (typeof v !== 'string' || v.length > Math.ceil(max / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)) throw invalid();
  const decoded = atob(v);
  if (decoded.length < min || decoded.length > max || btoa(decoded) !== v) throw invalid();
  return decoded.length;
}
export function validatePayload(value: unknown): asserts value is EncryptedPayload {
  if (!object(value)) throw invalid();
  base64Bytes(value.iv, 12, 12);
  base64Bytes(value.ciphertext, 16, 6144);
}
export function validateMetadata(value: unknown): VaultMetadata {
  if (!object(value) || (value.version !== 1 && value.version !== 2) || !validTime(value.createdAt) || !Number.isSafeInteger(value.iterations) || (value.iterations as number) < 600_000 || (value.iterations as number) > 2_000_000) throw invalid();
  if (!onlyKeys(value, ['version', 'id', 'salt', 'iterations', 'verification', 'createdAt']) || (value.version === 1 && 'id' in value)) throw invalid();
  if (value.version === 2 && !validId(value.id)) throw invalid();
  base64Bytes(value.salt, 16, 16);
  validatePayload(value.verification);
  if (!onlyKeys(value.verification as unknown as Record<string, unknown>, ['iv', 'ciphertext'])) throw invalid();
  base64Bytes(value.verification.ciphertext, 16, 512);
  return value as unknown as VaultMetadata;
}
export function validateRecord(value: unknown, storageId?: string): StoredEncryptedSecret {
  if (!object(value) || (value.version !== 1 && value.version !== 2) || !validId(value.id) || (storageId !== undefined && value.id !== storageId) || !validTime(value.updatedAt)) throw invalid();
  if (!onlyKeys(value, ['version', 'id', 'updatedAt', 'iv', 'ciphertext', 'vaultId', 'kind']) || (value.version === 1 && ('vaultId' in value || 'kind' in value))) throw invalid();
  if (value.version === 2 && (!validId(value.vaultId) || (value.kind !== 'secret' && value.kind !== 'deleted'))) throw invalid();
  validatePayload(value);
  return value as unknown as StoredEncryptedSecret;
}
export const isDeleted = (record: StoredEncryptedSecret) => record.version === 2 && record.kind === 'deleted';
