import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const source='C:/Users/OPPENHEIMER/Desktop/KRONOX-main';
const root=process.cwd();
if(root.toLowerCase()!=='c:\\users\\oppenheimer\\desktop\\kronox-juan')throw Error('Wrong checkout');
fs.mkdirSync('docs/juan',{recursive:true});
const excluded=new Set(['.git','node_modules','dist','build','.vite','.vercel','coverage','.next','.cache','.venv']);
const list=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(excluded.has(e.name)||e.name.startsWith('.env'))continue;const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile())list.push({file:path.relative(source,f).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')});}}
walk(source);
fs.writeFileSync('docs/juan/source-baseline.json',JSON.stringify({source,copy:root,date:new Date().toISOString(),files:list},null,2));
console.log('Source recorded read-only:',list.length,'files');
