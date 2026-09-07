import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve('dist');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const fail = message => { throw new Error(message); };
if (manifest.manifest_version !== 3 || JSON.stringify(manifest.permissions) !== '["storage"]') fail('Unexpected manifest permissions.');
for (const key of ['host_permissions', 'optional_host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources']) if (key in manifest) fail(`Unexpected manifest key: ${key}`);
function walk(directory, prefix = '') {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name), relative = prefix + name;
    if (lstatSync(path).isSymbolicLink()) fail('Symlinks are not allowed in the package.');
    return lstatSync(path).isDirectory() ? walk(path, relative + '/') : [relative];
  });
}
const files = walk(root).filter(file => file !== 'icons/mark.svg').sort();
for (const file of files) {
  if (!/^(manifest\.json|popup\.html|privacy\.html|background\.js|popup\.js|assets\/[A-Za-z0-9_-]+\.(js|css)|icons\/icon-(16|32|48|128)\.png)$/.test(file)) fail(`Unexpected release file: ${file}`);
  if (file.endsWith('.js')) {
    const code = readFileSync(join(root, file), 'utf8');
    if (/\beval\s*\(|new\s+Function\s*\(|\bfetch\s*\(|XMLHttpRequest|import\s*\(\s*['"]https?:/.test(code)) fail(`Unexpected executable/network primitive: ${file}`);
  }
  if (file.endsWith('.html')) {
    const html = readFileSync(join(root, file), 'utf8');
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (script[2].trim() || !/src="\/?[A-Za-z0-9_./-]+"/.test(script[1])) fail(`Inline or remote script in ${file}`);
    }
  }
}
for (const path of [manifest.action.default_popup, manifest.background.service_worker, 'privacy.html', ...Object.values(manifest.icons)]) if (!existsSync(join(root, path))) fail(`Missing manifest asset: ${path}`);
mkdirSync('release', { recursive: true });
const zip = resolve(`release/envpin-${manifest.version}.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-X', '-q', zip, ...files], { cwd: root });
const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
writeFileSync(`${zip}.sha256`, `${sha}  envpin-${manifest.version}.zip\n`);
writeFileSync('release/contents.txt', files.join('\n') + '\n');
console.log(`Created release/envpin-${manifest.version}.zip (${files.length} files). SHA-256: ${sha}`);
