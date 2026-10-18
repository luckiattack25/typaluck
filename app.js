import {ERAS,RELEASES,TRACKS,SON_OF_SAM_TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchScreen = matchMedia('(pointer:coarse)').matches;
const app={index:0,entered:false,drawer:false,detail:null,catalog:false,info:false,world:null,transitioning:false,loadingCovers:false,coverUrls:new Map(),imageTargets:new Map(),rendererOkay:false,favorites:new Set(),mode:'idle'};
const albumTracks=new Map(), trackRequests=new Map();
const previewAudio=new Audio();previewAudio.preload='none';previewAudio.volume=.72;
let previewSequence=0, playingRow=null, activePreviewTrack=null, previewPinned=false;
try{app.favorites=new Set(JSON.parse(localStorage.getItem('lucki-archive-saved-v2')||'[]'))}catch{}

function escapeHTML(input){return String(input??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalize(s){return String(s||'').toLowerCase().replace(/\(archive tape\)/g,'').replace(/\(.*?(deluxe|remastered).*?\)/g,'').replace(/[^a-z0-9]/g,'')}
function yearLabel(year){return String(year)}
function releaseSearchLink(r){return r.url||`https://music.apple.com/us/search?term=${encodeURIComponent('LUCKI '+r.title)}`}
function releaseLink(r){return app.imageTargets.get(r.id)?.link||releaseSearchLink(r)}
function coverCard(r){const src=app.coverUrls.get(r.id);const title=escapeHTML(r.title);const colorA=r.color?.[0]||'#454544',colorB=r.color?.[1]||'#121415';return `<div class="cover-image" style="--cover1:${colorA};--cover2:${colorB}"><span class="cover-letter" aria-label="Artwork unavailable">${escapeHTML(r.title.slice(0,24))}</span>${src?`<img src="${escapeHTML(src)}" alt="${title} — cover artwork" loading="lazy" onerror="this.remove()">`:''}</div>`}
function officialRelease(r){const best=app.imageTargets.get(r.id);return best?.link||releaseSearchLink(r)}
// Tracks come from exact Apple Music/iTunes collection IDs, never from a fuzzy song search.
// Only Apple-supplied previewUrl values can be played; full copyrighted tracks are not hosted.
function timeLabel(milliseconds){if(!Number.isFinite(milliseconds)||milliseconds<=0)return '—';const n=Math.round(milliseconds/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
function fallbackTracks(r){return r.id==='last-laugh'?TRACKS.map((t,i)=>({name:t.name,duration:t.duration,number:i+1,previewUrl:null,context:t.context||''})):r.id==='son-of-sam'?SON_OF_SAM_TRACKS.map((t,i)=>({name:t.name,duration:t.duration,number:i+1,previewUrl:null,context:''})):[]}
function trackRows(r){return albumTracks.get(r.id)||fallbackTracks(r)}
function stopPreview(){previewPinned=false;previewSequence++;previewAudio.pause();playingRow=null;activePreviewTrack=null;document.querySelectorAll('.song-row.is-playing').forEach(el=>el.classList.remove('is-playing'));const hud=$('#previewHud');if(hud)hud.hidden=true}
previewAudio.addEventListener('ended',stopPreview);
function showPreviewStatus(song,status){$('#previewHud').hidden=false;$('#previewSong').textContent=song;$('#previewStatus').textContent=status}
async function startPreview(track,row){
 if(!track.previewUrl)return;
 if(activePreviewTrack===track.previewUrl&&!previewAudio.paused)return;
 const request=++previewSequence;
 previewAudio.pause();playingRow?.classList.remove('is-playing');playingRow=row;activePreviewTrack=track.previewUrl;
 showPreviewStatus(track.name,'STARTING OFFICIAL PREVIEW…');
 previewAudio.src=track.previewUrl;
 try{
  await previewAudio.play();
  if(request!==previewSequence){previewAudio.pause();return}
  row.classList.add('is-playing');showPreviewStatus(track.name,previewPinned?'◉ PREVIEW PINNED · PRESS STOP TO END':'◉ PLAYING SHORT PREVIEW · HOVER OFF TO STOP');
 }catch(e){
  if(request!==previewSequence)return;
  activePreviewTrack=null;row.classList.remove('is-playing');
  showPreviewStatus(track.name,'BROWSER BLOCKED HOVER AUDIO · CLICK TO PLAY');
  // The row is still available for an explicit click gesture, and the rest of the site works.
  console.info('Preview cannot autoplay; click the song instead.',e?.name||'');
 }
}
function bindSongRows(){
 $$('#drawerContent .song-row').forEach(row=>{
  const id=row.dataset.release, idx=Number(row.dataset.track);const release=RELEASES.find(r=>r.id===id);
  const track=release&&trackRows(release)[idx];if(!track||!track.previewUrl)return;
  row.addEventListener('mouseenter',()=>{void startPreview(track,row)});
  row.addEventListener('mouseleave',()=>{if(playingRow===row||activePreviewTrack===track.previewUrl)stopPreview()});
  row.addEventListener('click',()=>{if(playingRow===row&&!previewAudio.paused){stopPreview()}else void startPreview(track,row)});
  row.addEventListener('focus',()=>{row.dataset.focus='true'});
 });
}
async function loadAlbumTracks(release){
 if(albumTracks.has(release.id))return albumTracks.get(release.id);
 if(trackRequests.has(release.id))return trackRequests.get(release.id);
 if(!release.appleId){const rows=fallbackTracks(release);albumTracks.set(release.id,rows);app.world?.setTracks(release.id,rows);return rows}
 const promise=(async()=>{
  let rows=[];
  try{
   const fetchCollection=async id=>fetchJson('https://itunes.apple.com/lookup?'+new URLSearchParams({id:String(id),entity:'song',country:'US',limit:'250'}),8500);
   let actualId=release.appleId;
   let json=await fetchCollection(actualId);
   let candidates=(json.results||[]).filter(t=>t.wrapperType==='track'&&t.kind==='song'&&String(t.collectionId)===String(actualId)&&/lucki/i.test(String(t.artistName||'')));
   // If an old collection ID was retired, search by exact release title, never fuzzy song matches.
   if(!candidates.length){
     const results=await fetchJson('https://itunes.apple.com/search?'+new URLSearchParams({term:'LUCKI '+release.title,entity:'album',country:'US',limit:'40'}),6500);
     const matched=(results.results||[]).find(x=>x.collectionId&&/lucki/i.test(String(x.artistName||''))&&normalize(x.collectionName)===normalize(release.title));
     if(matched){actualId=matched.collectionId;json=await fetchCollection(actualId);
       candidates=(json.results||[]).filter(t=>t.wrapperType==='track'&&t.kind==='song'&&String(t.collectionId)===String(actualId)&&/lucki/i.test(String(t.artistName||'')));
     }
   }
   const byTrack=new Map();
   for(const t of candidates){const key=String(t.discNumber||1)+':'+String(t.trackNumber||t.trackId);if(!byTrack.has(key))byTrack.set(key,t)}
   rows=[...byTrack.values()].sort((a,b)=>(a.discNumber||1)-(b.discNumber||1)||(a.trackNumber||0)-(b.trackNumber||0)).map((t,i)=>({name:String(t.trackName||'Untitled'),duration:timeLabel(t.trackTimeMillis),number:i+1,previewUrl:/^https:\/\//.test(t.previewUrl||'')?t.previewUrl:null,context:''}));
  }catch(error){console.info('Album tracklist unavailable for '+release.title,error?.message||'network error')}
  if(!rows.length)rows=fallbackTracks(release);
  albumTracks.set(release.id,rows);
  app.world?.setTracks(release.id,rows);
  if(app.drawer&&app.detail===release.id)renderDrawer();
  return rows;
 })();
 trackRequests.set(release.id,promise);
 try{return await promise}finally{trackRequests.delete(release.id)}
}
function songListHTML(r){
 const list=trackRows(r),isLoading=trackRequests.has(r.id);
 if(!list.length)return `<section class="track-list"><div class="songs-heading"><span>TRACK INDEX</span><small>${isLoading?'FETCHING OFFICIAL TRACKLIST…':'TRACKLIST UNAVAILABLE'}</small></div><p class="track-empty">${isLoading?'Loading tracks from Apple Music…':'This release is not currently returned by the music catalog. Open its official listing to browse songs.'}</p></section>`;
 return `<section class="track-list"><div class="songs-heading"><span>TRACK INDEX / ${String(list.length).padStart(2,'0')}</span><small>HOVER TO HEAR · CLICK TO PLAY</small></div><div class="songs-grid">${list.map((track,i)=>`<button type="button" class="song-row" data-release="${escapeHTML(r.id)}" data-track="${i}" ${track.previewUrl?'': 'disabled'} title="${track.previewUrl?'Hover or click to play preview':'Preview not available for this track'}"><span class="song-number">${String(track.number||i+1).padStart(2,'0')}</span><span class="song-title">${escapeHTML(track.name)}${track.context?`<small>${escapeHTML(track.context)}</small>`:''}</span><span class="song-duration">${escapeHTML(track.duration||'—')}</span><span class="song-play">${track.previewUrl?'▶':'—'}</span></button>`).join('')}</div><p class="track-credit">${list.some(t=>t.previewUrl)?'Audio is a short, official catalog preview. Some tracks are unavailable.':'Tracklist verified; official playback previews are not available here. Use the streaming link above.'}</p></section>`;
}

function eraReleaseList(index){const id=ERAS[index].id;return RELEASES.filter(r=>r.era===id).sort((a,b)=>(a.id===id?-1:0)-(b.id===id?-1:0))}
// Load official release tracks as visitors walk into a new 3D room.
function warmEraSongs(index){const release=eraReleaseList(index)[0];if(release&&!albumTracks.has(release.id))void loadAlbumTracks(release)}
function announce(text){$('#announcer').textContent=text}

function updateFallbackArt(){const rs=eraReleaseList(app.index);$$('.fallback-plane').forEach((plane,i)=>{const r=rs[i]||RELEASES[(app.index+i)%RELEASES.length];const url=app.coverUrls.get(r.id);plane.innerHTML=url?`<img src="${escapeHTML(url)}" alt="" onerror="this.parentElement.classList.remove('has-art');this.remove()">`:'';plane.classList.toggle('has-art',Boolean(url))})}
function updateEraUI(){const e=ERAS[app.index];document.documentElement.style.setProperty('--accent',e.accent);$('#chapterCounter').textContent=`CHAPTER ${String(app.index+1).padStart(3,'0')} / ${String(ERAS.length).padStart(3,'0')}`;$('#eraZone').textContent=e.tag;$('#eraIndex').textContent=String(app.index+1).padStart(2,'0')+' / '+ERAS.length;$('#eraDate').textContent=e.year;$('#eraTitle').textContent=e.title;$('#eraTag').textContent=e.tag;$('#eraDesc').textContent=e.description;$('#progressFraction').textContent=String(app.index+1).padStart(2,'0')+'/'+ERAS.length;$('#progressBar').style.width=`${((app.index+1)/ERAS.length)*100}%`;$('#prevButton').disabled=app.index===0;$('#nextButton').disabled=app.index===ERAS.length-1;
 $('#eraProjects').innerHTML=eraReleaseList(app.index).map(r=>`<button data-project="${r.id}">${escapeHTML(r.title)} ↗</button>`).join('');
 $('#eraProjects').querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>openDrawer(b.dataset.project)));
 $$('.year-stop').forEach((button,i)=>{button.classList.toggle('active',i===app.index);button.setAttribute('aria-current',i===app.index?'step':'false')});
 $('#sceneFallback').style.setProperty('--fallback-accent',e.accent);updateFallbackArt();
 announce(`Now exploring ${e.title}, ${e.year}. ${eraReleaseList(app.index).length} records in this chapter.`);
}
function createRail(){$('#yearRail').innerHTML=ERAS.map((e,i)=>`<button class="year-stop ${i===0?'active':''}" data-era="${i}" aria-label="Go to ${e.title}, ${e.year}" title="${escapeHTML(e.title)}"><span class="dot"></span><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');$$('.year-stop').forEach(el=>el.addEventListener('click',()=>goTo(Number(el.dataset.era))))}

let travelTimer=null;
function goTo(index,{instant=false}={}){stopPreview();const next=clamp(index,0,ERAS.length-1);if(next===app.index&&!instant)return;if(app.catalog||app.info)return;closeDrawer();const distance=Math.abs(next-app.index);app.index=next;updateEraUI();warmEraSongs(next);if(app.world)app.world.setEra(next,instant);if(!prefersReduced&&!instant&&distance>1){const w=$('#wipe');$('#wipeYear').textContent=ERAS[next].year.split('—')[0];w.classList.remove('in');void w.offsetWidth;w.classList.add('in');clearTimeout(travelTimer);travelTimer=setTimeout(()=>w.classList.remove('in'),1000)} }
function next(){if(app.entered)goTo(app.index+1)}
function previous(){if(app.entered)goTo(app.index-1)}

function openDrawer(id){stopPreview();const r=id?RELEASES.find(r=>r.id===id):null;app.drawer=true;app.detail=r?.id||null;renderDrawer();$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#drawerClose').focus({preventScroll:true})}
function closeDrawer(){stopPreview();app.drawer=false;$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true')}
function renderDrawer(){if(playingRow)stopPreview();const era=ERAS[app.index];const rs=eraReleaseList(app.index);const target=RELEASES.find(r=>r.id===app.detail);
 if(target){const saved=app.favorites.has(target.id);const trackHtml=songListHTML(target);
 $('#drawerContent').innerHTML=`<button class="back-link" id="backToEra">← BACK TO ERA ${String(app.index+1).padStart(2,'0')}</button><p class="drawer-era-index mono">OFFICIAL RELEASE / ${target.year} / ${escapeHTML(target.type.toUpperCase())}</p><div class="record-detail"><div class="hero-cover">${coverCard(target)}</div><h3>${escapeHTML(target.title)}</h3><p>${escapeHTML(target.notes)}</p><a class="record-link" href="${escapeHTML(officialRelease(target))}" target="_blank" rel="noopener noreferrer">OPEN OFFICIAL MUSIC LISTING ↗</a><p><button id="favoriteButton" class="back-link">${saved?'★ SAVED TO YOUR ARCHIVE':'☆ SAVE TO YOUR ARCHIVE'}</button></p>${trackHtml}<p class="drawer-note">Official cover imagery appears when a public music-catalog preview is available. Recording periods are not inferred from release dates.</p></div>`;
 bindSongRows();if(!albumTracks.has(target.id)&&!trackRequests.has(target.id))void loadAlbumTracks(target);
 $('#backToEra').addEventListener('click',()=>{app.detail=null;renderDrawer()});$('#favoriteButton').addEventListener('click',()=>{if(app.favorites.has(target.id))app.favorites.delete(target.id);else app.favorites.add(target.id);try{localStorage.setItem('lucki-archive-saved-v2',JSON.stringify([...app.favorites]))}catch{}renderDrawer()});
 }else{
 $('#drawerContent').innerHTML=`<p class="drawer-era-index mono">CHAPTER ${String(app.index+1).padStart(3,'0')} / ${era.year} / ${era.visual}</p><h2 class="drawer-title">${escapeHTML(era.title)}</h2><p class="drawer-describe">${escapeHTML(era.description)}</p><p class="mono" style="color:var(--sharp);padding:10px 0 15px">SELECT A RECORD TO INSPECT ↘</p><div class="drawer-covers">${rs.map(r=>`<button class="drawer-release" data-record="${r.id}">${coverCard(r)}<span class="cover-meta"><strong>${escapeHTML(r.title)}</strong><em>${r.year}</em></span></button>`).join('')}</div>${app.index===ERAS.length-1?`<p class="drawer-note">The 2026 archival release revisits recordings from earlier periods. Individual recording dates are only shown when verified.</p>`:''}`;
 $$('.drawer-release').forEach(b=>b.addEventListener('click',()=>{app.detail=b.dataset.record;renderDrawer()}));}
}
function renderCatalog(){const needle=$('#catalogSearch').value.trim().toLowerCase();const found=RELEASES.filter(r=>(r.title+' '+r.year+' '+r.type+' '+(ERAS.find(e=>e.id===r.era)?.short||'')).toLowerCase().includes(needle));$('#catalogCount').textContent=found.length+' RECORDS FOUND';$('#catalogGrid').innerHTML=found.map(r=>`<button class="catalog-item" data-record="${r.id}" title="Travel to ${escapeHTML(r.title)}">${coverCard(r)}<span class="cover-meta"><strong>${escapeHTML(r.title)}</strong><em>${r.year} ↗</em></span></button>`).join('')||'<p class="mono">NO MATCHING RELEASES. TRY A DIFFERENT SEARCH.</p>';$$('.catalog-item').forEach(el=>el.addEventListener('click',()=>{const r=RELEASES.find(x=>x.id===el.dataset.record);if(!r)return;closeCatalog();goTo(ERAS.findIndex(e=>e.id===r.era),{instant:true});openDrawer(r.id)}))}
function openCatalog() {stopPreview();closeDrawer();app.catalog=true;$('#catalog').hidden=false;renderCatalog();$('#catalogSearch').focus({preventScroll:true})}
function closeCatalog(){app.catalog=false;$('#catalog').hidden=true}
function openInfo(){stopPreview();closeDrawer();app.info=true;$('#info').hidden=false;$('#infoClose').focus({preventScroll:true})}
function closeInfo(){app.info=false;$('#info').hidden=true}

// A curated collection ID per release prevents false matches from lookalike album names.
// The browser only embeds preview-size artwork from the official catalog; nothing is uploaded here.
async function fetchJson(url,timeout=6500){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);return await response.json()}finally{clearTimeout(t)}}
function artworkLarge(url){return String(url).replace(/\d+x\d+bb(?=\.)/,'600x600bb').replace(/\d+x\d+(?=\.)/,'600x600')}
function addArtwork(r,url,link){if(!/^https:\/\//.test(url))return;const finalUrl=artworkLarge(url);app.coverUrls.set(r.id,finalUrl);if(link)app.imageTargets.set(r.id,{link});app.world?.addCover(r.id,finalUrl);if(app.drawer)renderDrawer();if(app.catalog)renderCatalog();updateFallbackArt()}
async function loadCovers(){if(app.loadingCovers)return;app.loadingCovers=true;
 // An independently verified Spotify cover is used for Son of Sam, which isn't in Apple's main catalog.
 for(const r of RELEASES)if(r.cover)addArtwork(r,r.cover,r.url);
 const missing=RELEASES.filter(r=>r.appleId&&!app.coverUrls.has(r.id));
 const ids=missing.map(r=>r.appleId);
 // Fetch album covers by exact IDs rather than searching title strings. Small batches help older browsers.
 for(let offset=0;offset<ids.length;offset+=9){try{
  const json=await fetchJson('https://itunes.apple.com/lookup?'+new URLSearchParams({id:ids.slice(offset,offset+9).join(','),country:'US',entity:'album',limit:'100'}),7500);
  for(const item of json.results||[]){const r=missing.find(x=>String(x.appleId)===String(item.collectionId));if(!r||!item.artworkUrl100)continue;if(!/lucki/i.test(String(item.artistName||'')))continue;addArtwork(r,item.artworkUrl600||item.artworkUrl100,r.url||item.collectionViewUrl)}
 }catch(err){console.warn('Catalog artwork batch unavailable; trying individual albums',err)}}
 // An album may not be returned by a batch if an Apple Music entry is newer than iTunes' index.
 const remaining=missing.filter(r=>!app.coverUrls.has(r.id));let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,remaining.length)},async()=>{while(cursor<remaining.length){const r=remaining[cursor++];try{
  const json=await fetchJson('https://itunes.apple.com/lookup?'+new URLSearchParams({id:String(r.appleId),country:'US'}),4500);
  const item=(json.results||[]).find(x=>String(x.collectionId)===String(r.appleId)&&x.artworkUrl100&&/lucki/i.test(String(x.artistName||'')));
  if(item)addArtwork(r,item.artworkUrl600||item.artworkUrl100,r.url||item.collectionViewUrl)
 }catch{}}}));
 updateFallbackArt();if(app.drawer)renderDrawer();if(app.catalog)renderCatalog();
 console.info(`Verified album artwork loaded: ${app.coverUrls.size}/${RELEASES.length}`);
}

function createLabelCanvas(text,subtitle,color='#d7e6d8',width=512,height=256){const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle='#090b0ccf';x.fillRect(0,0,width,height);x.strokeStyle=color;x.globalAlpha=.5;x.lineWidth=2;x.strokeRect(9,9,width-18,height-18);x.globalAlpha=1;x.fillStyle=color;x.font=`bold ${Math.round(width*.095)}px Impact, Arial Black, sans-serif`;let words=String(text).toUpperCase().split(' ');let lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(x.measureText(test).width>width-65&&line){lines.push(line);line=w}else line=test}lines.push(line);lines.slice(0,3).forEach((l,i)=>x.fillText(l,30,Math.max(90,126-(lines.length-1)*22)+i*57));x.font=`${Math.round(width*.027)}px monospace`;x.fillStyle='#d4dbcb';x.fillText(String(subtitle).slice(0,46).toUpperCase(),30,height-29);return c}

async function initWorld(){let THREE;try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')}catch(err){console.warn('3D engine unavailable; fallback gallery stays accessible.',err);return null}
 const host=$('#scene');let renderer;try{renderer=new THREE.WebGLRenderer({antialias:!touchScreen,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,touchScreen?1.4:1.8));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement)}catch(err){console.warn('WebGL initialization failed',err);return null}
 $('#sceneFallback').style.display='none';app.rendererOkay=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#050607');scene.fog=new THREE.FogExp2('#050607',.017);
 const camera=new THREE.PerspectiveCamera(touchScreen?68:52,innerWidth/innerHeight,.08,430);const G=39;const centerZ=i=>-i*G;
 const world=new THREE.Group();scene.add(world);const clock=new THREE.Clock();let active=0;let targetCameraZ=centerZ(0)+15.5;let motion=0, dragOffset=0,pointerX=0,pointerY=0,dragging=false,dragLastX=0;let wasClicked=false;let disposed=false;
 let interactive=[],animations=[],textureTargets=new Map(),textureLoader=new THREE.TextureLoader();textureLoader.setCrossOrigin('anonymous');const colors=ERAS.map(e=>new THREE.Color(e.accent));
 scene.add(new THREE.AmbientLight('#c4c7db',.42));
 const keyLight=new THREE.DirectionalLight('#d5e6ff',1.85);keyLight.position.set(2,10,10);scene.add(keyLight);
 const mat=(color,roughness=.5,metalness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const lineMat=(color,opacity=.34)=>new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
 function addBox(parent,size,pos,material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);parent.add(m);return m}
 function addPlane(parent,size,pos,color){const m=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));m.position.set(...pos);parent.add(m);return m}
 function frame(group,w,h,z=0){const c=0xc2cabc;const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w/2,-h/2,z),new THREE.Vector3(w/2,-h/2,z),new THREE.Vector3(w/2,h/2,z),new THREE.Vector3(-w/2,h/2,z),new THREE.Vector3(-w/2,-h/2,z)]);const l=new THREE.Line(geometry,lineMat(c,.58));group.add(l)}
 function worldText(group,txt,small,accent,pos,size=[3.5,1.75]){const t=new THREE.CanvasTexture(createLabelCanvas(txt,small,accent));t.colorSpace=THREE.SRGBColorSpace;const p=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthWrite:false}));p.position.set(...pos);group.add(p);return p}
 const cubeM=mat('#202428',.82,.14),groundM=new THREE.MeshStandardMaterial({color:'#0b0e10',roughness:.3,metalness:.5});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(42,G*ERAS.length+140),groundM);floor.rotation.x=-Math.PI/2;floor.position.set(0,-3,centerZ((ERAS.length-1)/2));scene.add(floor);
 const grid=new THREE.GridHelper(G*ERAS.length+90,105,'#394944','#1c2421');grid.position.set(0,-2.975,centerZ((ERAS.length-1)/2));const gmat=Array.isArray(grid.material)?grid.material[0]:grid.material;gmat.transparent=true;gmat.opacity=.22;scene.add(grid);
 const sideLines=[];for(const side of [-1,1]){for(let j=0;j<ERAS.length;j++){const stage=worldText;const beam=addBox(world,[.055,.055,G-.8],[side*9.7,-2.86,centerZ(j)],new THREE.MeshBasicMaterial({color:colors[j],transparent:true,opacity:.33}));sideLines.push(beam);}}
 const groups=[],worldLabelTargets=[],songRacks=new Map(),albumCoverTextures=new Map();
 let hoveredWorldSong=null,focusedWorldSong=null,worldSongHoverTimer=null;
 const worldRow={classList:{add(){},remove(){}}};
 const artifactPositions=[
  [5.45,7.55,-4.6],[9.8,5.7,-5.8],[5.1,1.5,-3.4],[10.8,2.25,-5.8],
  [7.9,8.3,-7.9],[7.65,.35,-5.15],[11.25,7.65,-8.8],[3.95,4.8,-6.4],
  [6.25,4.8,-8.5],[10.9,-.5,-7.1],[3.45,8.7,-9.5],[9.55,8.85,-12]
 ];
 function addParticles(group,col,num=80){const arr=new Float32Array(num*3);for(let i=0;i<num;i++){arr[i*3]=(Math.random()-.5)*22;arr[i*3+1]=Math.random()*15-3;arr[i*3+2]=(Math.random()-.5)*25;}const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(arr,3));const pts=new THREE.Points(geom,new THREE.PointsMaterial({color:col,size:touchScreen?.05:.064,transparent:true,opacity:.65,depthWrite:false,sizeAttenuation:true}));group.add(pts);animations.push({obj:pts,spin:.001,kind:'particle'})}
 function arch(group,z,col){const tmat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.38,depthWrite:false});addBox(group,[.09,11,.09],[-9,2,z],tmat);addBox(group,[.09,11,.09],[9,2,z],tmat);addBox(group,[18,.09,.09],[0,7.5,z],tmat)}
 function giveArtworkMesh(group,r,pos,size,i){const holder=new THREE.Group();holder.position.set(...pos);holder.rotation.y=[.12,-.17,.2][i%3];group.add(holder);const [w,h]=size;const artMat=new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide});let c=createLabelCanvas(r.title,`${r.year} / ARCHIVE RECORD — SELECT TO VIEW`,ERAS[active].accent,512,512);const placeholder=new THREE.CanvasTexture(c);placeholder.colorSpace=THREE.SRGBColorSpace;artMat.map=placeholder;const art=new THREE.Mesh(new THREE.PlaneGeometry(w,h),artMat);art.position.z=.14;art.userData={releaseId:r.id,eraIndex:active};holder.add(art);interactive.push(art);frame(holder,w+.18,h+.18,.1);
 addBox(holder,[w+.25,h+.25,.13],[0,0,-.025],mat('#151718',.7,.55));
 const caption=document.createElement('button');caption.type='button';caption.className='world-caption';caption.dataset.release=r.id;
 caption.innerHTML=`<strong>${escapeHTML(r.title)}</strong><span>${r.year} &nbsp; / &nbsp; INSPECT RECORD ↗</span>`;
 caption.addEventListener('click',()=>openDrawer(r.id));$('#worldLabels').appendChild(caption);
 worldLabelTargets.push({el:caption,holder,y:-h/2-.56,eraIndex:active});
 animations.push({obj:holder,kind:'art',x:pos[0],y:pos[1],offset:active*.6+i*2,baseRot:holder.rotation.y});
 textureTargets.set(r.id,art);
 const already=app.coverUrls.get(r.id);if(already)updateTexture(r.id,already);
 }
 // A collection of physical, fully three-dimensional artifacts instead of rectangular UI cards.
 // Their asymmetrical depth, rotation, and motion are unique to each numbered record.
 function artifactMaterial(color,metalness=.65,roughness=.26,opacity=1){return new THREE.MeshStandardMaterial({color,metalness,roughness,transparent:opacity<1,opacity,side:THREE.DoubleSide,emissive:new THREE.Color(color).multiplyScalar(.075),emissiveIntensity:.35})}
 function makeIndexDisc(num,accent){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#101419';ctx.fillRect(0,0,256,256);ctx.strokeStyle=accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(128,128,115,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e9f2dc';ctx.font='bold 100px Impact, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(num).padStart(2,'0'),128,126);ctx.font='15px monospace';ctx.fillStyle=accent;ctx.fillText('ARCHIVE AUDIO',128,204);return new THREE.CanvasTexture(c)}
 function createArtifact(stage,rack,track,index,j){
  const era=ERAS[index],accent=era.accent,color=new THREE.Color(accent),vault=index===ERAS.length-1;
  const pos=artifactPositions[j],angle=index*.29+j*1.91,scale=.78+((j*7+index)%5)*.105;
  const anchor=new THREE.Group();anchor.position.set(pos[0],pos[1],pos[2]);anchor.rotation.set(.09*Math.sin(angle),angle*.07,.15*Math.cos(angle));anchor.scale.setScalar(scale);rack.root.add(anchor);
  const model=new THREE.Group();anchor.add(model);
  const body=artifactMaterial('#222a2c',.8,.18);
  const accentMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false});
  const pale=new THREE.MeshBasicMaterial({color:'#e4e9e0',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});
  const type=vault?0:(j+index)%6;
  const ring=(radius,tube=.026,matl=accentMat)=>new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,52),matl);
  if(type===0){ // A physical vinyl disc, complete with colored center label and orbiting guide arcs.
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(.64,.64,.12,48),body);disc.rotation.x=Math.PI/2;model.add(disc);
   for(let k=0;k<4;k++){const groove=ring(.30+k*.09,.007,new THREE.MeshBasicMaterial({color:'#aeb8b5',transparent:true,opacity:.24,side:THREE.DoubleSide}));groove.position.z=.075;model.add(groove)}
   const label=new THREE.Mesh(new THREE.CircleGeometry(.195,44),accentMat);label.position.z=.081;model.add(label);
   const num=new THREE.Mesh(new THREE.CircleGeometry(.18,44),new THREE.MeshBasicMaterial({map:makeIndexDisc(track.number||j+1,accent),transparent:true,side:THREE.DoubleSide}));num.position.z=.086;model.add(num);
   const orbit=ring(.93,.015,pale);orbit.rotation.set(.55,0,.4);model.add(orbit);
  }else if(type===1){ // Suspended prismatic glass meteor.
   const prism=new THREE.Mesh(new THREE.IcosahedronGeometry(.64,0),artifactMaterial(color.clone().lerp(new THREE.Color('#d6efff'),.55),.38,.1,.76));model.add(prism);
   const wire=new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.85}));wire.scale.setScalar(1.075);model.add(wire);
   for(let k=0;k<3;k++){const chip=new THREE.Mesh(new THREE.TetrahedronGeometry(.17),accentMat);chip.position.set(Math.cos(k*2.09)*1.0,Math.sin(k*2.09)*.8,(k-1)*.22);chip.rotation.z=k*.95;model.add(chip)}
  }else if(type===2){ // A waveform materialized as metal bars and a luminous audio ribbon.
   const pts=[];for(let k=0;k<44;k++){const x=(k/43-.5)*1.65;pts.push(new THREE.Vector3(x,Math.sin(k*.48+index)*.22+Math.sin(k*.91)*.11,Math.sin(k*.33)*.14))}
   const curve=new THREE.CatmullRomCurve3(pts);model.add(new THREE.Mesh(new THREE.TubeGeometry(curve,90,.026,5,false),accentMat));
   for(let k=0;k<12;k++){const h=.15+Math.abs(Math.sin(k*2.25+index*.9))*.8;const bar=new THREE.Mesh(new THREE.BoxGeometry(.042,h,.065),k%3?pale:accentMat);bar.position.set((k-5.5)*.137,0,-.18);model.add(bar)}
   const arc=ring(.86,.016,accentMat);arc.scale.y=.73;arc.rotation.y=.25;model.add(arc);
  }else if(type===3){ // An exposed analog cassette fragment.
   const cassette=new THREE.Mesh(new THREE.BoxGeometry(1.55,.91,.19),artifactMaterial('#343838',.74,.39));model.add(cassette);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(cassette.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.84}));model.add(edges);
   for(const x of [-.43,.43]){const reel=ring(.25,.055,accentMat);reel.position.set(x,.04,.12);model.add(reel);const hole=new THREE.Mesh(new THREE.CircleGeometry(.09,24),body);hole.position.set(x,.04,.13);model.add(hole)}
   const window=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.18),new THREE.MeshBasicMaterial({color:'#c1ceca',transparent:true,opacity:.22}));window.position.set(0,-.32,.12);model.add(window);
  }else if(type===4){ // Fractured chrome constellation: rotating elliptical orbital paths.
   const node=new THREE.Mesh(new THREE.OctahedronGeometry(.42,1),artifactMaterial('#939f9f',.93,.12));model.add(node);
   for(let k=0;k<3;k++){const orbit=ring(.68+k*.14,.017,k===1?pale:accentMat);orbit.rotation.set(.28+k*.53,.66+k*.83,k*.24);model.add(orbit)}
   for(let k=0;k<4;k++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),accentMat);dot.position.set(Math.cos(k*1.6)*1.01,Math.sin(k*1.6)*.72,(k-1.5)*.24);model.add(dot)}
  }else{ // Glass photographic memory shards, suspended around a reflective core.
   const pane=new THREE.Mesh(new THREE.PlaneGeometry(.96,1.3),artifactMaterial(color.clone().lerp(new THREE.Color('#dce0dc'),.45),.27,.13,.65));pane.rotation.y=-.3;model.add(pane);
   const lines=new THREE.LineSegments(new THREE.EdgesGeometry(pane.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.87}));lines.rotation.y=-.3;model.add(lines);
   const shard=new THREE.Mesh(new THREE.TetrahedronGeometry(.45),artifactMaterial('#a9b2b1',.93,.2));shard.position.set(.35,.09,.43);model.add(shard);
   const halo=ring(.95,.013,accentMat);halo.rotation.x=.6;model.add(halo);
   const photo=new THREE.Mesh(new THREE.PlaneGeometry(.82,1.02),new THREE.MeshBasicMaterial({color:'#707f7b',side:THREE.DoubleSide,transparent:true,opacity:.82}));photo.position.set(0,0,.025);photo.rotation.y=-.3;model.add(photo);rack.photos.push(photo);
  }
  const size=type===2?1.3:1.14;
  const hit=new THREE.Mesh(new THREE.SphereGeometry(size,16,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));hit.userData={trackSong:track,releaseId:rack.releaseId,trackNumber:track.number||j+1,eraIndex:index,anchor,model,artifactType:type};anchor.add(hit);interactive.push(hit);rack.objects.push(hit);
  // A faint line from the record wall to each artifact makes the gallery feel like a constellation.
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(2.7,3.1,-1.7),new THREE.Vector3((pos[0]+2.7)/2, pos[1]+.85,pos[2]-1.7),new THREE.Vector3(pos[0],pos[1],pos[2]));
  const connection=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false}));rack.root.add(connection);
  rack.motions.push({obj:anchor,kind:'artifact',base:new THREE.Vector3(...pos),phase:angle,scale,model,hit,delay:Math.random()*6,velocity:.36+(j%5)*.075});
 }
 function disposeRack(rack){
  for(const hit of rack.objects){const at=interactive.indexOf(hit);if(at!==-1)interactive.splice(at,1)}
  for(const m of rack.motions){const at=animations.indexOf(m);if(at!==-1)animations.splice(at,1)}
  rack.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.dispose();m.dispose()}}});
  rack.root.clear();rack.objects=[];rack.motions=[];rack.photos=[];rack.loaded=false;
 }
 function makeSongRack(stage,index,release){const root=new THREE.Group();stage.add(root);songRacks.set(index,{root,releaseId:release.id,page:0,objects:[],motions:[],photos:[],loaded:false});}
 function drawSongRack(index){const rack=songRacks.get(index);if(!rack)return;
  if(hoveredWorldSong?.userData?.eraIndex===index)clearWorldSongHover();
  disposeRack(rack);
  const release=RELEASES.find(r=>r.id===rack.releaseId),rows=release?trackRows(release):[];
  const vault=index===ERAS.length-1,perPage=vault?12:8;
  const pages=Math.max(1,Math.ceil(rows.length/perPage));rack.page=Math.min(rack.page,pages-1);
  const shown=rows.slice(rack.page*perPage,(rack.page+1)*perPage);
  if(!shown.length){
   // A subtle scanning signal replaces the dead text block while track metadata is loading.
   const pulse=new THREE.Mesh(new THREE.TorusGeometry(1.1,.016,8,70),new THREE.MeshBasicMaterial({color:ERAS[index].accent,transparent:true,opacity:.26}));pulse.position.set(7.6,3.3,-5);pulse.rotation.x=.9;rack.root.add(pulse);
  }
  shown.forEach((track,j)=>createArtifact(rack.root,rack,track,index,j));
  const tex=albumCoverTextures.get(rack.releaseId);
  if(tex)for(const photo of rack.photos){const copy=tex.clone();copy.needsUpdate=true;photo.material.map=copy;photo.material.color.set('#ffffff');photo.material.needsUpdate=true}
  rack.loaded=true;updateWorldSongPager(rack,rows.length);
 }
 function updateWorldSongPager(rack,total){const el=$('#worldSongPager');if(!el)return;
  const vault=app.index===ERAS.length-1;
  el.hidden=!app.entered||!rack||!total;
  if(!rack||!total)return;
  const perPage=vault?12:8,pages=Math.ceil(total/perPage),from=rack.page*perPage+1,to=Math.min(total,(rack.page+1)*perPage);
  $('#worldSongCount').textContent=`${String(from).padStart(2,'0')}—${String(to).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  $('#worldSongPrev').disabled=rack.page===0;$('#worldSongNext').disabled=rack.page===pages-1;
  el.classList.toggle('single-page',pages===1);
 }
 function changeWorldSongPage(direction){const rack=songRacks.get(app.index);if(!rack)return;
  const release=RELEASES.find(r=>r.id===rack.releaseId),total=release?trackRows(release).length:0;
  const perPage=app.index===ERAS.length-1?12:8;
  const next=clamp(rack.page+direction,0,Math.max(0,Math.ceil(total/perPage)-1));
  if(next===rack.page)return;stopPreview();clearArtifactFocus();rack.page=next;drawSongRack(app.index);
 }
 function setTracks(releaseId,rows){const eraIndex=ERAS.findIndex(e=>e.id===RELEASES.find(r=>r.id===releaseId)?.era);
  if(eraIndex<0)return;const rack=songRacks.get(eraIndex);
  if(rack&&rack.releaseId===releaseId&&eraIndex===app.index&&app.entered)drawSongRack(eraIndex);
 }
 function clearArtifactFocus(){focusedWorldSong=null;const panel=$('#songFocus');if(panel)panel.hidden=true;if(previewPinned)stopPreview()}
 function focusArtifact(hit){if(focusedWorldSong===hit){clearArtifactFocus();return}
  focusedWorldSong=hit;const data=hit.userData,t=data.trackSong;
  $('#songFocusIndex').textContent=`ARCHIVE FRAGMENT / ${String(data.trackNumber).padStart(2,'0')}`;
  $('#songFocusTitle').textContent=t.name;
  $('#songFocusHint').textContent=t.previewUrl?'HOVER OR CLICK TO PREVIEW • OFFICIAL SAMPLE':'AUDIO PREVIEW UNAVAILABLE • OPEN RELEASE';
  $('#songFocus').hidden=false;
  $('#songFocusInspect').onclick=()=>{clearArtifactFocus();openDrawer(data.releaseId)};
 }
 function clearWorldSongHover(){clearTimeout(worldSongHoverTimer);worldSongHoverTimer=null;
  if(hoveredWorldSong){hoveredWorldSong=null}
  const tip=$('#artifactTooltip');if(tip)tip.hidden=true;
  if(!previewPinned&&(activePreviewTrack||playingRow===worldRow))stopPreview();
 }
 function showArtifactTooltip(mesh,e){const tip=$('#artifactTooltip'),t=mesh.userData.trackSong;
  $('#artifactTooltipIndex').textContent=`MEMORY ${String(mesh.userData.trackNumber).padStart(2,'0')}`;
  $('#artifactTooltipTitle').textContent=t.name;
  $('#artifactTooltipMeta').textContent=t.previewUrl?'◉ HOVER TO LISTEN · CLICK TO HOLD':'◌ PREVIEW UNAVAILABLE · CLICK TO INSPECT';
  tip.hidden=false;tip.style.left=Math.min(innerWidth-260,Math.max(14,e.clientX+20))+'px';
  tip.style.top=Math.min(innerHeight-152,Math.max(94,e.clientY-80))+'px';
 }
 function handleWorldSongHover(hit,e){const mesh=hit?.object?.userData?.trackSong?hit.object:null;
  if(mesh!==hoveredWorldSong){clearWorldSongHover();hoveredWorldSong=mesh;
   if(!previewPinned&&mesh?.userData.trackSong?.previewUrl){const track=mesh.userData.trackSong;
    worldSongHoverTimer=setTimeout(()=>{if(hoveredWorldSong===mesh&&app.entered&&!app.drawer&&!app.catalog&&!app.info)void startPreview(track,worldRow)},260);
   }
  }
  if(mesh&&e)showArtifactTooltip(mesh,e);
 }
 function stageEnvironment(group,i,color){const p=()=>Math.random();const accent=new THREE.Color(color);arch(group,4,color);arch(group,-7,color);
 // Each decade-chapter owns an identifiable physical installation, not a CSS color swap.
 for(let k=0;k<7;k++){let x=(k-3)*3.5;addBox(group,[.08,11,.1],[x,1.7,-9],new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.11}));}
 switch(ERAS[i].world){
 case 0: // Suspended analogue prints / scanning rails
  for(let j=0;j<12;j++){let x=(p()-.5)*15,y=p()*9-1,z=p()*-11;const sh=addPlane(group,[.55+p()*2,.9+p()*1.5],[x,y,z],'#b9cbd3');sh.rotation.set(p()*.3,p()*.6,p()*.5);animations.push({obj:sh,kind:'shard',offset:j})}break;
 case 1: // Cassette window / waveline
  for(let j=0;j<7;j++){const a=addBox(group,[2,.52,1],[Math.sin(j*1.8)*7,3+j*.48,-7+j*.55],mat('#5c6060',.35,.8));a.rotation.set(.3,j*.35,.3);animations.push({obj:a,kind:'slowspin',offset:j})}break;
 case 2: // Rain-drenched city skyline
  for(let j=0;j<24;j++){const h=2+p()*10;const b=addBox(group,[.7+p()*1.3,h,1.2+p()*2],[(p()-.5)*19,-3+h/2,-9-p()*5],mat('#18212a',.55,.25));for(let m=0;m<2;m++)addBox(group,[.1,.12,.01],[b.position.x+(p()-.5),-2+p()*Math.min(7,h-1),b.position.z+1],new THREE.MeshBasicMaterial({color:p()>.5?'#a64f5e':'#eaab7c',transparent:true,opacity:.62}));}break;
 case 3: // Collage: disruptive torn archive pieces
  for(let j=0;j<17;j++){const t=addPlane(group,[.7+p()*2.8,.4+p()*1.8],[(p()-.5)*17,(p()*10)-1,-6-p()*11],j%2?'#d8beb3':'#69392e');t.material.opacity=.26;t.rotation.set(.16*j,.28*j,p()*1.4);animations.push({obj:t,kind:'shard',offset:j*.4})}break;
 case 4: // A vanishing highway through blue space
  for(let j=0;j<15;j++){const zz=3-j*1.3;addBox(group,[.09,.02,.7],[-2.3,-2.88,zz],new THREE.MeshBasicMaterial({color:'#a6c6ef',transparent:true,opacity:.65}));addBox(group,[.09,.02,.7],[2.3,-2.88,zz],new THREE.MeshBasicMaterial({color:'#a6c6ef',transparent:true,opacity:.65}));}for(const x of [-8,8])for(let z=-14;z<7;z+=5){addBox(group,[.16,6,.16],[x,.2,z],mat('#283d50'));}break;
 case 5: // F1lthy / high-energy signal torii
  for(let j=0;j<5;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(3+j*.6,.07,8,80),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.47,side:THREE.DoubleSide}));ring.position.set(2.5,3,-8-j*1.1);ring.rotation.x=Math.PI*.18+j*.2;group.add(ring);animations.push({obj:ring,kind:'spin',offset:j})}break;
 case 6: // Chrome gallery pedestal
  for(let j=0;j<8;j++){const pedestal=addBox(group,[.8,1+j*.28,.8],[(j-3.5)*1.65,-2.1+j*.12,-5],mat('#a4aaa9',.13,1));pedestal.rotation.y=j*.22}for(let j=0;j<4;j++){const r=new THREE.Mesh(new THREE.TorusKnotGeometry(1.2,.11,92,8,2,3),mat('#bec5b9',.11,1));r.position.set((j-1.4)*5,2,-8-j*.5);r.scale.setScalar(.6+j*.1);group.add(r);animations.push({obj:r,kind:'spin',offset:j})}break;
 case 7: // Dim ultraviolet film projectors
  for(let j=0;j<10;j++){let b=addBox(group,[.14,2+p()*5,.35],[(p()-.5)*18,p()*5,-8-p()*8],mat('#57406a',.22,.6));b.rotation.set(.2,p()*1.2,p()*.2)}break;
 case 8: // Mirrored geometry and duality
  for(let side of [-1,1])for(let j=0;j<6;j++){const m=addBox(group,[.17,9-j*.8,1],[(side*(4+j)),0,-5-j*1.6],mat(j%2?'#65628a':'#bcc1cf',.17,.94));m.rotation.y=side*.24}break;
 case 9: // Green industrial archways / telemetric pipes
  for(let j=0;j<9;j++){const b=addBox(group,[.65,4+p()*7,.65],[(p()-.5)*18,p()*3,-8-p()*9],mat('#566b59',.28,.78));b.rotation.y=j*.2}break;
 case 10: // The actual vault, a halo of metallic concentric rings
  for(let j=0;j<9;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(3.5+j*.47,.1,8,96),new THREE.MeshBasicMaterial({color:j%2?'#8e352c':'#d1a48b',transparent:true,opacity:Math.max(.17,.62-j*.04),side:THREE.DoubleSide}));ring.position.set(2,2.5,-9-j*.36);group.add(ring);animations.push({obj:ring,kind:'vault',offset:j})}break;
 }
 const pl=new THREE.PointLight(color,i===ERAS.length-1?18:13,24,2);pl.position.set(3,5,-4);group.add(pl);
 const hiddenName=worldText(group,ERAS[i].short,`${ERAS[i].year}  //  ${ERAS[i].visual}`,color,[5.7,8,-8],[6.5,2.4]);hiddenName.rotation.y=-.2;
 addParticles(group,color,touchScreen?38:88);
 }
 for(let i=0;i<ERAS.length;i++){active=i;const stage=new THREE.Group();stage.position.z=centerZ(i);world.add(stage);groups.push(stage);const releases=eraReleaseList(i);stageEnvironment(stage,i,ERAS[i].accent);if(i===ERAS.length-1){giveArtworkMesh(stage,releases[0],[1.45,5.6,-4.4],[3.45,3.45],0)}else releases.slice(0,4).forEach((r,j)=>{const hasMany=releases.length>2;const x=[2.05,5.3,-1.25,7.8][j];const y=[3.15,4.8,5.2,1.45][j];const z=[1.1,-1.8,-4.2,-3.1][j];giveArtworkMesh(stage,r,[x,y,z],[hasMany?2.55:3.7,hasMany?2.55:3.7],j)});
 // Original short archival title on each stage floor
 worldText(stage,`${String(i+1).padStart(2,'0')} / ${ERAS[i].start}`,ERAS[i].tag,ERAS[i].accent,[-6,-1.0,-4],[3,1.3]).rotation.y=.19;
 }
 // Add individually selectable song artifacts to the active gallery space.
 for(let i=0;i<ERAS.length;i++){const release=eraReleaseList(i)[0];if(release)makeSongRack(groups[i],i,release)}
 active=0;
 function updateTexture(id,url){const m=textureTargets.get(id);if(!m)return;textureLoader.load(url,tex=>{if(disposed)return;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.material.map=tex;m.material.color.set('#ffffff');m.material.needsUpdate=true;albumCoverTextures.set(id,tex);const rack=songRacks.get(app.index);if(rack&&rack.releaseId===id){for(const photo of rack.photos){const copy=tex.clone();copy.needsUpdate=true;photo.material.map=copy;photo.material.color.set('#ffffff');photo.material.needsUpdate=true}}},undefined,()=>{console.info('3D artwork image unavailable for '+id)})}
 const onPointerMove=(e)=>{pointerX=(e.clientX/innerWidth-.5)*2;pointerY=(e.clientY/innerHeight-.5)*2;if(dragging){dragOffset=clamp(dragOffset+(e.clientX-dragLastX)*.011,-2.6,2.6);dragLastX=e.clientX;wasClicked=true;clearWorldSongHover()}if(app.entered&&!app.drawer&&!app.catalog&&!app.info&&!dragging){const hit=pick(e);handleWorldSongHover(hit,e);$('#hotspot').classList.toggle('show',Boolean(hit));$('#hotspot').style.left=e.clientX+'px';$('#hotspot').style.top=e.clientY+'px';const track=hit?.object.userData.trackSong;$('#hotspot').classList.toggle('show',Boolean(hit)&&!track);$('#hotspot').textContent=track?'':hit?'INSPECT ALBUM ARTWORK ↗':'';renderer.domElement.style.cursor=hit?'pointer':'grab';}else if(!app.entered)clearWorldSongHover();}
 const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
 function pick(e){const rect=renderer.domElement.getBoundingClientRect();ndc.set(((e.clientX-rect.left)/rect.width)*2-1,-(((e.clientY-rect.top)/rect.height)*2-1));raycaster.setFromCamera(ndc,camera);const hits=raycaster.intersectObjects(interactive,false);return hits.find(hit=>hit.object.userData.eraIndex===app.index)}
 const onPointerDown=e=>{if(e.button!==0)return;wasClicked=false;dragging=true;dragLastX=e.clientX};const onPointerUp=e=>{dragging=false;if(wasClicked||!app.entered||app.catalog||app.drawer||app.info)return;const hit=pick(e);if(!hit)return;const target=hit.object.userData;const song=target.trackSong;if(song){if(focusedWorldSong===hit.object){clearArtifactFocus();return}focusArtifact(hit.object);if(song.previewUrl){previewPinned=true;if(activePreviewTrack===song.previewUrl&&!previewAudio.paused)showPreviewStatus(song.name,'◉ PREVIEW PINNED · PRESS STOP TO END');else void startPreview(song,worldRow)}return}if(target.releaseId)openDrawer(target.releaseId);else if(target.trackIndex!==undefined)openDrawer('last-laugh')};
 renderer.domElement.addEventListener('pointermove',onPointerMove,{passive:true});renderer.domElement.addEventListener('pointerleave',clearWorldSongHover);renderer.domElement.addEventListener('pointerdown',onPointerDown);window.addEventListener('pointerup',onPointerUp);
 let frames=0,rafId=0;camera.position.set(0,2.6,targetCameraZ);camera.lookAt(1.8,2.3,centerZ(0)-3);
 function animate(){if(disposed)return;rafId=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);motion+=dt;const targetX=(pointerX*.55)+dragOffset;dragOffset*=.984;const vx=targetX+Math.sin(motion*.18)*.13;const destZ=targetCameraZ;groups.forEach((g,j)=>{g.visible=Math.abs(j-app.index)<=1});const eased=prefersReduced?.13:.035;camera.position.z+=(destZ-camera.position.z)*eased;camera.position.x+=(vx-camera.position.x)*.03;camera.position.y+=(2.75-pointerY*.35-camera.position.y)*.034;camera.lookAt(1.9+vx*.42,2.2-pointerY*.24,camera.position.z-14.5);
 if(!prefersReduced){for(const v of animations){const o=v.obj,s=motion+(v.offset||0);if(v.kind==='song'){o.position.y=v.y+Math.sin(s*.78)*.075}else if(v.kind==='art'){o.position.y=v.y+Math.sin(s*.48)*.16;o.rotation.y=v.baseRot+Math.sin(s*.29)*.08}else if(v.kind==='shard'){o.rotation.z+=dt*.042}else if(v.kind==='slowspin'){o.rotation.y+=dt*.07}else if(v.kind==='spin'){o.rotation.y+=dt*.14;o.rotation.z+=dt*.1}else if(v.kind==='particle'){o.rotation.y+=dt*.004}else if(v.kind==='vinyl'){o.rotation.z+=dt*.16;o.position.z=-2.75+Math.sin(s*.6)*.13}else if(v.kind==='vault'){o.rotation.z+=dt*.012}}}
  // Each artifact follows a different slow orbital drift. Hover locks it into a highlighted state.
  const rack=songRacks.get(app.index);
  if(rack)for(const v of rack.motions){
   const hover=hoveredWorldSong===v.hit||focusedWorldSong===v.hit;
   const s=motion*v.velocity+v.phase;
   v.obj.position.set(v.base.x+(prefersReduced?0:Math.sin(s)*.28),v.base.y+(prefersReduced?0:Math.cos(s*.85)*.32),v.base.z+(prefersReduced?0:Math.sin(s*.69)*.39));
   if(!prefersReduced){v.model.rotation.y+=dt*(hover?.6:.17);v.model.rotation.z+=dt*.042;}
   const targetScale=v.scale*(hover?1.18:1);const current=v.obj.scale.x+(targetScale-v.obj.scale.x)*.13;
   v.obj.scale.setScalar(current);
  }
 // CSS-backed album captions stay sharp even on high-DPI screens and at small 3D sizes.
  for(const l of worldLabelTargets){
   if(l.eraIndex!==app.index||!app.entered||app.drawer||app.catalog||app.info){l.el.hidden=true;continue}
   l.holder.updateWorldMatrix(true,false);
   const point=l.holder.localToWorld(l.offset?new THREE.Vector3(...l.offset):new THREE.Vector3(0,l.y,.2));
   point.project(camera);
   if(point.z>1||point.z< -1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1){l.el.hidden=true;continue}
   l.el.hidden=false;l.el.style.left=((point.x+1)*innerWidth/2)+'px';l.el.style.top=((-point.y+1)*innerHeight/2)+'px';
  }
 renderer.render(scene,camera);frames++}
 animate();
 const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.fov=touchScreen?68:52;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,touchScreen?1.4:1.8))};window.addEventListener('resize',resize,{passive:true});
 window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(rafId);renderer.dispose();for(const g of groups)g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(m.map)m.map.dispose();m.dispose()}}})},{once:true});
 return {setEra(i,instant){clearWorldSongHover();clearArtifactFocus();const prev=active;active=i;targetCameraZ=centerZ(i)+15.5;if(instant)camera.position.z=targetCameraZ;if(prev!==i){const old=songRacks.get(prev);if(old)disposeRack(old)}const rack=songRacks.get(i);if(rack&&!rack.loaded)drawSongRack(i);updateWorldSongPager(rack,rack?trackRows(RELEASES.find(r=>r.id===rack.releaseId)).length:0)},setTracks,changeSongPage:changeWorldSongPage,clearFocus:clearArtifactFocus,addCover:updateTexture};
}

function enter(){if(app.entered)return;app.entered=true;$('#preloader').hidden=true;$('#entry').classList.add('hidden-entry');setTimeout(()=>{$('#entry').hidden=true},850);$('#topbar').hidden=false;$('#experience').hidden=false;$('#yearRail').hidden=false;$('#nextButton').focus({preventScroll:true});warmEraSongs(app.index);if(app.world)app.world.setEra(app.index,true);}
function initControls(){$('#worldSongPrev').addEventListener('click',()=>app.world?.changeSongPage(-1));$('#worldSongNext').addEventListener('click',()=>app.world?.changeSongPage(1));$('#previewStop').addEventListener('click',stopPreview);$('#songFocusClose').addEventListener('click',()=>app.world?.clearFocus());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPreview()});createRail();updateEraUI();$('#enterButton').addEventListener('click',enter);$('#skipButton').addEventListener('click',enter);$('#brandButton').addEventListener('click',()=>goTo(0));$('#inspectButton').addEventListener('click',()=>openDrawer());$('#nextFromCopy').addEventListener('click',next);$('#prevButton').addEventListener('click',previous);$('#nextButton').addEventListener('click',next);$('#drawerClose').addEventListener('click',closeDrawer);$('#catalogButton').addEventListener('click',openCatalog);$('#catalogClose').addEventListener('click',closeCatalog);$('#catalogSearch').addEventListener('input',renderCatalog);$('#aboutButton').addEventListener('click',openInfo);$('#infoClose').addEventListener('click',closeInfo);
 let lastWheel=0,wheelAccum=0;window.addEventListener('wheel',e=>{if(!app.entered||app.drawer||app.catalog||app.info)return;e.preventDefault();const now=performance.now();if(now-lastWheel<800)return;wheelAccum+=e.deltaY;if(Math.abs(wheelAccum)<18)return;goTo(app.index+Math.sign(wheelAccum));lastWheel=now;wheelAccum=0},{passive:false});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(app.catalog)closeCatalog();else if(app.info)closeInfo();else if(app.drawer)closeDrawer();else app.world?.clearFocus();return}if(!app.entered||app.drawer||app.catalog||app.info||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();next()}else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();previous()}else if(e.key==='Home'){e.preventDefault();goTo(0)}else if(e.key==='End'){e.preventDefault();goTo(ERAS.length-1)}else if(e.key.toLowerCase()==='a')openCatalog()});
 let sx=0,sy=0;const touchMoveStart=e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY};window.addEventListener('touchstart',touchMoveStart,{passive:true});window.addEventListener('touchend',e=>{if(!app.entered||app.drawer||app.catalog||app.info)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>60||Math.abs(dy)>70){if(Math.abs(dx)>Math.abs(dy))goTo(app.index+(dx<0?1:-1));else goTo(app.index+(dy<0?1:-1))}},{passive:true});
 if(!touchScreen){window.addEventListener('pointermove',e=>{$('#cursor').style.left=e.clientX+'px';$('#cursor').style.top=e.clientY+'px'},{passive:true});document.addEventListener('pointerover',e=>{$('#cursor').classList.toggle('hover',Boolean(e.target.closest('button,a'))||e.target.tagName==='CANVAS')})}else $('#cursor').hidden=true;
}
async function init(){
  // Initialize navigation before optional network downloads or WebGL work.
  initControls();
  window.__luckiCoreReady=true;
  void loadCovers().catch(err=>console.warn('Artwork lookup failed; using archive labels.',err));
  const timeout=setTimeout(()=>{$('#preloader').hidden=true},2400);
  try {
    app.world=await initWorld();
     if(app.world){for(const release of eraReleaseList(app.index))if(albumTracks.has(release.id))app.world.setTracks(release.id,albumTracks.get(release.id));}
  } catch(err) {
    console.warn('3D startup failure; gallery mode remains available.',err);
    $('#sceneFallback').style.display='block';
  } finally {
    clearTimeout(timeout);
    $('#loadFill').style.width='100%';
    $('#loadText').textContent=app.world?'3D WORLDS READY':'GALLERY MODE READY';
    setTimeout(()=>{$('#preloader').hidden=true},250);
  }
}
init().catch(err=>{
  console.error('Archive startup error:',err);
  const loader=document.getElementById('preloader');
  if(loader)loader.hidden=true;
  const notice=document.getElementById('startupNotice');
  if(notice)notice.hidden=false;
});
