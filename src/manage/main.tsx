import { createRoot } from 'react-dom/client';
import { App } from '../popup/App';
import { Vault } from '../core/vault';
import '../popup/style.css';

document.body.classList.add('manager-page');
const vault = new Vault();
const root = createRoot(document.getElementById('root')!);
root.render(<App vault={vault} mode="manager" />);
void vault.start();
window.addEventListener('pagehide', () => { root.unmount(); vault.dispose(); });
