const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../web/community.js'),'utf8');
class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.listeners={};this.className='';this._text='';this.value='';this.disabled=false;this.hidden=false;this.classList={add:c=>this.className+=' '+c};}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ')}
 set textContent(value){this._text=String(value);this.children=[]}
 appendChild(n){n.parent=this;this.children.push(n);return n}
 replaceChildren(...nodes){this.children.forEach(n=>n.parent=null);this.children=[];this._text='';nodes.forEach(n=>this.appendChild(n))}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}
 setAttribute(k,v){this.attrs[k]=v}
 getAttribute(k){return this.attrs[k]}
 querySelectorAll(selector){if(selector==='textarea[data-review-id]')return all(this,n=>n.tagName==='textarea'&&n.attrs['data-review-id']!==undefined);throw Error('Unsupported test selector '+selector)}
 removeAttribute(k){delete this.attrs[k]}
 addEventListener(k,v){(this.listeners[k]??=[]).push(v)}
 get isConnected(){return this.tagName==='root'||!!(this.parent&&this.parent.isConnected)}
 reportValidity(){return true}
 contains(node){return Boolean(node&&(node===this||this.children.some(c=>c.contains(node))))}
 focus(){this.ownerDocument.activeElement=this}
 get clientWidth(){return 320}
}
function find(n,p){if(p(n))return n;for(const c of n.children){const r=find(c,p);if(r)return r}return null}
function all(n,p,out=[]){if(p(n))out.push(n);n.children.forEach(c=>all(c,p,out));return out}
function setup(session,{lang='en',config={configured:false,admin_review_enabled:false},community={resources:[]},applications=[],protocol='https:'}={}){
 const root=new Node('root');root.id='community-root';const calls=[];
 const location={hash:'#/community',origin:'https://iaya.test',protocol};
 const fakeGoogle={accounts:{id:{initialize:o=>fakeGoogle.options=o,renderButton:n=>n.appendChild(new Node('google-button'))}}};
 let sessionValue=structuredClone(session);
 const fetch=async(path,options)=>{
  calls.push({path,options});let data;
  if(path==='/api/config')data=config;
  else if(path==='/api/session')data=sessionValue;
  else if(path==='/api/auth/nonce')data={nonce:'secure-nonce'};
  else if(path==='/api/auth/google')data={ok:true};
  else if(path==='/api/auth/logout'){sessionValue={authenticated:false};data={ok:true}}
  else if(path==='/api/membership'){sessionValue={...sessionValue,membership:{...JSON.parse(options.body),status:'pending'}};data={membership:sessionValue.membership}}
  else if(path==='/api/community')data=community;
  else if(path.startsWith('/api/admin/applications?'))data={applications,next_cursor:null,counts:{pending:applications.filter(x=>x.status==='pending').length,approved:applications.filter(x=>x.status==='approved').length,rejected:0,total:applications.length}};
  else if(path.startsWith('/api/admin/applications/')){const patch=JSON.parse(options.body);applications[0].status=patch.status;data={membership:applications[0]}}
  else throw Error('Unexpected API '+path);
  return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data};
 };
 const window={location,google:fakeGoogle};
 const document={documentElement:{lang},head:new Node('head'),activeElement:null,createElement:tag=>{const node=new Node(tag);node.ownerDocument=document;return node},getElementById:id=>find(root,n=>n.id===id)};root.ownerDocument=document;
 const context={window,document,fetch,URL,AbortController,setTimeout,clearTimeout,Promise,Error,encodeURIComponent,console};
 vm.runInNewContext(source,context);
 return {root,calls,window,document,render:window.IAYACommunity.render,changeLanguage:window.IAYACommunity.onLanguageChange,setSession:v=>sessionValue=structuredClone(v)};
}
async function click(node,event='click',data={}){assert(node,'target exists');for(const fn of node.listeners[event]||[])await fn(data)}
async function flush(){await new Promise(r=>setImmediate(r))}
(async()=>{
 let cases=0;
 const base={authenticated:true,user:{id:'user-1',name:'Test Person',email:'test@example.com',is_admin:false},membership:null,csrf_token:'test-csrf'};
 let s=setup({authenticated:false});await s.render('join');assert.match(s.root.textContent,/Google sign-in is being configured/);assert.equal(s.calls.some(c=>c.path.includes('auth/google')),false);cases++;
 s=setup({authenticated:false},{lang:'ar'});await s.render('signin');assert.match(s.root.textContent,/قيد الإعداد/);cases++;
 s=setup(base);await s.render('join');const form=find(s.root,n=>n.tagName==='form');find(form,n=>n.name==='full_name').value='  Jane Example  ';find(form,n=>n.name==='university').value='  Test University  ';find(form,n=>n.name==='field').value='  Engineering  ';find(form,n=>n.name==='message').value='I would like to help.';find(form,n=>n.name==='consent').checked=true;await click(form,'submit',{preventDefault(){}});await flush();assert.match(s.root.textContent,/Your application is with the association/);const submission=s.calls.find(c=>c.path==='/api/membership');assert.equal(submission.options.headers['X-CSRF-Token'],'test-csrf');assert.deepEqual(JSON.parse(submission.options.body),{full_name:'Jane Example',university:'Test University',field:'Engineering',message:'I would like to help.',consent:true});cases++;
 s=setup({...base,membership:{status:'pending',full_name:'<img onerror="bad()">',university:'<script>alert(1)</script>'}});await s.render('community');assert.match(s.root.textContent,/<img/);assert.equal(find(s.root,n=>n.tagName==='img'),null);assert.equal(find(s.root,n=>n.tagName==='form'),null);cases++;
 s=setup({...base,membership:{status:'rejected',full_name:'Test Person',review_note:'Please clarify institution'}});await s.render('join');assert.match(s.root.textContent,/Please clarify institution/);assert(find(s.root,n=>n.tagName==='form'));cases++;
 s=setup({...base,membership:{status:'approved'}},{community:{resources:[{title:'<b>Unsafe title</b>',description:'Text only',url:'javascript:alert(1)'},{title:'Valid resource',url:'https://iaya.test/resource'}]}});await s.render('community');assert.equal(all(s.root,n=>n.target==='_blank').length,1);assert.equal(find(s.root,n=>n.tagName==='b'),null);cases++;
 s=setup(base);await s.render('admin');assert.match(s.root.textContent,/does not have administrator access/);assert.equal(s.calls.some(c=>c.path.startsWith('/api/admin')),false);cases++;
 s=setup({...base,user:{...base.user,is_admin:true}},{config:{configured:true,admin_review_enabled:true,google_client_id:'client'},applications:[{id:'application-1',full_name:'Applicant',status:'pending',version:4,email:'applicant@example.com',message:'Academic'}]});await s.render('admin');await click(find(s.root,n=>n.tagName==='button'&&n.textContent==='Approve'));await flush();const review=s.calls.find(c=>c.options.method==='PATCH');assert.equal(review.options.headers['X-CSRF-Token'],'test-csrf');assert.deepEqual(JSON.parse(review.options.body),{status:'approved',version:4,note:''});assert.match(s.root.textContent,/Approved member/);cases++;
 s=setup(base);await s.render('signin');await click(find(s.root,n=>n.tagName==='button'&&n.textContent==='Sign out'));assert.equal(s.window.location.hash,'#/signin');assert.equal(s.calls.find(c=>c.path==='/api/auth/logout').options.headers['X-CSRF-Token'],'test-csrf');cases++;
 s=setup({authenticated:false},{config:{configured:true,google_client_id:'google-client',admin_review_enabled:true}});await s.render('signin');await flush();assert.equal(s.window.google.options.nonce,'secure-nonce');s.setSession({...base,membership:{status:'approved'}});await s.window.google.options.callback({credential:'signed-google-id-token'});assert.deepEqual(JSON.parse(s.calls.find(c=>c.path==='/api/auth/google').options.body),{credential:'signed-google-id-token',nonce:'secure-nonce'});assert.equal(s.window.location.hash,'#/community');cases++;
 s=setup(base,{protocol:'file:'});await s.render('community');assert.match(s.root.textContent,/hosted website/);assert.equal(s.calls.length,0);cases++;

 for (const route of ['community','join','signin','admin']) {
  s=setup(route==='admin'?{...base,user:{...base.user,is_admin:true}}:base);await s.render(route);
  assert.equal(all(s.root,n=>n.className==='community-layout').length,1);
  const layout=s.root.children[0];assert.equal(layout.className,'community-layout');assert(find(layout,n=>n.className==='page-heading'));
  assert.equal(s.root.children.length,1);
 }
 cases++;
 s=setup({authenticated:false},{config:{configured:true,google_client_id:'google-client',admin_review_enabled:true}});s.window.location.hash='#/admin';await s.render('admin');await flush();s.setSession({...base,user:{...base.user,is_admin:true}});await s.window.google.options.callback({credential:'admin-google-token'});await flush();assert.equal(s.window.location.hash,'#/admin');assert(s.calls.some(c=>c.path.startsWith('/api/admin/applications')));cases++;
 s=setup(base);await s.render('join');const draftForm=find(s.root,n=>n.tagName==='form');const draftValues={full_name:'Draft name',university:'Draft institution',field:'Draft field',message:'Draft application message'};for(const [key,value] of Object.entries(draftValues))find(draftForm,n=>n.name===key).value=value;find(draftForm,n=>n.name==='consent').checked=true;s.document.documentElement.lang='ar';await s.changeLanguage();for(const [key,value] of Object.entries(draftValues))assert.equal(find(s.root,n=>n.name===key).value,value);assert.equal(find(s.root,n=>n.name==='consent').checked,true);assert.match(s.root.textContent,/طلب العضوية/);assert.equal(s.calls.some(c=>c.options.method==='POST'),false);cases++;
 s=setup({...base,user:{...base.user,is_admin:true}},{applications:[{id:'app-draft',full_name:'Applicant',status:'pending',version:7}]});await s.render('admin');const draftFilter=find(s.root,n=>n.id==='application-status-filter');draftFilter.value='all';await click(draftFilter,'change');await flush();find(s.root,n=>n.tagName==='textarea').value='Unsent review note';s.document.documentElement.lang='ar';await s.changeLanguage();assert.equal(find(s.root,n=>n.id==='application-status-filter').value,'all');assert.equal(find(s.root,n=>n.tagName==='textarea').value,'Unsent review note');assert.equal(s.calls.some(c=>c.options.method==='PATCH'),false);cases++;
 s=setup(base);await s.render('join');find(s.root,n=>n.name==='message').value='Private first account draft';s.setSession({...base,user:{...base.user,id:'different-user'}});s.document.documentElement.lang='ar';await s.changeLanguage();assert.equal(find(s.root,n=>n.name==='message').value,'');cases++;

 s=setup({authenticated:false},{config:{configured:true,google_client_id:'google-client',admin_review_enabled:true}});await s.render('signin');await flush();const lateCallback=s.window.google.options.callback;s.window.IAYACommunity.leave();s.window.location.hash='#/about';await lateCallback({credential:'late-token'});assert.equal(s.window.location.hash,'#/about');assert.equal(s.calls.some(c=>c.path==='/api/auth/google'),false);cases++;
 s=setup(base);await s.render('join');s.document.activeElement=find(s.root,n=>n.tagName==='button'&&n.type==='submit');await s.render('join');assert.equal(s.document.activeElement.tagName,'h1');assert(s.document.activeElement.isConnected);cases++;
 s=setup({...base,user:{...base.user,is_admin:true}},{applications:[{id:'app-focus',full_name:'Applicant',status:'pending',version:2}]});await s.render('admin');const focusedApprove=find(s.root,n=>n.tagName==='button'&&n.textContent==='Approve');s.document.activeElement=focusedApprove;await click(focusedApprove);await flush();assert.equal(s.document.activeElement.attrs.role,'status');assert(s.document.activeElement.isConnected);cases++;
 s=setup(base);await s.render('join');find(s.root,n=>n.name==='message').value='Temporary draft';await s.render('join');assert.equal(find(s.root,n=>n.name==='message').value,'');cases++;
 console.log(`${cases} pure DOM/API contract cases passed. Rendered visual review not performed.`);
})().catch(e=>{console.error(e);process.exit(1)});
