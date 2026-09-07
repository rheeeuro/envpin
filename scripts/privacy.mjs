import { readFileSync, writeFileSync } from 'node:fs';
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const blocks = readFileSync('PRIVACY.md', 'utf8').trim().split(/\n\n+/).map(block => {
  const match = block.match(/^(#{1,2}) (.*)$/s);
  const content = escape(match ? match[2] : block).replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return match ? `<h${match[1].length}>${content}</h${match[1].length}>` : `<p>${content}</p>`;
});
writeFileSync('public/privacy.html', `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Envpin Privacy Policy</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#24272b;max-width:760px;margin:48px auto;padding:0 24px}h1{font-size:28px}h2{font-size:20px;margin-top:32px}a{color:#2a4b3e}a:focus-visible{outline:2px solid #2a4b3e}</style></head><body>${blocks.join('\n')}</body></html>\n`);
