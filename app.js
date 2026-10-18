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
 // Every era has its own sculptural visual language; song relics orbit the actual cover.
 const ERA_RELICS=[
  {kind:'flyer',word:'ECK$',sub:'CHICAGO / 2013',accent:'#becdb1'},
  {kind:'flame',word:'BODY HIGH',sub:'ARCHIVE / 2014',accent:'#ff8545'},
  {kind:'cross',word:'X',sub:'2015 / LOST PRESS',accent:'#d9c1a2'},
  {kind:'freewave',word:'FREEWAVE',sub:'FIRST WAVE / 2015',accent:'#dfd39b'},
  {kind:'ghost',word:'SON OF SAM',sub:'2016 / GHOST FILE',accent:'#c1e9d2'},
  {kind:'static',word:'FW // 02',sub:'2016 / DIGITAL TAPE',accent:'#8fa8ff'},
  {kind:'night',word:'WATCH MY BACK',sub:'2017 / AFTER DARK',accent:'#e99cbe'},
  {kind:'negative',word:'DAYS B4 II',sub:'2018 / CONTACT SHEET',accent:'#d6d2ce'},
  {kind:'redwave',word:'FREEWAVE 3',sub:'2019 / RED FREQUENCY',accent:'#fc665c'},
  {kind:'collage',word:'DAYS B4 III',sub:'2019 / ARCHIVE PRINT',accent:'#f29a6e'},
  {kind:'highway',word:'ALMOST THERE',sub:'2020 / NIGHT DRIVE',accent:'#9bc8f0'},
  {kind:'radio',word:'WAKE UP',sub:'F1LTHY / 2021',accent:'#e7bbc2'},
  {kind:'chrome',word:'FLAWLESS',sub:'2022 / CHROME',accent:'#e5edf0'},
  {kind:'purple',word:'SMD',sub:'2023 / PURPLE FILM',accent:'#f5b5e2'},
  {kind:'mirror',word:'GEMINI!',sub:'2024 / TWO SIDES',accent:'#bbb3ff'},
  {kind:'pink',word:'10',sub:'2026 / PINK ARCHIVE',accent:'#ff9bc6'},
  {kind:'vault',word:'LAST LAUGH',sub:'2013—2026 / ALL ERAS',accent:'#f4a18c'}
 ];
 const ORBIT_RATE=touchScreen?.27:.35;
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
 // Each record becomes a physical, era-specific relic. No filler polygons or lined-up cards.
 function relicMaterial(color,metal=.33,rough=.37,alpha=1){return new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,transparent:alpha<1,opacity:alpha,side:THREE.DoubleSide})}
 function relicInk(word,subtitle,kind,accent,j,dimension=512){
  const canvas=document.createElement('canvas');canvas.width=dimension;canvas.height=dimension;
  const c=canvas.getContext('2d');c.scale(dimension/512,dimension/512);const dark='#111012';
  const palette={flame:['#470d08','#fb541d'],static:['#13102b','#3758b4'],purple:['#251029','#a74087'],night:['#1a0c18','#773847'],pink:['#302222','#ae3761'],highway:['#0c1c32','#246392'],redwave:['#30080c','#b63338'],mirror:['#1a103e','#5d4b96'],vault:['#300b11','#843d2e']};
  const shades=palette[kind]||[dark,accent];const fill=c.createLinearGradient(0,0,512,512);fill.addColorStop(0,shades[0]);fill.addColorStop(1,shades[1]);c.fillStyle=fill;c.fillRect(0,0,512,512);
  // Original typographic artwork: aged print, radio-frequency stripes, gallery evidence marks.
  c.strokeStyle=accent;c.lineWidth=3;c.globalAlpha=.65;c.strokeRect(24,24,464,464);c.globalAlpha=1;
  if(kind==='flame'||kind==='redwave'||kind==='freewave'||kind==='static'||kind==='purple'){
   for(let k=0;k<10;k++){c.beginPath();c.strokeStyle=k%2?accent:'#ede5d9';c.globalAlpha=.08+(k%3)*.055;c.lineWidth=9-k*.55;for(let x=35;x<476;x+=11){const y=260+Math.sin(x*.023+k*.88+j)* (36+k*3)+Math.sin(x*.081+k)*15;x===35?c.moveTo(x,y):c.lineTo(x,y)}c.stroke()}c.globalAlpha=1;
  }else if(kind==='flyer'||kind==='negative'||kind==='collage'||kind==='night'||kind==='vault'){
   for(let k=0;k<8;k++){c.fillStyle=k%2?'#ebdfd4':accent;c.globalAlpha=.06+(k%3)*.04;c.fillRect(20+k*56,12,18,488)}c.globalAlpha=1;
  }else if(kind==='mirror'||kind==='chrome'){
   c.fillStyle='#ffffff';c.globalAlpha=.15;c.fillRect(251,26,10,462);c.fillRect(20,248,472,5);c.globalAlpha=1;
  }else if(kind==='highway'){for(let k=0;k<8;k++){c.fillStyle=accent;c.globalAlpha=.18;c.fillRect(238,40+k*65,36,35)}c.globalAlpha=1}
  else if(kind==='radio'){for(let k=0;k<12;k++){c.strokeStyle=accent;c.globalAlpha=.08+k*.025;c.beginPath();c.arc(260,252,22+k*19,0,Math.PI*2);c.stroke()}c.globalAlpha=1}
  c.fillStyle=kind==='pink'?'#ffd5e6':'#f5f0e9';c.textAlign='center';c.textBaseline='middle';
  let size=word.length>11?52:word.length>7?69:word.length>3?94:170;c.font=`900 ${size}px Impact, Arial Black, sans-serif`;
  const parts=word.length>12?word.split(' '):[word];
  if(parts.length>1){const half=Math.ceil(parts.length/2);c.fillText(parts.slice(0,half).join(' '),256,221,454);c.fillText(parts.slice(half).join(' '),256,305,454)}else c.fillText(word,256,258,448);
  c.font='20px monospace';c.fillStyle=accent;c.fillText(subtitle,256,431,440);
  c.font='16px monospace';c.fillText(String(j+1).padStart(2,'0')+' / RECOVERED',256,75);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
 }
 function createArtifact(stage,rack,track,index,j){
  const era=ERAS[index],profile=ERA_RELICS[index],kind=profile.kind,accent=profile.accent;
  const last=index===ERAS.length-1;
  const golden=2.39996323,phase=(j+.35)*golden+index*.23;
  const rx=last?5.7:5.1+(j%3)*.8,ry=last?3.6:2.75+(j%2)*.65;
  const centerX=1.5,centerY=4.1;const angle=phase;
  const initial=[centerX+Math.cos(angle)*rx,centerY+Math.sin(angle)*ry,-3+Math.sin(angle*1.43+j)*3.0];
  const scale=(touchScreen?.69:.86)+(j%4)*.115;
  const anchor=new THREE.Group();anchor.position.set(...initial);anchor.scale.setScalar(scale);rack.root.add(anchor);
  const model=new THREE.Group();anchor.add(model);
  const accentMat=new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
  const ink=new THREE.MeshBasicMaterial({color:'#f0e8dd',side:THREE.DoubleSide});
  const dark=relicMaterial('#151316',.45,.42);
  const ring=(radius,tube=.025,m=accentMat)=>new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,50),m);
  const slab=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const print=(w=1.32,h=1.22,depth=.08)=>{const card=slab(w+.11,h+.11,depth,relicMaterial('#171719',.25,.6));model.add(card);const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:relicInk(profile.word,profile.sub,kind,accent,j),side:THREE.DoubleSide}));plane.position.z=depth/2+.014;model.add(plane);return plane};
  const cover=(x=0,y=0,z=.14,w=.67,h=.67)=>{const photo=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:'#52545b',side:THREE.DoubleSide}));photo.position.set(x,y,z);model.add(photo);rack.photos.push(photo);return photo};
  const chrome=relicMaterial('#c2c5ca',.94,.12);
  if(kind==='flyer'){ // Lucki Eck$: Chicago underground photocopies and flyer fragments.
   model.add(slab(1.42,1.68,.08,relicMaterial('#a2a69b',.05,.95)));print(1.24,1.55);cover(.27,-.27,.13,.55,.54);
   const corner=slab(.42,.13,.06,chrome);corner.position.set(-.42,.82,.09);model.add(corner);
  }else if(kind==='flame'){ // Body High's vivid burnt-orange sleeve, reflected as suspended screenprints.
   print(1.53,1.44);cover(.06,-.17,.14,.82,.78);
   for(let k=0;k<3;k++){const swirl=ring(.7+k*.17,.035,k===1?ink:accentMat);swirl.scale.y=.62;swirl.rotation.z=.48+k*.34;model.add(swirl)}
  }else if(kind==='cross'){ // X: die-cut X emblems and physical archive labels.
   for(const z of [-1,1]){const bar=slab(.23,1.85,.15,z===1?chrome:dark);bar.rotation.z=z*.78;model.add(bar)}
   const medallion=slab(.5,.3,.18,relicMaterial(accent,.6,.25));medallion.position.z=.12;model.add(medallion);
  }else if(kind==='freewave'||kind==='redwave'||kind==='static'){ // The three Freewave lineages: ink ribbons, physical tapes and broadcast contours.
   const pts=[];for(let k=0;k<45;k++){const x=(k/44-.5)*2.15;pts.push(new THREE.Vector3(x,Math.sin(x*7+index+j)*.32,Math.cos(x*5+index)*.18))}
   model.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),88,.046,7,false),accentMat));
   const tape=slab(1.24,.68,.18,dark);tape.position.y=-.38;model.add(tape);
   for(const x of [-.34,.34]){const reel=ring(.19,.039,accentMat);reel.position.set(x,-.37,.12);model.add(reel)}
   const tag=new THREE.Mesh(new THREE.PlaneGeometry(.64,.37),new THREE.MeshBasicMaterial({map:relicInk(profile.word,profile.sub,kind,accent,j),side:THREE.DoubleSide}));tag.position.set(0,.45,.09);model.add(tag);
  }else if(kind==='ghost'){ // Son of Sam: a translucent silhouette and archival photo traces.
   const head=new THREE.Mesh(new THREE.SphereGeometry(.4,24,20),relicMaterial('#e2f5df',.1,.6,.56));head.position.y=.48;model.add(head);
   const body=new THREE.Mesh(new THREE.CylinderGeometry(.33,.75,1.2,30),relicMaterial('#e2f5df',.1,.6,.45));body.position.y=-.35;model.add(body);cover(0,-.22,.56,.58,.58);
  }else if(kind==='night'){ // Watch My Back: a glossy late-night contact print in a streetlight frame.
   print(1.48,1.34);cover(-.04,.0,.14,1.01,.92);
   const headlight=new THREE.Mesh(new THREE.SphereGeometry(.13,14,12),new THREE.MeshBasicMaterial({color:'#f8bb8e'}));headlight.position.set(.81,-.52,.2);model.add(headlight);
  }else if(kind==='negative'||kind==='collage'){ // Days B4: actual photographic film and distressed contact sheets.
   const film=slab(1.58,1.24,.1,relicMaterial('#242123',.36,.55));model.add(film);cover(0,0,.07,1.05,.94);
   for(const side of [-1,1])for(let k=0;k<4;k++){const perf=slab(.09,.13,.012,ink);perf.position.set(side*.7,-.41+k*.28,.08);model.add(perf)}
   if(kind==='collage'){const strip=slab(1.9,.2,.06,relicMaterial('#d9a17e',.1,.9));strip.rotation.z=-.27;strip.position.set(0,.6,.11);model.add(strip)}
  }else if(kind==='highway'){ // Almost There: blue road reflector / 2020 nighttime highway memory.
   const sign=slab(1.36,1.02,.17,relicMaterial('#163a60',.32,.43));model.add(sign);cover(0,-.21,.09,.9,.43);
   for(let k=0;k<3;k++){const dash=slab(.14,.32,.03,ink);dash.position.set(-.48+k*.48,.34,.14);model.add(dash)}
  }else if(kind==='radio'){ // WAKE UP LUCKI x F1lthy: a tuning dial and hardware knobs.
   const radio=slab(1.59,1.02,.34,relicMaterial('#382b32',.58,.3));model.add(radio);
   const dial=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.11,40),chrome);dial.rotation.x=Math.PI/2;dial.position.set(-.29,.05,.24);model.add(dial);
   for(const x of [.38,.64]){const knob=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.14,24),dark);knob.rotation.x=Math.PI/2;knob.position.set(x,.19,.25);model.add(knob)}
   const label=slab(.49,.1,.025,accentMat);label.position.set(.48,-.23,.24);model.add(label);
  }else if(kind==='chrome'){ // FLAWLESS LIKE ME: polished hanging medallions, linked like jewelry.
   const piece=new THREE.Mesh(new THREE.CylinderGeometry(.76,.76,.16,48),chrome);piece.rotation.x=Math.PI/2;model.add(piece);
   const crest=new THREE.Mesh(new THREE.CircleGeometry(.58,48),new THREE.MeshBasicMaterial({map:relicInk('FLM','2022 / SILVER',kind,accent,j),side:THREE.DoubleSide}));crest.position.z=.1;model.add(crest);
   const loop=ring(.27,.08,chrome);loop.position.y=.93;model.add(loop);
  }else if(kind==='purple'){ // SMD: purple fluid-glass and neon-pink 10 typography; no medication imagery.
   const droplet=new THREE.Mesh(new THREE.SphereGeometry(.62,28,24),relicMaterial('#863775',.63,.06,.82));droplet.scale.set(.82,1.32,.67);model.add(droplet);
   const tile=new THREE.Mesh(new THREE.PlaneGeometry(.89,.56),new THREE.MeshBasicMaterial({map:relicInk(j%2?'SMD':'10','2023 / PURPLE',kind,accent,j),side:THREE.DoubleSide}));tile.position.z=.46;model.add(tile);
   const halo=ring(.95,.023);halo.rotation.x=.77;model.add(halo);
  }else if(kind==='mirror'){ // GEMINI!: two polished panels form one shifting double image.
   for(const side of [-1,1]){const mirror=slab(.58,1.45,.12,side===1?chrome:relicMaterial('#5e5279',.81,.12));mirror.position.x=side*.36;mirror.rotation.y=side*.4;model.add(mirror)}
   const gem=new THREE.Mesh(new THREE.PlaneGeometry(.51,.74),new THREE.MeshBasicMaterial({map:relicInk('II','GEMINI / 2024',kind,accent,j),side:THREE.DoubleSide}));gem.position.z=.22;model.add(gem);
  }else if(kind==='pink'){ // 2026: pink 10s as archival typography, with green industrial artwork accents.
   const ticket=slab(1.48,1.12,.13,relicMaterial('#456154',.3,.55));model.add(ticket);
   const pinkTag=new THREE.Mesh(new THREE.PlaneGeometry(1.23,.97),new THREE.MeshBasicMaterial({map:relicInk('10','2026 / ARCHIVE',kind,accent,j),side:THREE.DoubleSide}));pinkTag.position.z=.081;model.add(pinkTag);
   const clip=slab(.37,.16,.09,chrome);clip.position.set(.41,.61,.1);model.add(clip);
  }else{ // Last Laugh: physical memory sleeves from earlier periods meet in the vault.
   const sleeve=slab(1.43,1.57,.12,relicMaterial('#342328',.47,.55));model.add(sleeve);cover(0,.06,.072,1.16,1.12);
   const seal=new THREE.Mesh(new THREE.CircleGeometry(.32,36),new THREE.MeshBasicMaterial({map:relicInk(String(2013+j),'ARCHIVE / LUCKI',kind,accent,j),side:THREE.DoubleSide}));seal.position.set(.43,-.58,.1);model.add(seal);
  }
  // Real hover target travels with the relic. Titles exist in the hover/focus UI, not as wall text.
  const hit=new THREE.Mesh(new THREE.SphereGeometry(1.13,16,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.userData={trackSong:track,releaseId:rack.releaseId,trackNumber:track.number||j+1,eraIndex:index,anchor,model,artifactType:kind};anchor.add(hit);interactive.push(hit);rack.objects.push(hit);
  const speed=ORBIT_RATE*(.7+(j%4)*.12)*(j%3===0?-1:1);
  rack.motions.push({obj:anchor,model,hit,scale,phase,rx,ry,cz:-3+Math.sin(j*2.27+index)*2.3,centerX,centerY,velocity:speed,hoverMix:0,kind:'orbit',j});
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
   // A small signal marks an archive still resolving its officially listed songs.
   const pulse=new THREE.Mesh(new THREE.TorusGeometry(1.1,.016,8,70),new THREE.MeshBasicMaterial({color:ERAS[index].accent,transparent:true,opacity:.26}));pulse.position.set(1.3,4.1,-4);pulse.rotation.x=.9;rack.root.add(pulse);
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
  $('#songFocusIndex').textContent=`${ERA_RELICS[app.index].word} / RELIC ${String(data.trackNumber).padStart(2,'0')}`;
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
  $('#artifactTooltipIndex').textContent=`${ERA_RELICS[app.index].word} · RELIC ${String(mesh.userData.trackNumber).padStart(2,'0')}`;
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
 function stageEnvironment(group,i,color){
  // Every era is an installation about that release, not generic floating geometry.
  const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.29,side:THREE.DoubleSide,depthWrite:false});
  const flat=new THREE.MeshStandardMaterial({color:'#232329',roughness:.51,metalness:.59});
  const glyph=(text,x,y,z,w=4,h=1.65)=>{const t=worldText(group,text,`${ERAS[i].start} / ${ERA_RELICS[i].sub}`,color,[x,y,z],[w,h]);t.rotation.y=-.09;return t};
  const bar=(w,h,d,x,y,z,m=glow)=>addBox(group,[w,h,d],[x,y,z],m);
  const circle=(radius,x,y,z)=>{const v=new THREE.Mesh(new THREE.TorusGeometry(radius,.048,8,72),glow);v.position.set(x,y,z);group.add(v);animations.push({obj:v,kind:'slowspin',offset:i});return v};
  switch(i){
   case 0: // Alternative Trap: Chicago's early underground photocopy walls.
    glyph('ECK$ // 2013',-4.4,7.55,-11,6.6,1.8);
    for(let k=0;k<7;k++){const print=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.7),new THREE.MeshBasicMaterial({map:relicInk('CHICAGO','LUCKI ECK$ / 2013','flyer',color,k,256),side:THREE.DoubleSide}));print.position.set(-8+k*2.2,2.1+(k%3)*1.3,-11.8-(k%2));print.rotation.z=(k%2?-.1:.13);group.add(print)}break;
   case 1: // Body High: molten reflections taken from the burning-orange cover palette.
    glyph('BODY HIGH',-4.5,7.7,-12,7,2.2);
    for(let k=0;k<6;k++){const r=circle(1.1+k*.42,1.1,3.2,-10-k*.39);r.scale.y=.55;r.rotation.z=k*.36}break;
   case 2: // X: several enormous die-cut X forms in a dark printing room.
    glyph('X / 2015',-3.8,7.7,-12,6,2.2);
    for(let k=0;k<3;k++)for(const dir of [-1,1]){const x=bar(.28,5-k*.6,.14,-3+k*3.2,2.2,-10-k,flat);x.rotation.z=dir*.79}break;
   case 3: // Freewave: overlapping physical tape spools and abstract wave ribbons.
    glyph('FREEWAVE',-4.6,7.6,-12,7.1,2.1);
    for(let k=0;k<5;k++){const r=circle(1.5+k*.35,-1+k*.75,3,-11.5-k*.6);r.scale.y=.4;r.rotation.x=.25}break;
   case 4: // Son of Sam: pale silhouettes in a quiet 2016 archive.
    glyph('SON OF SAM',-3.8,7.7,-12,6.7,2);
    for(let k=0;k<5;k++){const ghost=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,2.2,30),new THREE.MeshBasicMaterial({color:'#b4d6c4',transparent:true,opacity:.11,side:THREE.DoubleSide}));ghost.position.set(-6+k*3.2,1.6+(k%2)*.6,-11.5);group.add(ghost)}break;
   case 5: // Freewave 2: blue digital tapes and wave signal portals.
    glyph('FREEWAVE // 02',-4.7,7.6,-13,7.8,1.95);
    for(let k=0;k<5;k++){const deck=bar(2,.59,.28,-6+k*2.5,3.8+(k%2)*1.2,-11-(k%3),flat);deck.rotation.z=(k%2?-.14:.09);const r=circle(.25,deck.position.x,deck.position.y,-10.78-(k%3));r.scale.x=2}break;
   case 6: // Watch My Back: silhouetted city blocks and reflected streetlamps.
    glyph('WATCH MY BACK',-4.4,8,-13,7.5,1.95);
    for(let k=0;k<11;k++){const h=2+(k*3%7);const city=bar(.8,h,1,-8+k*1.7,-2+h/2,-13-(k%3),flat);if(k%3===0)bar(.12,.1,.03,city.position.x,1.3,-12.45-(k%3),glow)}break;
   case 7: // Days B4 II: archival black-and-white film contact sheets.
    glyph('DAYS B4 II',-4.9,7.8,-12,7.3,2);
    for(let k=0;k<6;k++){const film=new THREE.Mesh(new THREE.PlaneGeometry(1.48,1.8),new THREE.MeshBasicMaterial({map:relicInk('DAYS B4','2018 / CONTACT', 'negative',color,k,256),side:THREE.DoubleSide}));film.position.set(-7+k*2.5,3.1+(k%2),-13);group.add(film)}break;
   case 8: // Freewave 3: distinct 2019 red signal / analog broadcast.
    glyph('FREEWAVE 3',-4.4,7.8,-12,7,2);
    for(let k=0;k<6;k++){const ring=circle(1.3+k*.34,0,2.7,-13-k*.4);ring.rotation.y=.37;k%2?ring.scale.y=.62:ring.scale.x=.6}break;
   case 9: // Days B4 III: torn printed layers that reference its collage era.
    glyph('DAYS B4 III',-4.7,7.8,-12,7.4,2.1);
    for(let k=0;k<7;k++){const poster=new THREE.Mesh(new THREE.PlaneGeometry(1.4+(k%3)*.4,1.25+(k%2)*.7),new THREE.MeshBasicMaterial({map:relicInk('DAYS B4','RECORD 2019','collage',color,k,256),side:THREE.DoubleSide}));poster.position.set(-7.8+k*2.2,2.4+(k%3)*.65,-12.3-(k%2));poster.rotation.z=(k%2?-.17:.12);group.add(poster)}break;
   case 10: // Almost There: a blue night-drive vanishing point.
    glyph('ALMOST THERE',-4.5,7.9,-13,7.1,2);
    for(let k=0;k<13;k++){const z=6-k*1.6;bar(.11,.025,.68,-2.4,-2.8,z);bar(.11,.025,.68,2.4,-2.8,z);if(k%2===0)bar(.13,.04,.85,0,-2.79,z,glow)}break;
   case 11: // WAKE UP LUCKI: radio signal rings for the F1lthy collaboration.
    glyph('WAKE UP LUCKI',-4.4,7.8,-12,7.4,2);
    for(let k=0;k<5;k++){const r=circle(.7+k*.6,1,3,-12-k*.3);r.rotation.x=.45+k*.13}break;
   case 12: // FLAWLESS LIKE ME: reflective chrome emblems and editorial plinths.
    glyph('FLAWLESS LIKE ME',-4.9,7.75,-13,8.2,2);
    for(let k=0;k<6;k++){const chrome=new THREE.MeshStandardMaterial({color:'#b5b9b7',metalness:.96,roughness:.1});const p=bar(1.1,2.8+(k%3)*.7,.35,-7.4+k*2.55,.6+(k%2)*1.1,-13.5,chrome);p.rotation.y=k*.16}break;
   case 13: // SMD: purple fluid-like light, fashion prints and pink '10' typography.
    glyph('SMD / 2023',-4.2,7.8,-12,7,2);
    for(let k=0;k<5;k++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.8+k*.1,22,20),relicMaterial('#7e3b83',.45,.11,.43));drop.scale.set(.7,2.1,.6);drop.position.set(-6+k*3,2.8,-12-(k%2));group.add(drop)}break;
   case 14: // GEMINI!: symmetrical twin mirrors rather than decorative clutter.
    glyph('GEMINI! / II',-4.4,7.8,-12,7,2);
    for(let side of [-1,1])for(let k=0;k<4;k++){const v=bar(.22,4.8+k*.48,1.1,side*(3.2+k*1.6),.7,-11.5-k*.9,flat);v.rotation.y=side*.24}break;
   case 15: // Dr*gs R Bad: green/black print, pink 10 typography, no medication props.
    glyph('DR*GS R BAD',-4.6,7.75,-12,7.4,2);
    for(let k=0;k<6;k++){const token=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.15),new THREE.MeshBasicMaterial({map:relicInk('10','2026 / PINK ARCHIVE','pink','#ff9bc6',k,256),side:THREE.DoubleSide}));token.position.set(-7+k*2.7,3+(k%2)*1.1,-13);group.add(token)}break;
   case 16: // Last Laugh: a final vault of years, original tapes and converging records.
    glyph('LAST LAUGH',-4.4,7.9,-13,7.4,2.2);
    for(let k=0;k<10;k++){const slide=new THREE.Mesh(new THREE.PlaneGeometry(1.22,1.4),new THREE.MeshBasicMaterial({map:relicInk(String(2013+k),'RECOVERED / VAULT','vault',color,k,256),side:THREE.DoubleSide}));slide.position.set(-8.1+(k%5)*3.8,1.7+Math.floor(k/5)*3.6,-12.8);group.add(slide)}break;
  }
  const pl=new THREE.PointLight(color,9,27,2);pl.position.set(3,5,-5);group.add(pl);
  addParticles(group,color,touchScreen?14:25);
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
  // Actual continuously moving orbits across both sides and multiple depths of the album.
  // Hover gently pauses a relic so the preview stays easy to activate.
  const rack=songRacks.get(app.index);
  if(rack)for(const v of rack.motions){
   const held=hoveredWorldSong===v.hit||focusedWorldSong===v.hit;
   v.hoverMix+=(Number(held)-v.hoverMix)*Math.min(1,dt*6);
   const orbitTime=motion*v.velocity+v.phase;
   const pathX=v.centerX+Math.cos(orbitTime)*v.rx;
   const pathY=v.centerY+Math.sin(orbitTime*.88+v.j*.15)*v.ry;
   const pathZ=v.cz+Math.sin(orbitTime*1.21+v.j*.71)*2.45;
   if(!prefersReduced){
    const blend=held?.015:.13;
    v.obj.position.x+=(pathX-v.obj.position.x)*blend;
    v.obj.position.y+=(pathY-v.obj.position.y)*blend;
    v.obj.position.z+=(pathZ-v.obj.position.z)*blend;
    v.model.rotation.y+=dt*(.24+(v.j%3)*.06)*(1-v.hoverMix*.88);
    v.model.rotation.z+=dt*.12*(v.j%2?1:-1)*(1-v.hoverMix*.88);
   }
   const wanted=v.scale*(held?1.22:1);
   v.obj.scale.setScalar(v.obj.scale.x+(wanted-v.obj.scale.x)*.11);
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
