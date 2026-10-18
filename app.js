import {ERAS,RELEASES,TRACKS,SON_OF_SAM_TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchScreen = matchMedia('(pointer:coarse)').matches;
const app={index:0,entered:false,drawer:false,detail:null,catalog:false,info:false,world:null,transitioning:false,loadingCovers:false,coverUrls:new Map(),imageTargets:new Map(),rendererOkay:false,favorites:new Set(),mode:'idle'};
const albumTracks=new Map(), trackRequests=new Map();
const previewAudio=new Audio();previewAudio.preload='none';previewAudio.volume=.72;
let previewSequence=0, playingRow=null, activePreviewTrack=null;
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
function stopPreview(){previewSequence++;previewAudio.pause();playingRow=null;activePreviewTrack=null;document.querySelectorAll('.song-row.is-playing').forEach(el=>el.classList.remove('is-playing'));const hud=$('#previewHud');if(hud)hud.hidden=true}
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
  row.classList.add('is-playing');showPreviewStatus(track.name,'◉ PLAYING SHORT PREVIEW · HOVER OFF TO STOP');
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
 const groups=[],worldLabelTargets=[],songRacks=new Map(),vinylTracks=[],vinylLabels=[];
 let hoveredWorldSong=null,worldSongHoverTimer=null;
 const worldRow={classList:{add(){},remove(){}}};
 function addParticles(group,col,num=80){const arr=new Float32Array(num*3);for(let i=0;i<num;i++){arr[i*3]=(Math.random()-.5)*22;arr[i*3+1]=Math.random()*15-3;arr[i*3+2]=(Math.random()-.5)*25;}const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(arr,3));const pts=new THREE.Points(geom,new THREE.PointsMaterial({color:col,size:touchScreen?.05:.064,transparent:true,opacity:.65,depthWrite:false,sizeAttenuation:true}));group.add(pts);animations.push({obj:pts,spin:.001,kind:'particle'})}
 function arch(group,z,col){const tmat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.38,depthWrite:false});addBox(group,[.09,11,.09],[-9,2,z],tmat);addBox(group,[.09,11,.09],[9,2,z],tmat);addBox(group,[18,.09,.09],[0,7.5,z],tmat)}
 function giveArtworkMesh(group,r,pos,size,i){const holder=new THREE.Group();holder.position.set(...pos);holder.rotation.y=[.12,-.17,.2][i%3];group.add(holder);const [w,h]=size;const artMat=new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide});let c=createLabelCanvas(r.title,`${r.year} / ARCHIVE RECORD — SELECT TO VIEW`,ERAS[active].accent,512,512);const placeholder=new THREE.CanvasTexture(c);placeholder.colorSpace=THREE.SRGBColorSpace;artMat.map=placeholder;const art=new THREE.Mesh(new THREE.PlaneGeometry(w,h),artMat);art.position.z=.14;art.userData={releaseId:r.id,eraIndex:active};holder.add(art);interactive.push(art);frame(holder,w+.18,h+.18,.1);
 addBox(holder,[w+.25,h+.25,.13],[0,0,-.025],mat('#151718',.7,.55));
 const caption=document.createElement('button');caption.type='button';caption.className='world-caption';caption.dataset.release=r.id;
 caption.innerHTML=`<strong>${escapeHTML(r.title)}</strong><span>${r.year} &nbsp; / &nbsp; INSPECT RECORD ↗</span>`;
 caption.addEventListener('click',()=>openDrawer(r.id));$('#worldLabels').appendChild(caption);
 worldLabelTargets.push({el:caption,holder,y:-h/2-.56,eraIndex:active});
 // The art is actually a 3D plane in the gallery. It can rotate, light-react, and be clicked.
 animations.push({obj:holder,kind:'art',x:pos[0],y:pos[1],offset:active*.6+i*2,baseRot:holder.rotation.y});
 textureTargets.set(r.id,art);
 const already=app.coverUrls.get(r.id);if(already)updateTexture(r.id,already);
 }
 // These are real THREE.Mesh panels living inside each gallery, not track buttons in a side drawer.
 // High-resolution HTML captions are projected on top to stay readable at different display sizes.
 function makeSongRack(stage,index,release){
  const root=new THREE.Group();stage.add(root);
  songRacks.set(index,{root,releaseId:release.id,page:0,objects:[],captions:[],motions:[]});
  drawSongRack(index);
 }
 function drawSongRack(index){
  const rack=songRacks.get(index);if(!rack)return;
  if(hoveredWorldSong?.userData?.eraIndex===index)clearWorldSongHover();
  for(const o of rack.objects){const at=interactive.indexOf(o);if(at!==-1)interactive.splice(at,1)}
  for(const v of rack.motions){const at=animations.indexOf(v);if(at!==-1)animations.splice(at,1)}
  for(const l of rack.captions){const at=worldLabelTargets.indexOf(l);if(at!==-1)worldLabelTargets.splice(at,1);l.el.remove()}
  rack.objects=[];rack.motions=[];rack.captions=[];
  rack.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});
  rack.root.clear();
  const release=RELEASES.find(r=>r.id===rack.releaseId),rows=release?trackRows(release):[];
  const pages=Math.max(1,Math.ceil(rows.length/8));rack.page=Math.min(rack.page,pages-1);
  const shown=rows.slice(rack.page*8,rack.page*8+8);
  if(!shown.length){
   const placeholder=worldText(rack.root,'TRACKS / INCOMING',albumTracks.has(rack.releaseId)?'OPEN THE RECORD FOR MORE':'RETRIEVING SONG INDEX…',ERAS[index].accent,[7.8,3.0,-4],[5,1.35]);placeholder.rotation.y=-.1;
  }
  for(let j=0;j<shown.length;j++){
   const track=shown[j],globalIndex=rack.page*8+j;
   const col=j%2,row=Math.floor(j/2), x=6.5+col*3.75, y=6.05-row*1.7,z=-2.0-col*.9-row*.3;
   const anchor=new THREE.Group();anchor.position.set(x,y,z);anchor.rotation.y=-.08+col*.09;rack.root.add(anchor);
   const material=new THREE.MeshStandardMaterial({color:'#12191a',metalness:.68,roughness:.29,emissive:new THREE.Color(ERAS[index].accent),emissiveIntensity:.065,side:THREE.DoubleSide});
   const hit=new THREE.Mesh(new THREE.BoxGeometry(3.3,.93,.12),material);anchor.add(hit);
   hit.userData={trackSong:track,releaseId:release.id,trackNumber:globalIndex,eraIndex:index};
   rack.objects.push(hit);interactive.push(hit);
   const border=new THREE.LineSegments(new THREE.EdgesGeometry(hit.geometry),new THREE.LineBasicMaterial({color:ERAS[index].accent,transparent:true,opacity:.38}));anchor.add(border);
   addBox(anchor,[.055,.7,.15],[-1.55,0,.11],new THREE.MeshBasicMaterial({color:ERAS[index].accent}));
   const pin=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),new THREE.MeshBasicMaterial({color:track.previewUrl?ERAS[index].accent:'#626962'}));pin.position.set(1.45,.31,.12);anchor.add(pin);
   const label=document.createElement('div');label.className='world-song-label';
   label.innerHTML=`<span class="world-song-index">${String(globalIndex+1).padStart(2,'0')}</span><span class="world-song-main"><strong>${escapeHTML(track.name)}</strong><small>${track.previewUrl?'◉ HOVER TO HEAR':'NO AUDIO PREVIEW'}</small></span>`;
   label.setAttribute('aria-hidden','true');$('#worldLabels').appendChild(label);
   const t={el:label,holder:anchor,offset:[0,0,.17],eraIndex:index,rack,kind:'song'};
   rack.captions.push(t);worldLabelTargets.push(t);
   const motion={obj:anchor,kind:'song',y,offset:index*.71+j*.45};rack.motions.push(motion);animations.push(motion);
  }
  if(index===app.index)updateWorldSongPager(rack,rows.length);
 }
 function updateWorldSongPager(rack,total){const el=$('#worldSongPager');if(!el)return;
  el.hidden=!app.entered||!rack||!total||app.index===ERAS.length-1;
  if(!rack||!total)return;
  const page=rack.page,count=Math.ceil(total/8),from=page*8+1,to=Math.min(total,(page+1)*8);
  $('#worldSongCount').textContent=`${String(from).padStart(2,'0')}—${String(to).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  $('#worldSongPrev').disabled=page===0;$('#worldSongNext').disabled=page===count-1;
 }
 function changeWorldSongPage(direction){const rack=songRacks.get(app.index);if(!rack)return;
  const release=RELEASES.find(r=>r.id===rack.releaseId),total=release?trackRows(release).length:0;
  const next=clamp(rack.page+direction,0,Math.max(0,Math.ceil(total/8)-1));
  if(next===rack.page)return;stopPreview();rack.page=next;drawSongRack(app.index);
 }
 function setTracks(releaseId,rows){const eraIndex=ERAS.findIndex(e=>e.id===RELEASES.find(r=>r.id===releaseId)?.era);
  if(eraIndex<0)return;
  if(eraIndex===ERAS.length-1){vinylTracks.forEach((mesh,i)=>mesh.userData.trackSong=rows[i]||null);
   vinylLabels.forEach((label,i)=>{const t=rows[i];if(label&&t){const strong=label.querySelector('strong'),small=label.querySelector('small');if(strong)strong.textContent=t.name;if(small)small.textContent=t.previewUrl?'HOVER / CLICK TO LISTEN':'PREVIEW NOT AVAILABLE'}});return}
  const rack=songRacks.get(eraIndex);if(rack&&rack.releaseId===releaseId)drawSongRack(eraIndex);
 }
 function clearWorldSongHover(){clearTimeout(worldSongHoverTimer);worldSongHoverTimer=null;
  if(hoveredWorldSong){hoveredWorldSong.material.emissiveIntensity=.065;hoveredWorldSong.scale.setScalar(1);hoveredWorldSong=null}
  if(activePreviewTrack||playingRow===worldRow)stopPreview();
 }
 function handleWorldSongHover(hit){const mesh=hit?.object?.userData?.trackSong?hit.object:null;
  if(mesh===hoveredWorldSong)return;
  clearWorldSongHover();hoveredWorldSong=mesh;
  if(!mesh)return;
  mesh.material.emissiveIntensity=.5;mesh.scale.setScalar(1.035);
  const track=mesh.userData.trackSong;
  if(!track?.previewUrl)return;
  worldSongHoverTimer=setTimeout(()=>{if(hoveredWorldSong===mesh&&app.entered&&!app.drawer&&!app.catalog&&!app.info)void startPreview(track,worldRow)},220);
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
 function addVinylRecords(group){for(let t=0;t<TRACKS.length;t++){const x=(t%4-1.5)*2.9;const y=5.4-Math.floor(t/4)*2.8;const holder=new THREE.Group();holder.position.set(x+1.7,y,-2.75);group.add(holder);const dark=new THREE.Mesh(new THREE.CircleGeometry(1.02,48),new THREE.MeshStandardMaterial({color:'#111215',metalness:.63,roughness:.26,side:THREE.DoubleSide}));dark.userData={trackIndex:t,eraIndex:ERAS.length-1,trackSong:fallbackTracks(RELEASES.find(r=>r.id==='last-laugh'))[t]||null};holder.add(dark);interactive.push(dark);vinylTracks.push(dark);
 const songCaption=document.createElement('div');songCaption.className='world-song-label world-vinyl-label';songCaption.setAttribute('aria-hidden','true');
 songCaption.innerHTML=`<span class="world-song-index">${String(t+1).padStart(2,'0')}</span><span class="world-song-main"><strong>${escapeHTML(TRACKS[t].name)}</strong><small>HOVER / CLICK TO LISTEN</small></span>`;
 $('#worldLabels').appendChild(songCaption);vinylLabels.push(songCaption);worldLabelTargets.push({el:songCaption,holder,offset:[0,-1.24,.2],eraIndex:ERAS.length-1,kind:'vinyl'});
 for(let j=0;j<4;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(.56+j*.10,.567+j*.10,72),new THREE.MeshBasicMaterial({color:'#6a6b72',side:THREE.DoubleSide,transparent:true,opacity:.58}));ring.position.z=.016+j*.003;holder.add(ring)}const art=new THREE.Mesh(new THREE.CircleGeometry(.35,48),new THREE.MeshBasicMaterial({color:colors[ERAS.length-1],side:THREE.DoubleSide}));art.position.z=.035;holder.add(art);const labelTex=new THREE.CanvasTexture(createLabelCanvas(String(t+1).padStart(2,'0'),TRACKS[t].name,colors[ERAS.length-1].getStyle(),300,300));const label=new THREE.Mesh(new THREE.CircleGeometry(.34,48),new THREE.MeshBasicMaterial({map:labelTex,side:THREE.DoubleSide}));label.position.z=.04;holder.add(label);animations.push({obj:holder,kind:'vinyl',offset:t})}}
 for(let i=0;i<ERAS.length;i++){active=i;const stage=new THREE.Group();stage.position.z=centerZ(i);world.add(stage);groups.push(stage);const releases=eraReleaseList(i);stageEnvironment(stage,i,ERAS[i].accent);if(i===ERAS.length-1){giveArtworkMesh(stage,releases[0],[1.45,5.6,-4.4],[3.45,3.45],0);addVinylRecords(stage)}else releases.slice(0,4).forEach((r,j)=>{const hasMany=releases.length>2;const x=[2.05,5.3,-1.25,7.8][j];const y=[3.15,4.8,5.2,1.45][j];const z=[1.1,-1.8,-4.2,-3.1][j];giveArtworkMesh(stage,r,[x,y,z],[hasMany?2.55:3.7,hasMany?2.55:3.7],j)});
 // Original short archival title on each stage floor
 worldText(stage,`${String(i+1).padStart(2,'0')} / ${ERAS[i].start}`,ERAS[i].tag,ERAS[i].accent,[-6,-1.0,-4],[3,1.3]).rotation.y=.19;
 }
 // Add individually selectable song artifacts to the active gallery space.
 for(let i=0;i<ERAS.length-1;i++){const release=eraReleaseList(i)[0];if(release)makeSongRack(groups[i],i,release)}
 active=0;
 function updateTexture(id,url){const m=textureTargets.get(id);if(!m)return;textureLoader.load(url,tex=>{if(disposed)return;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.material.map=tex;m.material.color.set('#ffffff');m.material.needsUpdate=true},undefined,()=>{console.info('3D artwork image unavailable for '+id)})}
 const onPointerMove=(e)=>{pointerX=(e.clientX/innerWidth-.5)*2;pointerY=(e.clientY/innerHeight-.5)*2;if(dragging){dragOffset=clamp(dragOffset+(e.clientX-dragLastX)*.011,-2.6,2.6);dragLastX=e.clientX;wasClicked=true;clearWorldSongHover()}if(app.entered&&!app.drawer&&!app.catalog&&!app.info&&!dragging){const hit=pick(e);handleWorldSongHover(hit);$('#hotspot').classList.toggle('show',Boolean(hit));$('#hotspot').style.left=e.clientX+'px';$('#hotspot').style.top=e.clientY+'px';const track=hit?.object.userData.trackSong;$('#hotspot').textContent=track?(track.previewUrl?'HOVER TO LISTEN · CLICK TO PLAY ↗':'PREVIEW UNAVAILABLE · VIEW RECORD ↗'):hit?'INSPECT ALBUM ARTWORK ↗':'';renderer.domElement.style.cursor=hit?'pointer':'grab';}else if(!app.entered)clearWorldSongHover();}
 const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
 function pick(e){const rect=renderer.domElement.getBoundingClientRect();ndc.set(((e.clientX-rect.left)/rect.width)*2-1,-(((e.clientY-rect.top)/rect.height)*2-1));raycaster.setFromCamera(ndc,camera);const hits=raycaster.intersectObjects(interactive,false);return hits.find(hit=>hit.object.userData.eraIndex===app.index)}
 const onPointerDown=e=>{if(e.button!==0)return;wasClicked=false;dragging=true;dragLastX=e.clientX};const onPointerUp=e=>{dragging=false;if(wasClicked||!app.entered||app.catalog||app.drawer||app.info)return;const hit=pick(e);if(!hit)return;const target=hit.object.userData;const song=target.trackSong;if(song){if(song.previewUrl){if(activePreviewTrack===song.previewUrl&&!previewAudio.paused)stopPreview();else void startPreview(song,worldRow)}else if(target.releaseId)openDrawer(target.releaseId);else openDrawer('last-laugh');return}if(target.releaseId)openDrawer(target.releaseId);else if(target.trackIndex!==undefined)openDrawer('last-laugh')};
 renderer.domElement.addEventListener('pointermove',onPointerMove,{passive:true});renderer.domElement.addEventListener('pointerleave',clearWorldSongHover);renderer.domElement.addEventListener('pointerdown',onPointerDown);window.addEventListener('pointerup',onPointerUp);
 let frames=0,rafId=0;camera.position.set(0,2.6,targetCameraZ);camera.lookAt(1.8,2.3,centerZ(0)-3);
 function animate(){if(disposed)return;rafId=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);motion+=dt;const targetX=(pointerX*.55)+dragOffset;dragOffset*=.984;const vx=targetX+Math.sin(motion*.18)*.13;const destZ=targetCameraZ;groups.forEach((g,j)=>{g.visible=Math.abs(j-app.index)<=1});const eased=prefersReduced?.13:.035;camera.position.z+=(destZ-camera.position.z)*eased;camera.position.x+=(vx-camera.position.x)*.03;camera.position.y+=(2.75-pointerY*.35-camera.position.y)*.034;camera.lookAt(1.9+vx*.42,2.2-pointerY*.24,camera.position.z-14.5);
 if(!prefersReduced){for(const v of animations){const o=v.obj,s=motion+v.offset;if(v.kind==='song'){o.position.y=v.y+Math.sin(s*.78)*.075}else if(v.kind==='art'){o.position.y=v.y+Math.sin(s*.48)*.16;o.rotation.y=v.baseRot+Math.sin(s*.29)*.08}else if(v.kind==='shard'){o.rotation.z+=dt*.042}else if(v.kind==='slowspin'){o.rotation.y+=dt*.07}else if(v.kind==='spin'){o.rotation.y+=dt*.14;o.rotation.z+=dt*.1}else if(v.kind==='particle'){o.rotation.y+=dt*.004}else if(v.kind==='vinyl'){o.rotation.z+=dt*.16;o.position.z=-2.75+Math.sin(s*.6)*.13}else if(v.kind==='vault'){o.rotation.z+=dt*.012}}}
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
 return {setEra(i,instant){clearWorldSongHover();active=i;targetCameraZ=centerZ(i)+15.5;if(instant)camera.position.z=targetCameraZ;const rack=songRacks.get(i);updateWorldSongPager(rack,rack?trackRows(RELEASES.find(r=>r.id===rack.releaseId)).length:0)},setTracks,changeSongPage:changeWorldSongPage,addCover:updateTexture};
}

function enter(){if(app.entered)return;app.entered=true;$('#preloader').hidden=true;$('#entry').classList.add('hidden-entry');setTimeout(()=>{$('#entry').hidden=true},850);$('#topbar').hidden=false;$('#experience').hidden=false;$('#yearRail').hidden=false;$('#nextButton').focus({preventScroll:true});warmEraSongs(app.index);if(app.world)app.world.setEra(app.index,true);}
function initControls(){$('#worldSongPrev').addEventListener('click',()=>app.world?.changeSongPage(-1));$('#worldSongNext').addEventListener('click',()=>app.world?.changeSongPage(1));$('#previewStop').addEventListener('click',stopPreview);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPreview()});createRail();updateEraUI();$('#enterButton').addEventListener('click',enter);$('#skipButton').addEventListener('click',enter);$('#brandButton').addEventListener('click',()=>goTo(0));$('#inspectButton').addEventListener('click',()=>openDrawer());$('#nextFromCopy').addEventListener('click',next);$('#prevButton').addEventListener('click',previous);$('#nextButton').addEventListener('click',next);$('#drawerClose').addEventListener('click',closeDrawer);$('#catalogButton').addEventListener('click',openCatalog);$('#catalogClose').addEventListener('click',closeCatalog);$('#catalogSearch').addEventListener('input',renderCatalog);$('#aboutButton').addEventListener('click',openInfo);$('#infoClose').addEventListener('click',closeInfo);
 let lastWheel=0,wheelAccum=0;window.addEventListener('wheel',e=>{if(!app.entered||app.drawer||app.catalog||app.info)return;e.preventDefault();const now=performance.now();if(now-lastWheel<800)return;wheelAccum+=e.deltaY;if(Math.abs(wheelAccum)<18)return;goTo(app.index+Math.sign(wheelAccum));lastWheel=now;wheelAccum=0},{passive:false});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(app.catalog)closeCatalog();else if(app.info)closeInfo();else if(app.drawer)closeDrawer();return}if(!app.entered||app.drawer||app.catalog||app.info||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();next()}else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();previous()}else if(e.key==='Home'){e.preventDefault();goTo(0)}else if(e.key==='End'){e.preventDefault();goTo(ERAS.length-1)}else if(e.key.toLowerCase()==='a')openCatalog()});
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