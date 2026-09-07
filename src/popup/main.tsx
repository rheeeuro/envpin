import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Vault } from '../core/vault';
import './style.css';
const vault = new Vault();
const root = createRoot(document.getElementById('root')!);
root.render(<App vault={vault} />);
void vault.start();
window.addEventListener('pagehide', () => { root.unmount(); vault.dispose(); });
