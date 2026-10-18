import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
import {concatStyles} from '../scripts/lib/assemble.mjs';
const css=await concatStyles();
test('complete public pages, supplied identity and accessible controls survive the rebuild',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const page of ['home','about','activities','events','resources','contact','privacy','community','not-found'])assert(html.includes('data-page="'+page+'"'));
 assert(html.includes('With knowledge and work, we build the future'));assert(html.includes('بالعلم والعمل نبني المستقبل'));
 assert(html.includes('aria-controls="main-nav"'));assert(html.includes('lang="en"'));assert(html.includes('class="ar"'));
 assert.equal((html.match(/class="person"/g)||[]).length,23);
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
 assert(!html.includes('__STYLES__'));assert(!html.includes('window.claude'));assert(!html.includes('transition:all'));
});
test('core palette provides readable text and primary buttons in both themes',()=>{
 const lum=h=>h.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((r,x,i)=>r+x*[.2126,.7152,.0722][i],0);
 for(const [a,b]of [['0d1a38','f7f2e4'],['4a546b','f7f2e4'],['4a546b','ece3c9'],['7a5600','f7f2e4'],['7a5600','ece3c9'],['f7f2e4','7a5600'],['f4efe2','081329'],['aeb8cf','081329'],['aeb8cf','0f2350'],['eec76b','081329'],['081329','eec76b'],['ffffff','16409a'],['eec76b','16409a']]){const x=lum(a),y=lum(b);assert((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5,a+'/'+b)}
 assert(css.includes('prefers-reduced-motion'));assert(css.includes('max-width:767px'));assert(css.includes('inset-inline-start'));
});
test('built Worker serves public pages, keeps config fail-closed and has security headers',async()=>{
 const source=await fs.readFile(new URL('../worker/index.js',import.meta.url),'utf8');
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
 const page=await worker.fetch(new Request('https://iaya.example/'),{});assert.equal(page.status,200);assert((await page.text()).includes('Knowledge'));
 assert.equal(page.headers.get('Cross-Origin-Opener-Policy'),'same-origin-allow-popups');assert(page.headers.get('Content-Security-Policy').includes("object-src 'none'"));
 const config=await worker.fetch(new Request('https://iaya.example/api/config'),{});assert.equal((await config.json()).configured,false);
 assert.equal((await worker.fetch(new Request('https://iaya.example/unlisted'),{})).status,404);
 assert.equal((await worker.fetch(new Request('https://iaya.example/',{method:'POST'}),{})).status,405);
});
