import type { Secret, SecretInput } from '../types';
import { UserError } from './errors';
import { validId, validTime } from './validation';
export function maskSecret(value: string): string {
  if (value.length <= 12) return '••••••••';
  const prefix = value.match(/^[a-zA-Z]{2,8}-(?:[a-zA-Z]{2,8}-)?/)?.[0] ?? '';
  return (prefix.length + 8 < value.length ? prefix : '') + '••••••••••••' + value.slice(-4);
}
export function matchesSearch(secret: Secret, query: string) { return [secret.service, secret.name, secret.website, secret.note].some(v => v?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); }
export function validateInput(input: SecretInput): SecretInput {
  if (!input.service.trim() || !input.name.trim() || !input.secret.trim()) throw new UserError('Service, name, and secret are required.');
  const website = input.website?.trim() ?? '';
  if (website) { try { if (!['https:', 'http:'].includes(new URL(website).protocol)) throw new Error(); } catch { throw new UserError('Enter a valid http or https website URL.'); } }
  return { service: input.service.trim(), name: input.name.trim(), secret: input.secret, website, note: input.note?.trim() ?? '' };
}
export function validateSecret(value: Secret, id: string, updatedAt: number): Secret {
  if (!value || value.id !== id || value.updatedAt !== updatedAt || !validId(id) || !validTime(value.createdAt) || !validTime(updatedAt) || value.createdAt > updatedAt || typeof value.service !== 'string' || typeof value.name !== 'string' || typeof value.secret !== 'string' || (value.website !== undefined && typeof value.website !== 'string') || (value.note !== undefined && typeof value.note !== 'string')) throw new UserError('Unable to read a synced key. Your saved data has not been changed.');
  return value;
}
