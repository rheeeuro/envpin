// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/popup/App';
import { SecretCard, SecretForm, ConfirmDialog } from '../src/popup/components';
import type { Vault, VaultState } from '../src/core/vault';
const secret = { id: 'test', service: 'Example', name: 'Personal', secret: 'test-only-api-key-1234', createdAt: 1000, updatedAt: 1000 };
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('popup', () => {
  it('masks secrets by default, reveals for ten seconds and confirms clipboard copy', async () => {
    vi.useFakeTimers(); const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SecretCard secret={secret} edit={() => {}} remove={() => {}} />);
    expect(screen.queryByText(secret.secret)).toBeNull(); fireEvent.click(screen.getByText('Show')); expect(screen.getByText(secret.secret)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10_000); }); expect(screen.queryByText(secret.secret)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy Example / Personal' })); });
    expect(writeText).toHaveBeenCalledWith(secret.secret); expect(screen.getByText('Copied ✓')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1500); }); expect(screen.getByText('Copy')).toBeTruthy();
  });
  it('reports clipboard failure without claiming success', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error()) }, configurable: true });
    render(<SecretCard secret={secret} edit={() => {}} remove={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy Example / Personal' })); }); expect(screen.getByText('Copy failed')).toBeTruthy();
  });
  it('renders edit fields and submits a secret without transforming its whitespace', async () => {
    const save = vi.fn().mockResolvedValue(undefined); render(<SecretForm original={secret} busy={false} save={save} cancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: '  test secret  ' } });
    await act(async () => { fireEvent.click(screen.getByText('Save key')); }); expect(save).toHaveBeenCalledWith(expect.objectContaining({ secret: '  test secret  ' }));
  });
  it('filters metadata, supports search shortcut, and opens add form', () => {
    const state: VaultState = { status: 'unlocked', secrets: [secret], error: '' };
    const vault = { subscribe: () => () => {}, getSnapshot: () => state } as unknown as Vault;
    render(<App vault={vault} />); fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: secret.secret } }); expect(screen.getByText('No keys match your search.')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.getByText('Example')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add API Key' })); expect(screen.getByLabelText('Service')).toBeTruthy();
  });
  it('requires explicit delete confirmation', () => {
    HTMLDialogElement.prototype.showModal = vi.fn(); HTMLDialogElement.prototype.close = vi.fn(); const confirm = vi.fn(), cancel = vi.fn();
    render(<ConfirmDialog secret={secret} busy={false} confirm={confirm} cancel={cancel} />); expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel')); expect(cancel).toHaveBeenCalledOnce(); fireEvent.click(screen.getByText('Delete')); expect(confirm).toHaveBeenCalledOnce();
  });
});
