// Assembles the page from src/: layout + partials, and the stylesheet from src/styles/*.css (in filename order).
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const read=p=>fs.readFile(path.join(root,p),'utf8');
export async function assemblePage(){
 let page=await read('src/pages/layout.html');
 for(let depth=0;depth<4;depth++){
  const tags=new Set(page.match(/<!--@include [\w./-]+-->/g)||[]);
  if(!tags.size)break;
  for(const tag of tags)page=page.split(tag).join(await read('src/'+tag.slice(13,-3)));
 }
 return page;
}
export async function concatStyles(){
 const dir=path.join(root,'src/styles');
 let css='';
 for(const f of (await fs.readdir(dir)).filter(f=>f.endsWith('.css')).sort())css+=await fs.readFile(path.join(dir,f),'utf8');
 return css;
}
