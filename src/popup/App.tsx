import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Secret } from '../types';
import { friendlyError, Vault } from '../core/vault';
import { matchesSearch } from '../core/secret';
import { ConfirmDialog, SecretCard, SecretForm } from './components';
export function App({ vault }: { vault: Vault }) {
  const state = useSyncExternalStore(vault.subscribe, vault.getSnapshot);
  const [page, setPage] = useState<'list' | 'add' | Secret>('list');
  const [deleting, setDeleting] = useState<Secret | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  const filtered = state.secrets.filter(secret => matchesSearch(secret, query));
  return <main className={state.status === 'unlocked' && page === 'list' ? 'vault-list' : undefined}>
    <header><div className="brand"><span aria-hidden="true" className="brand-mark">&gt;·</span><div><h1>Envpin</h1><span className="tagline">Pin. Copy. Build.</span></div></div>{state.status === 'unlocked' && <button className="quiet" disabled={busy} onClick={() => void run(() => vault.lock())}>Lock vault</button>}</header>
    {(error || state.error) && <div className="error" role="alert">{error || state.error}</div>}
    {state.status === 'loading' ? <p className="empty" role="status">Opening your vault…</p> : state.status !== 'unlocked' ? <section className="auth">
      <div className="eyebrow">YOUR DEVELOPER SECRETS</div><h2>{state.status === 'create' ? 'Create your vault' : 'Vault locked'}</h2>
      <p className="intro">{state.status === 'create' ? 'Keep your API keys in one place. Encrypted with your master password.' : 'Existing Envpin Vault Found. Enter your master password to access your keys.'}</p>
      <form onSubmit={e => { e.preventDefault(); void authenticate(); }}><fieldset disabled={busy}>
        <label>Master Password<input autoFocus type="password" required value={password} autoComplete={state.status === 'create' ? 'new-password' : 'current-password'} onChange={e => setPassword(e.target.value)} /></label>
        {state.status === 'create' && <><label>Confirm Password<input type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label><p className="hint">Choose a long, unique password. There is no password recovery.</p></>}
        <button className="primary full" type="submit">{busy ? 'Please wait…' : state.status === 'create' ? 'Create Vault' : 'Unlock'}</button>
      </fieldset></form><p className="auth-footer">Encrypted locally · Synced with Chrome</p>
    </section> : page !== 'list' ? <SecretForm original={typeof page === 'object' ? page : undefined} busy={busy} cancel={() => { setPage('list'); setError(''); }} save={input => run(async () => { await vault.save(input, typeof page === 'object' ? page : undefined); setPage('list'); })} /> : <>
      <div className="toolbar"><input ref={search} type="search" aria-label="Search keys" placeholder="Search keys…" value={query} onChange={e => setQuery(e.target.value)} /><button className="primary add" aria-label="Add API Key" onClick={() => { setError(''); setPage('add'); }}>+</button></div>
      <div className="list-label"><span>API KEYS</span><span>{filtered.length}</span></div>
      <div className="keys-scroll">
      {!state.secrets.length ? <section className="empty"><span className="empty-mark" aria-hidden="true">&gt;_</span><h2>No API keys yet</h2><p>Keep your API keys in one place<br />and copy them whenever you need.</p><button className="primary" onClick={() => setPage('add')}>Add API Key</button></section> : !filtered.length ? <p className="empty">No keys match your search.</p> : <section aria-label="API keys">{filtered.map(secret => <SecretCard key={secret.id} secret={secret} edit={() => { setError(''); setPage(secret); }} remove={() => { setError(''); setDeleting(secret); }} />)}</section>}
      </div>
      <footer>Encrypted vault <span>Chrome Sync</span></footer>
    </>}
    {deleting && <ConfirmDialog secret={deleting} busy={busy} cancel={() => setDeleting(null)} confirm={() => void run(async () => { const secret = deleting; setDeleting(null); await vault.remove(secret); })} />}
  </main>;
}
