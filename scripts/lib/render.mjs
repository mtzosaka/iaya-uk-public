// Small HTML helpers shared by the build.
export const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const people=a=>a.map(p=>`<figure class="person">${p.image?`<img src="${p.image}" loading="lazy" decoding="async" width="240" height="300" alt="${esc(p.name)}">`:`<div class="initials" aria-hidden="true">${esc(p.initials)}</div>`}<figcaption>${esc(p.name)}</figcaption></figure>`).join('\n');
export const both=(en,ar)=>`<span class="en">${en}</span><span class="ar">${ar}</span>`;
