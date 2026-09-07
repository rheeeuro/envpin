import { useEffect, useRef, useState } from 'react';
import type { Secret, SecretInput } from '../types';
import { maskSecret } from '../core/secret';
export function SecretCard({ secret, edit, remove }: { secret: Secret; edit: () => void; remove: () => void }) {
  const [shown, setShown] = useState(false);
  const [copy, setCopy] = useState('Copy');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setShown(false); setCopy('Copy'); }, [secret.updatedAt]);
  useEffect(() => { if (!shown) return; const timer = setTimeout(() => setShown(false), 10_000); return () => clearTimeout(timer); }, [shown]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  async function copySecret() {
    clearTimeout(copyTimer.current);
    try { await navigator.clipboard.writeText(secret.secret); setCopy('Copied ✓'); } catch { setCopy('Copy failed'); }
    copyTimer.current = setTimeout(() => setCopy('Copy'), 1500);
  }
  return <article className="card">
    <div className="row"><div><h2>{secret.service}</h2><p className="name">{secret.name}</p></div><div className="actions"><button className="quiet" onClick={edit} aria-label={`Edit ${secret.service} / ${secret.name}`}>Edit</button><button className="quiet" onClick={remove} aria-label={`Delete ${secret.service} / ${secret.name}`}>Delete</button></div></div>
    <code className="secret">{shown ? secret.secret : maskSecret(secret.secret)}</code>
    {secret.website && <p className="detail">{secret.website}</p>}
    {secret.note && <p className="detail note">{secret.note}</p>}
    <div className="row card-footer"><span className="date">Created {new Date(secret.createdAt).toLocaleDateString()}</span><div className="actions"><button className="quiet" aria-pressed={shown} onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</button><button className="copy" onClick={() => void copySecret()} aria-label={`Copy ${secret.service} / ${secret.name}`}><span aria-live="polite">{copy}</span></button></div></div>
  </article>;
}
export function SecretForm({ original, busy, save, cancel }: { original?: Secret; busy: boolean; save: (input: SecretInput) => Promise<void>; cancel: () => void }) {
  const [input, setInput] = useState<SecretInput>({ service: original?.service ?? '', name: original?.name ?? '', secret: original?.secret ?? '', website: original?.website ?? '', note: original?.note ?? '' });
  function field(name: keyof SecretInput, value: string) { setInput(previous => ({ ...previous, [name]: value })); }
  return <form onSubmit={event => { event.preventDefault(); void save(input); }} autoComplete="off">
    <div className="page-title"><button type="button" className="quiet" onClick={cancel} disabled={busy} aria-label="Back to keys">←</button><h2>{original ? 'Edit API Key' : 'Add API Key'}</h2></div>
    <fieldset disabled={busy}>
      <label>Service<input autoFocus required value={input.service} onChange={e => field('service', e.target.value)} placeholder="OpenAI" /></label>
      <label>Name<input required value={input.name} onChange={e => field('name', e.target.value)} placeholder="Personal" /></label>
      <label>Secret<input required type="password" autoComplete="new-password" spellCheck={false} value={input.secret} onChange={e => field('secret', e.target.value)} placeholder="Your API key" /></label>
      <label>Website <span className="optional">optional</span><input type="url" value={input.website} onChange={e => field('website', e.target.value)} placeholder="https://" /></label>
      <label>Note <span className="optional">optional</span><textarea rows={3} value={input.note} onChange={e => field('note', e.target.value)} /></label>
      <div className="form-actions"><button type="button" onClick={cancel}>Cancel</button><button className="primary" type="submit">{busy ? 'Saving…' : 'Save key'}</button></div>
    </fieldset>
  </form>;
}
export function ConfirmDialog({ secret, busy, confirm, cancel }: { secret: Secret; busy: boolean; confirm: () => void; cancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={dialog} aria-labelledby="delete-title" onCancel={e => { e.preventDefault(); if (!busy) cancel(); }}><h2 id="delete-title">Delete API key?</h2><p>“{secret.service} / {secret.name}” will be permanently removed from all synced Chrome browsers.</p><div className="form-actions"><button autoFocus disabled={busy} onClick={cancel}>Cancel</button><button className="danger" disabled={busy} onClick={confirm}>{busy ? 'Deleting…' : 'Delete'}</button></div></dialog>;
}
