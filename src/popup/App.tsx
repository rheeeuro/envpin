import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Secret } from '../types';
import { friendlyError, Vault } from '../core/vault';
import { matchesSearch } from '../core/secret';
import { ConfirmDialog, SecretCard, SecretForm } from './components';
export function App({ vault, mode = 'popup' }: { vault: Vault; mode?: 'popup' | 'manager' }) {
  const state = useSyncExternalStore(vault.subscribe, vault.getSnapshot);
  const [page, setPage] = useState<'list' | 'add' | Secret>('list');
  const [deleting, setDeleting] = useState<Secret | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const previewOrderRef = useRef<string[] | null>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (state.status !== 'unlocked') { setPage('list'); setDeleting(null); setQuery(''); } setPassword(''); setConfirm(''); setError(''); }, [state.status]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && search.current) { event.preventDefault(); search.current.focus(); }
      if (event.key === 'Escape' && !busy && !deleting) { setPage('list'); setQuery(''); setError(''); }
    }
    document.addEventListener('keydown', keydown); return () => document.removeEventListener('keydown', keydown);
  }, [busy, deleting]);
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } }
  async function authenticate() {
    if (state.status === 'create' && password !== confirm) { setError('Passwords do not match.'); return; }
    const entered = password; setPassword(''); setConfirm('');
    await run(() => state.status === 'create' ? vault.create(entered) : vault.unlock(entered));
  }
  const orderedSecrets = previewOrder ? previewOrder.map(id => state.secrets.find(secret => secret.id === id)).filter((secret): secret is Secret => Boolean(secret)) : state.secrets;
  const filtered = orderedSecrets.filter(secret => matchesSearch(secret, query));
  async function arrange(next: Secret[]) { await run(() => vault.arrange(next.map(secret => ({ id: secret.id, pinned: Boolean(secret.pinned) })))); }
  function togglePin(secret: Secret) {
    const remaining = state.secrets.filter(item => item.id !== secret.id);
    const updated = { ...secret, pinned: !secret.pinned };
    const firstUnpinned = remaining.findIndex(item => !item.pinned);
    const index = updated.pinned ? 0 : firstUnpinned < 0 ? remaining.length : firstUnpinned;
    remaining.splice(index, 0, updated);
    void arrange(remaining);
  }
  function previewDrop(target: Secret, after: boolean) {
    const draggedId = draggingRef.current;
    if (!draggedId || draggedId === target.id || query) return;
    const source = state.secrets.find(secret => secret.id === draggedId);
    if (!source || Boolean(source.pinned) !== Boolean(target.pinned)) return;
    const ids = previewOrderRef.current ?? state.secrets.map(secret => secret.id);
    const next = ids.filter(id => id !== source.id);
    const to = next.indexOf(target.id);
    if (to < 0) return;
    next.splice(to + (after ? 1 : 0), 0, source.id);
    if (next.every((id, index) => id === ids[index])) return;
    previewOrderRef.current = next;
    setPreviewOrder(next);
  }
  function finishDrag(save: boolean) {
    const ids = previewOrderRef.current;
    draggingRef.current = null;
    setDragging(null);
    setPreviewOrder(null);
    previewOrderRef.current = null;
    if (save && ids) void arrange(ids.map(id => state.secrets.find(secret => secret.id === id)!).filter(Boolean));
  }
  const listClass = state.status === 'unlocked' && page === 'list' ? `vault-list${mode === 'manager' ? ' manager' : ''}` : mode === 'manager' ? 'manager' : undefined;
  return <main className={listClass}>
    <header><div className="brand"><span aria-hidden="true" className="brand-mark">&gt;·</span><div><h1>Envpin</h1><span className="tagline">{mode === 'manager' ? 'Manage your API keys' : 'Pin. Copy. Build.'}</span></div></div>{state.status === 'unlocked' && <div className="header-actions">{mode === 'popup' && <a className="button quiet manage-link" href="manage.html" target="_blank" rel="noopener noreferrer">Manage</a>}<button className="quiet" disabled={busy} onClick={() => void run(() => vault.lock())}>Lock vault</button></div>}</header>
    {(error || state.error) && <div className="error" role="alert">{error || state.error}</div>}
    {state.status === 'loading' ? <p className="empty" role="status">Opening your vault…</p> : state.status !== 'unlocked' ? <section className="auth">
      <div className="eyebrow">YOUR DEVELOPER SECRETS</div><h2>{state.status === 'create' ? 'Create your vault' : 'Vault locked'}</h2>
      <p className="intro">{state.status === 'create' ? 'Keep your API keys in one place. Encrypted with your master password.' : 'Existing Envpin Vault Found. Enter your master password to access your keys.'}</p>
      <form onSubmit={e => { e.preventDefault(); void authenticate(); }}><fieldset disabled={busy}>
        <label>Master Password<input autoFocus type="password" required minLength={state.status === 'create' ? 8 : undefined} value={password} autoComplete={state.status === 'create' ? 'new-password' : 'current-password'} onChange={e => setPassword(e.target.value)} /></label>
        {state.status === 'create' && <><label>Confirm Password<input type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label><p className="hint">Use at least 8 characters. A long, unique passphrase is safer. There is no password recovery.</p></>}
        <button className="primary full" type="submit">{busy ? 'Please wait…' : state.status === 'create' ? 'Create Vault' : 'Unlock'}</button>
      </fieldset></form><p className="auth-footer">Encrypted locally · Synced with Chrome<br /><a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy policy</a></p>
    </section> : page !== 'list' ? <SecretForm original={typeof page === 'object' ? page : undefined} busy={busy} cancel={() => { setPage('list'); setError(''); }} save={input => run(async () => { await vault.save(input, typeof page === 'object' ? page : undefined); setPage('list'); })} /> : <>
      <div className="toolbar"><input ref={search} type="search" aria-label="Search keys" placeholder="Search keys…" value={query} onChange={e => setQuery(e.target.value)} />{mode === 'manager' && <button className="primary add" aria-label="Add API Key" onClick={() => { setError(''); setPage('add'); }}>+</button>}</div>
      <div className="list-label"><span>API KEYS</span><span>{filtered.length}</span></div>
      <div className="keys-scroll">
      {!state.secrets.length ? <section className="empty"><span className="empty-mark" aria-hidden="true">&gt;_</span><h2>No API keys yet</h2><p>Keep your API keys in one place<br />and copy them whenever you need.</p>{mode === 'manager' ? <button className="primary" onClick={() => setPage('add')}>Add API Key</button> : <a className="button primary" href="manage.html" target="_blank" rel="noopener noreferrer">Manage keys</a>}</section> : !filtered.length ? <p className="empty">No keys match your search.</p> : <section aria-label="API keys">{filtered.map(secret => <SecretCard key={secret.id} secret={secret} manage={mode === 'manager'} pin={() => togglePin(secret)} drag={mode === 'manager' && !busy && !query ? { dragging: dragging === secret.id, onDragStart: event => { const ids = state.secrets.map(item => item.id); draggingRef.current = secret.id; previewOrderRef.current = ids; setPreviewOrder(ids); setDragging(secret.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', secret.id); }, onDragEnd: () => finishDrag(false), onDragOver: event => { const draggedId = draggingRef.current; if (draggedId && Boolean(state.secrets.find(item => item.id === draggedId)?.pinned) === Boolean(secret.pinned)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const bounds = event.currentTarget.getBoundingClientRect(); const ids = previewOrderRef.current ?? state.secrets.map(item => item.id); const after = bounds.height ? event.clientY >= bounds.top + bounds.height / 2 : ids.indexOf(draggedId) < ids.indexOf(secret.id); previewDrop(secret, after); } }, onDrop: event => { event.preventDefault(); finishDrag(true); } } : undefined} edit={() => { setError(''); setPage(secret); }} remove={() => { setError(''); setDeleting(secret); }} />)}</section>}
      </div>
      <footer>Encrypted vault <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a><span>Chrome Sync</span></footer>
    </>}
    {deleting && <ConfirmDialog secret={deleting} busy={busy} cancel={() => setDeleting(null)} confirm={() => void run(async () => { const secret = deleting; setDeleting(null); await vault.remove(secret); })} />}
  </main>;
}
