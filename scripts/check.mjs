import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url);
const files=await readdir(root);
for(const name of files.filter(n=>n.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,root))],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);}
const html=await readFile(new URL('index.html',root),'utf8');
for(const [,ref] of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))await readFile(new URL(ref,root));
assert.match(html,/<html lang="zh-CN">/);assert.match(html,/name="viewport"/);assert.match(html,/rel="icon"/);
for(const name of files.filter(n=>n.endsWith('.js'))){const code=await readFile(new URL(name,root),'utf8');for(const [,ref] of code.matchAll(/from ['"]\.\/([^'"]+)['"]/g))await readFile(new URL(ref,root));}
console.log(`静态入口、资源引用与 ${files.filter(n=>n.endsWith('.js')).length} 个脚本语法检查通过。`);
