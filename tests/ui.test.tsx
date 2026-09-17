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
    expect(screen.queryByRole('button', { name: 'Edit Example / Personal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Example / Personal' })).toBeNull();
    expect(screen.queryByText(/Created/)).toBeNull();
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
  it('filters metadata, supports search shortcut, and keeps changes out of the popup', () => {
    const state: VaultState = { status: 'unlocked', secrets: [secret], error: '' };
    const vault = { subscribe: () => () => {}, getSnapshot: () => state } as unknown as Vault;
    render(<App vault={vault} />); fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: secret.secret } }); expect(screen.getByText('No keys match your search.')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.getByText('Example')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add API Key' })).toBeNull();
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe('https://github.com/rheeeuro/envpin');
  });
  it('opens the full manager and pins keys to the top from that page', async () => {
    const second = { ...secret, id: 'second', name: 'Second', createdAt: 2000, updatedAt: 2000 };
    const state: VaultState = { status: 'unlocked', secrets: [secret, second], error: '' };
    const arrange = vi.fn().mockResolvedValue(undefined);
    const vault = { subscribe: () => () => {}, getSnapshot: () => state, arrange } as unknown as Vault;
    const { unmount } = render(<App vault={vault} />);
    expect(screen.getByRole('link', { name: 'Manage' }).getAttribute('href')).toBe('manage.html');
    unmount();
    render(<App vault={vault} mode="manager" />);
    expect(screen.getByRole('button', { name: 'Add API Key' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Example / Personal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Example / Personal' })).toBeTruthy();
    expect(screen.getAllByText(/Created/)).toHaveLength(2);
    const firstHandle = screen.getByLabelText('Drag Example / Personal');
    expect(firstHandle).toBeTruthy();
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() };
    await act(async () => { fireEvent.dragStart(firstHandle, { dataTransfer }); });
    await act(async () => { fireEvent.dragOver(screen.getByText('Second').closest('article')!, { dataTransfer, clientY: 1 }); });
    expect([...screen.getByLabelText('API keys').querySelectorAll('article')].map(card => card.textContent)).toEqual([
      expect.stringContaining('Second'), expect.stringContaining('Personal'),
    ]);
    await act(async () => {
      fireEvent.drop(screen.getByText('Second').closest('article')!, { dataTransfer });
    });
    expect(arrange).toHaveBeenCalledWith([{ id: 'second', pinned: false }, { id: 'test', pinned: false }]);
    arrange.mockClear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pin Example / Second' })); });
    expect(arrange).toHaveBeenCalledWith([{ id: 'second', pinned: true }, { id: 'test', pinned: false }]);
  });
  it('requires explicit delete confirmation', () => {
    HTMLDialogElement.prototype.showModal = vi.fn(); HTMLDialogElement.prototype.close = vi.fn(); const confirm = vi.fn(), cancel = vi.fn();
    render(<ConfirmDialog secret={secret} busy={false} confirm={confirm} cancel={cancel} />); expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel')); expect(cancel).toHaveBeenCalledOnce(); fireEvent.click(screen.getByText('Delete')); expect(confirm).toHaveBeenCalledOnce();
  });
});
