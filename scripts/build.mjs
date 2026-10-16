import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFile(path.join(root,p),'utf8');
const data=JSON.parse(await read('web/content.json'));
let page=await read('web/page.html');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const people=a=>a.map(p=>`<figure class="person">${p.image?`<img src="${p.image}" loading="lazy" decoding="async" width="240" height="300" alt="${esc(p.name)}">`:`<div class="initials" aria-hidden="true">${esc(p.initials)}</div>`}<figcaption>${esc(p.name)}</figcaption></figure>`).join('\n');
const both=(en,ar)=>`<span class="en">${en}</span><span class="ar">${ar}</span>`;
const programmes=[
 ['Academic exchange','التبادل الأكاديمي','Conferences, lectures and seminars that advance knowledge and connect generations of scholars.','مؤتمرات ومحاضرات وندوات تُثري المعرفة وتصل بين أجيال الباحثين.'],
 ['Youth development','تمكين الشباب','Training, mentoring and guidance that help students and early-career researchers to excel.','تدريب وإرشاد وتوجيه يُعين الطلبة والباحثين الشباب على التميّز.'],
 ['Networks and opportunity','الشبكات والفرص','Partnerships with universities, professional associations and employers in the United Kingdom, Iraq and beyond.','شراكات مع الجامعات والجمعيات المهنية وجهات العمل في المملكة المتحدة والعراق وخارجهما.'],
 ['A bridge with Iraq','جسر مع العراق','The transfer of knowledge and expertise in support of Iraq’s development, reconstruction and renewal.','نقل المعرفة والخبرة دعماً لمسيرة التنمية وإعادة الإعمار والنهوض في العراق.']
 ];
const programmeHtml='<ul class="arches">'+programmes.map(p=>`<li class="arch"><h3>${both(p[0],p[1])}</h3><p>${both(p[2],p[3])}</p></li>`).join('')+'</ul>';
const resources=[
 ['Student visas','التأشيرات الدراسية','Official GOV.UK guidance on studying in the United Kingdom.','الإرشادات الرسمية للحكومة البريطانية بشأن الدراسة في المملكة المتحدة.','https://www.gov.uk/student-visa'],
 ['Chevening scholarships','منح تشيفنينغ','Information on the UK government’s Chevening scholarship programme.','معلومات عن برنامج منح تشيفنينغ التابع للحكومة البريطانية.','https://www.chevening.org'],
 ['Research funding','تمويل البحث العلمي','Funding opportunities and guidance from UK Research and Innovation (UKRI).','فرص التمويل والإرشادات المقدّمة من هيئة البحث والابتكار البريطانية (UKRI).','https://www.ukri.org'],
 ['Academic careers','الوظائف الأكاديمية','Academic and research vacancies listed on jobs.ac.uk.','الوظائف الأكاديمية والبحثية المعلنة عبر jobs.ac.uk.','https://www.jobs.ac.uk']
 ];
const replacements={LOGO:data.logo,BASHIR:data.keynote,STYLES:await read('web/styles.css'),COMMUNITY_JS:await read('web/community.js'),PUBLIC_JS:await read('web/public.js'),ABOUT_COPY:data.about,AGENDA:`<table class="agenda" aria-label="June 2026 event programme" data-label-en="June 2026 event programme" data-label-ar="برنامج الأمسية في حزيران 2026"><tbody>${data.agenda}</tbody></table>`,NEWS_COPY:data.news,GUESTS:data.guests,TEAM_ALL:people(data.team),TEAM_PREVIEW:people(data.team.slice(0,6)),PROGRAMMES:programmeHtml,SOCIALS:'<div class="social-links"><a href="https://www.facebook.com/share/1HdBPiYK6k/" rel="noopener noreferrer">Facebook</a><a href="https://www.instagram.com/iraqiacademicyouthuk" rel="noopener noreferrer">Instagram</a></div>',RESOURCES:resources.map(r=>`<article class="resource-item"><h3>${both(r[0],r[1])}</h3><p>${both(r[2],r[3])}</p><a href="${r[4]}" rel="noopener noreferrer">${both('Visit website','زيارة الموقع')}</a></article>`).join('')};
page=page.replace(/__([A-Z_]+)__/g,(_,key)=>{if(!(key in replacements))throw new Error('Missing page token '+key);return replacements[key]});
// Prevent an embedded script from closing its own HTML script element.
if(page.match(/__([A-Z_]+)__/))throw new Error('Unresolved build placeholder');
await fs.writeFile(path.join(root,'index.html'),page);
await fs.mkdir(path.join(root,'worker'),{recursive:true});
const api=(await read('server/community.mjs')).replace(/^export /gm,'');
const csp="default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com";
const worker=api+'\nconst PAGE='+JSON.stringify(page)+';\n'+`export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleCommunity(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});if(url.pathname==='/favicon.ico')return new Response(null,{status:204});if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cross-Origin-Opener-Policy':'same-origin-allow-popups','Content-Security-Policy':${JSON.stringify(csp)}}})}};\n`;
await fs.writeFile(path.join(root,'worker/index.js'),worker);
await fs.mkdir(path.join(root,'dist/server'),{recursive:true});
await fs.mkdir(path.join(root,'dist/.openai'),{recursive:true});
await fs.writeFile(path.join(root,'dist/server/index.js'),worker);
await fs.copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
console.log('Built complete HTML and self-contained Worker ('+page.length+' HTML characters).');
