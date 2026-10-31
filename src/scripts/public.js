(function(){
 'use strict';
 var root=document.documentElement,header=document.querySelector('.site-header'),menu=document.getElementById('menu'),theme=document.getElementById('theme'),language=document.getElementById('lang');
 var currentRoute='home';
 var pageNames={home:['Home','الرئيسية'],about:['About the Association','عن الجمعية'],activities:['Our work','أعمالنا'],events:['Events','الفعاليات'],resources:['Resources','الموارد'],contact:['Contact us','تواصل معنا'],privacy:['Privacy','الخصوصية'],community:['Membership','العضوية'],join:['Membership application','طلب العضوية'],signin:['Member sign-in','دخول الأعضاء'],admin:['Membership review','مراجعة العضوية'],'not-found':['Page not found','الصفحة غير موجودة']};
 function labels(){var dark=root.dataset.theme==='dark';theme.querySelector('.en').textContent=dark?'Light':'Dark';theme.querySelector('.ar').textContent=dark?'فاتح':'داكن';theme.setAttribute('aria-pressed',String(dark));theme.setAttribute('aria-label',root.lang==='ar'?(dark?'التبديل إلى المظهر الفاتح':'التبديل إلى المظهر الداكن'):(dark?'Switch to light mode':'Switch to dark mode'));language.setAttribute('aria-label',root.lang==='ar'?'Switch to English':'التبديل إلى العربية');menu.setAttribute('aria-label',root.lang==='ar'?'قائمة التنقل':'Navigation menu');document.querySelectorAll('[data-label-en]').forEach(function(e){e.setAttribute('aria-label',root.lang==='ar'?e.dataset.labelAr:e.dataset.labelEn)});document.querySelectorAll('[data-alt-en]').forEach(function(e){e.alt=root.lang==='ar'?e.dataset.altAr:e.dataset.altEn});var logo=document.querySelector('.brand img');if(logo)logo.alt=root.lang==='ar'?'شعار جمعية الشباب الأكاديمي العراقي في المملكة المتحدة':'IAYA UK logo';document.getElementById('theme-color').content=dark?'#08162f':'#f7faff'}
 function closeMenu(){header.dataset.open='false';menu.setAttribute('aria-expanded','false')}
 theme.addEventListener('click',function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('iaya-theme',root.dataset.theme)}catch(e){}labels()});
 // Until the visitor picks a theme, keep following the device's light or dark setting.
 var deviceDark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
 if(deviceDark&&deviceDark.addEventListener)deviceDark.addEventListener('change',function(e){try{if(localStorage.getItem('iaya-theme'))return}catch(x){}root.dataset.theme=e.matches?'dark':'light';labels()});
 language.addEventListener('click',function(){root.lang=root.lang==='en'?'ar':'en';root.dir=root.lang==='ar'?'rtl':'ltr';try{localStorage.setItem('iaya-lang',root.lang)}catch(e){}labels();updateTitle();if(window.IAYACommunity&&['community','join','signin','admin'].indexOf(currentRoute)>=0)window.IAYACommunity.onLanguageChange()});
 menu.addEventListener('click',function(){var open=header.dataset.open!=='true';header.dataset.open=String(open);menu.setAttribute('aria-expanded',String(open));if(open){var first=document.querySelector('#main-nav a');if(first)first.focus()}});
 document.addEventListener('click',function(e){if(e.target.closest('#main-nav a')||!header.contains(e.target))closeMenu()});
 // The nav precedes the toggle in source order, so keep keyboard focus inside the open menu and close it once focus leaves the header.
 header.addEventListener('focusout',function(e){if(header.dataset.open==='true'&&e.relatedTarget&&!header.contains(e.relatedTarget))closeMenu()});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&header.dataset.open==='true'){closeMenu();menu.focus()}});
 function updateTitle(){var name=pageNames[currentRoute]||pageNames['not-found'];document.title=(root.lang==='ar'?name[1]:name[0])+' | IAYA UK'}
 function route(event){
  var hash=location.hash.slice(1);if(hash==='main')return;
  var parts=hash.replace(/^\//,'').split('/'),name=parts[0]||'home';
  var alias={team:'about',hub:'resources',login:'signin'};name=alias[name]||name;
  currentRoute=pageNames[name]?name:'not-found';var account=['community','join','signin','admin'].indexOf(currentRoute)>=0;
  document.querySelectorAll('[data-page]').forEach(function(p){p.hidden=p.dataset.page!==(account?'community':currentRoute)});
  document.querySelectorAll('[data-nav]').forEach(function(a){if(a.dataset.nav===(account?'community':currentRoute))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  closeMenu();updateTitle();
  if(event&&event.type==='hashchange'&&!document.getElementById(hash.replace(/^\//,'')||'-')){window.scrollTo({top:0,behavior:'instant'});var bar=document.getElementById('route-bar');if(!bar){bar=document.createElement('div');bar.id='route-bar';bar.className='route-bar';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar)}bar.classList.remove('go');void bar.offsetWidth;bar.classList.add('go')}
  if(window.IAYACommunity){if(account)window.IAYACommunity.render(currentRoute);else if(window.IAYACommunity.leave)window.IAYACommunity.leave()}
  requestAnimationFrame(function(){if(event&&event.type==='hashchange')document.getElementById('main').focus({preventScroll:true});if(currentRoute==='about'&&parts[1]==='team')document.getElementById('committee').scrollIntoView({block:'start'});else scrollTo({top:0,behavior:'instant'})});
 }
 window.addEventListener('hashchange',route);labels();route();
 // Show a different random six of the committee on each visit; the first six stay as the no-script fallback.
 (function(){var box=document.getElementById('committee-preview'),all=document.querySelectorAll('[data-page=about] .people-grid>*');if(!box||all.length<7)return;var pool=Array.prototype.slice.call(all);for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=pool[i];pool[i]=pool[j];pool[j]=t}box.textContent='';pool.slice(0,box.dataset.count?+box.dataset.count:6).forEach(function(n){box.appendChild(n.cloneNode(true))})})();
 // Scroll reveals: the hidden state exists only once this script has run, so content never stays hidden without JS.
 if('IntersectionObserver' in window&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){
  var io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})},{threshold:.15,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('.chapter h2,.page-top h1').forEach(function(el){io.observe(el)});
  document.querySelectorAll('.update-card,.involve-card,.arches li,.glance-list li,.legacy li,.people-grid>*').forEach(function(el,i){el.classList.add('rise');el.style.setProperty('--i',String(i%4));io.observe(el)});
  setTimeout(function(){document.querySelectorAll('.motion .chapter h2:not(.in),.motion .page-top h1:not(.in),.motion .rise:not(.in)').forEach(function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)el.classList.add('in')})},1500);
  root.classList.add('motion');
 }
})();
