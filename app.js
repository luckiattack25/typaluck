import {ERAS,RELEASES,TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const favoritesKey='lucki-archive-saved-releases-v1';
let favorites=new Set();
try{favorites=new Set(JSON.parse(localStorage.getItem(favoritesKey)||'[]'));}catch{}
let currentEra=0,activeTrack=0,releaseFilter='all',releaseQuery='',newestFirst=true,lastFocus=null;
const coverMap=new Map();
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eraName=(i)=>ERAS[i].title;
const pad=n=>String(n).padStart(2,'0');

function initIntro(){
 const intro=$('#intro');const skip=()=>{intro.classList.add('closed');setTimeout(()=>intro.remove(),800)};
 if(reduced){intro.remove();return;}
 $('#skipIntro').addEventListener('click',skip);
 const lines=['LOCATING LOST SIGNALS...','SCANNING 11 CHAPTERS...','ARCHIVE COMPLETE / WELCOME BACK.'];
 let i=0;const timer=setInterval(()=>{if(!intro.isConnected){clearInterval(timer);return}$('#bootText').textContent=lines[i++%lines.length]},570);
 setTimeout(()=>{clearInterval(timer);if(intro.isConnected)skip()},2350);
}
function setupNav(){
 const toggle=$('#menuToggle'),nav=$('#mobileNav');
 toggle.addEventListener('click',()=>{nav.hidden=!nav.hidden;toggle.setAttribute('aria-expanded',String(!nav.hidden));toggle.setAttribute('aria-label',nav.hidden?'Open navigation':'Close navigation')});
 $$('#mobileNav a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;toggle.setAttribute('aria-expanded','false')}));
 const navLinks=$$('.desktop-nav a');
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+entry.target.id))}}},{rootMargin:'-25% 0px -65% 0px'});
 $$('.section-boundary').forEach(section=>observer.observe(section));
}
function initEras(){
 const track=$('#eraTrack');
 track.innerHTML=ERAS.map((e,i)=>`<button class="era-tab" type="button" data-era="${i}" aria-label="Open ${escapeHtml(e.title)} era" aria-pressed="false"><span class="tab-count">FILE ${pad(i+1)}</span><strong class="tab-year">${escapeHtml(e.year)}</strong><span class="tab-name">${escapeHtml(e.short)}</span></button>`).join('');
 track.addEventListener('click',ev=>{const tab=ev.target.closest('[data-era]');if(tab)selectEra(Number(tab.dataset.era),false)});
 $('#eraPrev').addEventListener('click',()=>selectEra((currentEra+ERAS.length-1)%ERAS.length,true));
 $('#eraNext').addEventListener('click',()=>selectEra((currentEra+1)%ERAS.length,true));
 selectEra(0,false);
}
function selectEra(index,autoscroll=true){
 currentEra=(index+ERAS.length)%ERAS.length;const e=ERAS[currentEra];
 $('#eraEyebrow').textContent=`${e.year} / ${e.tag}`;
 $('#eraNumeral').textContent=pad(currentEra+1);
 $('#eraName').textContent=e.title;
 $('#eraDescription').textContent=e.description;
 $('#eraProjects').innerHTML=e.projects.map(p=>`<span>${escapeHtml(p)}</span>`).join('');
 $('#eraVisual').style.setProperty('--feature-accent',e.accent);
 $('#eraVisual .era-symbol').textContent=pad(currentEra+1);
 $('#eraVisual .corner-tl').textContent=`REC / ${e.year}`;
 $('#eraVisual .corner-br').textContent=e.visual;
 $$('#eraTrack .era-tab').forEach((b,i)=>{const selected=i===currentEra;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
 if(autoscroll){$('#eraTrack .active').scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest',inline:'center'});if(location.hash!=='#eras')$('#eras').scrollIntoView({behavior:reduced?'auto':'smooth'})}
 setWorldAccent(e.accent);
}
function initVault(){
 $('#vaultTracks').innerHTML=TRACKS.map((t,i)=>`<button class="vault-track" type="button" data-track="${i}" aria-pressed="false"><span class="track-id">LL_26 / ${pad(i+1)}</span><strong class="track-name">${escapeHtml(t.name)}</strong><span class="track-time">${t.duration} ↗</span></button>`).join('');
 $('#vaultTracks').addEventListener('click',e=>{const el=e.target.closest('[data-track]');if(el)selectTrack(Number(el.dataset.track))});
 selectTrack(0);
}
function selectTrack(i){activeTrack=i;const t=TRACKS[i];
 $('#detailNumber').textContent=pad(i+1);$('#detailTitle').textContent=t.name;$('#detailDuration').textContent=t.duration;
 $('#detailText').textContent=t.context||'Included on the official 2026 archival release. An earlier recording period has not been independently established for this track.';
 $('#detailLink').href=LAST_LAUGH;
 $$('#vaultTracks button').forEach((b,n)=>{b.classList.toggle('selected',n===i);b.setAttribute('aria-pressed',String(n===i))});
}
function artMarkup(r){const loaded=coverMap.get(r.id);return loaded?`<img class="release-art" loading="lazy" src="${escapeHtml(loaded)}" alt="Cover artwork for ${escapeHtml(r.title)}" onerror="this.style.display='none'">`:`<div class="art-fallback" style="--fallback1:${r.color[0]};--fallback2:${r.color[1]}"><small>LUCKI / ${r.year}</small><strong>${escapeHtml(r.title)}</strong><small>ARCHIVE / NO. ${escapeHtml(r.id.toUpperCase())}</small></div>`}
function currentReleases(){return RELEASES.filter(r=>{
 const matchFilter=releaseFilter==='all'||(releaseFilter==='favorite'?favorites.has(r.id):r.type===releaseFilter);
 return matchFilter&&`${r.title} ${r.year} ${r.type}`.toLowerCase().includes(releaseQuery)
 }).sort((a,b)=>(newestFirst?b.year-a.year:a.year-b.year)||a.title.localeCompare(b.title));}
function renderReleases(){const releases=currentReleases();$('#resultCount').textContent=`${pad(releases.length)} RECORDS FOUND`;
 $('#releaseGrid').innerHTML=releases.length?releases.map(r=>`<article class="release-item"><button class="release-art-button" data-open="${r.id}" aria-label="View details for ${escapeHtml(r.title)}">${artMarkup(r)}<span class="overlay-arrow" aria-hidden="true">↗</span></button><div class="release-info"><div><p class="release-year">${r.year} / ARCHIVE ENTRY</p><h3>${escapeHtml(r.title)}</h3><div class="release-type">${escapeHtml(r.type)}</div></div><button class="favorite-button ${favorites.has(r.id)?'saved':''}" data-favorite="${r.id}" aria-pressed="${favorites.has(r.id)}" aria-label="${favorites.has(r.id)?'Remove':'Save'} ${escapeHtml(r.title)}">${favorites.has(r.id)?'★':'☆'}</button></div></article>`).join(''):'<p class="mono">NO MATCHES FOUND. TRY A DIFFERENT SEARCH OR FILTER.</p>';
}
function initDiscography(){
 $('#releaseSearch').addEventListener('input',e=>{releaseQuery=e.target.value.trim().toLowerCase();renderReleases()});
 $('#filterPills').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;releaseFilter=b.dataset.filter;$$('.filter-pill').forEach(p=>{p.classList.toggle('active',p===b);p.setAttribute('aria-pressed',String(p===b))});renderReleases()});
 $('#sortRelease').addEventListener('click',()=>{newestFirst=!newestFirst;$('#sortRelease').textContent=newestFirst?'NEWEST FIRST ↓':'OLDEST FIRST ↑';renderReleases()});
 $('#releaseGrid').addEventListener('click',e=>{const fav=e.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem(favoritesKey,JSON.stringify([...favorites]))}catch{}renderReleases();return}const open=e.target.closest('[data-open]');if(open)openRelease(open.dataset.open)});
 $('#modalClose').addEventListener('click',closeRelease);$('.modal-backdrop').addEventListener('click',closeRelease);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRelease()});
 renderReleases();void fetchArtwork();
}
function openRelease(id){const r=RELEASES.find(item=>item.id===id);if(!r)return;lastFocus=document.activeElement;
 const art=artMarkup(r).replace('class="release-art"','class="modal-art"');
 const url=coverMap.get(r.id+'-url')||r.url||`https://music.apple.com/us/search?term=${encodeURIComponent(r.title+' Lucki')}`;
 const era=ERAS.find(e=>e.id===r.era);
 $('#modalContent').innerHTML=`<div class="modal-grid"><div class="modal-fallback">${art}</div><div><p class="eyebrow">ARCHIVE ENTRY / ${r.year}</p><h2 id="modalTitle">${escapeHtml(r.title)}</h2><p class="mono">${escapeHtml(r.type.toUpperCase())} · ${era?escapeHtml(era.short):'LUCKI'}</p><p>${escapeHtml(r.notes)}</p>${r.id==='last-laugh'?`<p>OFFICIAL TRACKLIST / ${TRACKS.length} TRACKS<br>${TRACKS.map(t=>escapeHtml(t.name)).join(' / ')}</p>`:''}<a class="button-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${r.url||coverMap.has(r.id+'-url')?'OPEN OFFICIAL LISTING':'SEARCH APPLE MUSIC'} ↗</a></div></div>`;
 $('#releaseModal').hidden=false;document.body.style.overflow='hidden';$('#modalClose').focus();
}
function closeRelease(){if($('#releaseModal').hidden)return;$('#releaseModal').hidden=true;document.body.style.overflow='';lastFocus?.focus?.()}
async function fetchArtwork(){
 // Optional enhancement: dynamic official platform metadata. The entire website works without it.
 try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),11000);
 const res=await fetch('https://itunes.apple.com/search?term=lucki&entity=album&limit=200&country=US',{signal:controller.signal});clearTimeout(timeout);if(!res.ok)throw new Error('catalog unavailable');
 const data=await res.json();const albums=(data.results||[]).filter(x=>/lucki/i.test(x.artistName||'')&&x.collectionName&&x.artworkUrl100);
 for(const release of RELEASES){
 const match=albums.find(x=>normalize(x.collectionName)===normalize(release.title))||albums.find(x=>normalize(x.collectionName).startsWith(normalize(release.title))&&normalize(release.title).length>6);
 if(match){coverMap.set(release.id,match.artworkUrl100.replace('100x100bb','600x600bb'));if(match.collectionViewUrl)coverMap.set(release.id+'-url',match.collectionViewUrl)}
 }renderReleases();
 }catch(error){/* graceful fallback to bespoke abstract art */}
}
function initCompare(){const options=ERAS.map((e,i)=>`<option value="${i}">${escapeHtml(e.year)} — ${escapeHtml(e.short)}</option>`).join('');$('#compareA').innerHTML=options;$('#compareB').innerHTML=options;$('#compareA').value='0';$('#compareB').value='10';
 const render=()=>{for(const [sel,panel,label] of [['#compareA','#comparePanelA','THEN'],['#compareB','#comparePanelB','NOW']]){const e=ERAS[Number($(sel).value)];const target=$(panel);target.style.setProperty('--compare-accent',e.accent);target.innerHTML=`<div class="compare-label">${label} / ${escapeHtml(e.year)}</div><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.description)}</p><div class="compare-projects">FEATURED PROJECTS / ${e.projects.map(escapeHtml).join(' · ')}</div>`}};
 $('#compareA').addEventListener('change',render);$('#compareB').addEventListener('change',render);render();
}
function initTerminal(){const out=$('#terminalOutput');const log=(text,cl='')=>{const el=document.createElement('div');el.className=cl;el.textContent=text;out.append(el);out.scrollTop=out.scrollHeight};
 function run(value){const input=value.trim();if(!input)return;log('> '+input,'cmd');const normalized=input.toUpperCase().replace(/\s+/g,' ');
 if(normalized==='CLEAR'){out.innerHTML='';log('> TERMINAL CLEARED.');return}
 if(normalized==='HELP'){['COMMANDS:','HELP — LIST COMMANDS','ERA [YEAR] — SELECT A YEAR / CHAPTER','FIND [WORD] — SEARCH PROJECTS','LAST LAUGH — ENTER THE VAULT','RANDOM — SELECT AN ERA AT RANDOM','SOURCES — SHOW ORIGINAL REFERENCES','CLEAR — CLEAR THE TERMINAL'].forEach(x=>log('> '+x));return}
 if(normalized==='RANDOM'){const i=Math.floor(Math.random()*ERAS.length);selectEra(i,false);log('> RANDOM FILE LOADED: '+ERAS[i].year+' / '+ERAS[i].title);$('#eras').scrollIntoView({behavior:reduced?'auto':'smooth'});return}
 if(normalized==='LAST LAUGH'||normalized==='VAULT'){log('> OPENING 2026 ARCHIVAL VAULT...');$('#vault').scrollIntoView({behavior:reduced?'auto':'smooth'});return}
 if(normalized==='SOURCES'){['Apple Music: '+APPLE_ARTIST,'MusicBrainz: musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274','Last Laugh: '+LAST_LAUGH].forEach(x=>log('> '+x));return}
 if(normalized.startsWith('ERA ')){const q=normalized.slice(4).trim();const i=ERAS.findIndex(e=>e.year.includes(q)||e.title.toUpperCase().includes(q)||e.short.toUpperCase().includes(q));if(i<0){log('> NO ERA FOUND FOR '+q,'error');return}selectEra(i,false);log('> FILE FOUND: '+ERAS[i].year+' / '+ERAS[i].title);$('#eras').scrollIntoView({behavior:reduced?'auto':'smooth'});return}
 const q=(normalized.startsWith('FIND ')?normalized.slice(5):normalized).trim().toLowerCase();const matches=RELEASES.filter(r=>r.title.toLowerCase().includes(q)||String(r.year).includes(q)).slice(0,8);
 if(matches.length){log(`> ${matches.length} MATCH${matches.length===1?'':'ES'} FOUND:`);matches.forEach(r=>log(`> ${r.year} / ${r.title} [${r.type.toUpperCase()}]`));log('> OPEN DISCOGRAPHY TO INSPECT RECORDS.')}else log('> NO MATCHES. TYPE HELP TO SEE COMMANDS.','error')
 }
 $('#terminalForm').addEventListener('submit',e=>{e.preventDefault();const field=$('#terminalInput');run(field.value);field.value=''});
 $$('.terminal-shortcuts button').forEach(b=>b.addEventListener('click',()=>run(b.dataset.cmd)));
 $('#randomEra').addEventListener('click',()=>run('RANDOM'));
 document.addEventListener('keydown',e=>{const el=document.activeElement;const typing=el&&(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable);if(e.key==='/'&&!typing&&$('#releaseModal').hidden){e.preventDefault();$('#terminalInput').focus();$('#archive').scrollIntoView({behavior:reduced?'auto':'smooth'})}});
}

let worldAccent='#d5fb58';let worldSetter=null;
function setWorldAccent(color){worldAccent=color;if(worldSetter)worldSetter(color)}
async function initWorld(){
 if(reduced||!$('#world'))return;
 try{
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const canvas=$('#world');const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:Math.min(devicePixelRatio,2)<1.7,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,90);camera.position.set(0,0,12);
  const group=new THREE.Group();group.position.x=innerWidth>750?3:1;scene.add(group);
  const ringMaterial=new THREE.MeshStandardMaterial({color:0x292b26,metalness:.8,roughness:.25,side:THREE.DoubleSide});
  const torus=new THREE.Mesh(new THREE.TorusGeometry(2.25,.16,18,130),ringMaterial);group.add(torus);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.93,1.93,.13,100,1),new THREE.MeshStandardMaterial({color:0x1b211e,metalness:.74,roughness:.3}));disc.rotation.x=Math.PI/2;group.add(disc);
  const cutout=new THREE.Mesh(new THREE.TorusGeometry(1.05,.016,5,110),new THREE.MeshBasicMaterial({color:0x9caa75,transparent:true,opacity:.24}));group.add(cutout);
  const outer=new THREE.Mesh(new THREE.TorusGeometry(3.12,.012,5,144),new THREE.MeshBasicMaterial({color:0xa9c369,transparent:true,opacity:.52}));outer.rotation.set(.68,.2,.12);group.add(outer);
  const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,2),new THREE.MeshPhysicalMaterial({color:0xd5fb58,metalness:.82,roughness:.2,clearcoat:1,flatShading:true}));group.add(inner);
  const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.07,1),new THREE.MeshBasicMaterial({color:0xd5fb58,wireframe:true,transparent:true,opacity:.14}));group.add(wire);
  const glow=new THREE.PointLight(0xbef471,30,24);glow.position.set(3,3,4);scene.add(glow);
  const fill=new THREE.PointLight(0xa65870,32,24);fill.position.set(-3,-2,3);scene.add(fill);scene.add(new THREE.AmbientLight(0xaab7b0,.75));
  const count=innerWidth<760?180:450;const positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*38;positions[i*3+1]=(Math.random()-.5)*24;positions[i*3+2]=-1-Math.random()*30}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0x8d9b7d,size:.035,transparent:true,opacity:.65}));scene.add(stars);
  let tx=0,ty=0,scrollY=0,visible=true;const clock=new THREE.Clock();
  const move=e=>{tx=(e.clientX/innerWidth-.5)*.6;ty=(e.clientY/innerHeight-.5)*.55};
  const scroll=()=>{scrollY=window.scrollY/(document.documentElement.scrollHeight-innerHeight||1)};
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));group.position.x=innerWidth>750?3:1;group.scale.setScalar(innerWidth<650?.58:innerWidth<950?.8:1)};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>visible=!document.hidden);resize();
  worldSetter=color=>{inner.material.color.set(color);wire.material.color.set(color);glow.color.set(color);outer.material.color.set(color)};
  worldSetter(worldAccent);
  let frame=0;function animate(){frame=requestAnimationFrame(animate);if(!visible)return;const t=clock.getElapsedTime();group.rotation.y+=(tx-group.rotation.y)*.035;group.rotation.x+=(ty-group.rotation.x)*.035;group.rotation.z=t*.035+scrollY*.8;inner.rotation.set(t*.11,t*.25,t*.07);wire.rotation.y=-t*.13;outer.rotation.z=t*.075;group.position.y=Math.sin(t*.55)*.13+(scrollY-.5)*.7;stars.rotation.y=t*.003;renderer.render(scene,camera)}animate();
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer.dispose();geo.dispose();torus.geometry.dispose();disc.geometry.dispose();inner.geometry.dispose();wire.geometry.dispose();outer.geometry.dispose();cutout.geometry.dispose()},{once:true});
 }catch(err){$('#world').style.display='none';console.info('WebGL unavailable; the accessible HTML/CSS archive is fully usable.');}
}
function initPointer(){if(!matchMedia('(hover:hover) and (pointer:fine)').matches||reduced)return;const ring=$('.cursor-ring');window.addEventListener('pointermove',e=>{ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';ring.classList.add('visible')},{passive:true});document.addEventListener('pointerover',e=>ring.classList.toggle('active',!!e.target.closest('button,a')))}
function init(){initIntro();setupNav();initEras();initVault();initDiscography();initCompare();initTerminal();initPointer();void initWorld()}
init();