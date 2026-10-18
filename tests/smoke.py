import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
mock=(root/'tests'/'mockthree.mjs').read_text()
names=re.findall(r'export (?:class|const) (\w+)',mock)
mock=mock.replace('export class','class').replace('export const','const')+'\nwindow.__THREE={'+','.join(names)+'};\n'
data=re.sub(r'(?m)^export const ', 'const ', (root/'data.js').read_text())
app=(root/'app.js').read_text().replace("import {ERAS,RELEASES,TRACKS,SON_OF_SAM_TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';",'')
app=app.replace("await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')",'window.__THREE')
fetchmock='''
 window.Audio=class{constructor(){this.src='';this.paused=true;this.volume=1}addEventListener(){}pause(){this.paused=true}play(){this.paused=false;return Promise.resolve()}};
 window.fetch=async input=>{let u=new URL(String(input));let id=+(u.searchParams.get('id')||'0').split(',')[0];let tracks=u.searchParams.get('entity')==='song'&&id?Array.from({length:12},(_,i)=>({wrapperType:'track',kind:'song',trackName:'Official Mock Song '+(i+1),artistName:'Lucki',collectionId:id,trackNumber:i+1,trackTimeMillis:192000,previewUrl:'https://audio.example/'+i+'.m4a'})):[];return{ok:true,json:async()=>({results:tracks,resultCount:tracks.length})}};
 '''
script='() => {\n'+mock+'\n'+fetchmock+'\n'+data+'\n'+app+'\n}'
html=(root/'index.template.html').read_text();html=re.sub(r'<link[^>]+googleapis[^>]*>','',html);html=html.replace('<!-- INLINE_CSS -->','<style>'+(root/'style.css').read_text()+'</style>').replace('<!-- INLINE_JS -->','')
reports=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for profile in ('desktop','mobile','reduced'):
  viewport={'width':360,'height':740} if profile=='mobile' else {'width':1480,'height':900}
  pg=browser.new_page(viewport=viewport,reduced_motion='reduce' if profile=='reduced' else 'no-preference')
  errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.set_content(html,wait_until='domcontentloaded',timeout=10000)
  pg.evaluate(script)
  pg.wait_for_timeout(450)
  report={'profile':profile,'ready':pg.evaluate('window.__luckiCoreReady'),'canvas':pg.locator('#scene canvas').count(),'start_errors':list(errors)}
  pg.locator('#enterButton').click(timeout=10000)
  pg.wait_for_timeout(200)
  report['entered']=pg.evaluate("!document.querySelector('#experience').hidden")
  report['scene_stages']=pg.evaluate("document.querySelector('#scene canvas')!=null")
  toggle=pg.locator('#songIndexToggle');toggle.click(force=True)
  report['explorer_visible']=pg.evaluate("!document.querySelector('#songIndexPanel').hidden")
  report['focus_close']=pg.evaluate("document.activeElement?.id==='songIndexClose'")
  report['mock_tracks']=pg.locator('#songIndexList .accessible-track').count()
  pg.locator('#hoverPreviewOptIn').check(force=True)
  report['opted_in']=pg.evaluate("document.querySelector('#hoverPreviewOptIn').checked")
  # Focusing a song should highlight a 3D song, but should not start unsolicited audio
  pg.locator('#songIndexList .accessible-track').first.focus()
  report['focus_on_song']=pg.evaluate("document.activeElement?.classList.contains('accessible-track')")
  pg.locator('#songIndexClose').click(force=True)
  pg.locator('#inspectButton').click(force=True)
  report['dialog_enabled']=pg.evaluate("!document.querySelector('#drawer').inert")
  report['background_inert']=pg.evaluate("document.querySelector('#experience').inert")
  pg.keyboard.press('Tab');report['tab_in_drawer']=pg.evaluate("document.querySelector('#drawer').contains(document.activeElement)")
  pg.keyboard.press('Escape')
  report['dialog_closed']=pg.evaluate("document.querySelector('#drawer').inert")
  report['focus_restored']=pg.evaluate("document.activeElement?.id==='inspectButton'")
  pg.locator('#catalogButton').click(force=True)
  report['catalog_open']=pg.evaluate("!document.querySelector('#catalog').hidden")
  pg.keyboard.press('Escape')
  report['catalog_closed']=pg.evaluate("document.querySelector('#catalog').hidden")
  pg.locator('#nextButton').click(force=True)
  report['era_two']=pg.locator('#eraTitle').inner_text()
  pg.locator('.year-stop').last.click(force=True)
  report['last_era']=pg.locator('#eraTitle').inner_text()
  report['errors']=errors[:10]
  reports.append(report)
  pg.close()
 browser.close()
print(json.dumps(reports,indent=2))
assert all(x['ready'] and x['entered'] and x['explorer_visible'] and x['dialog_enabled'] and x['background_inert'] and x['tab_in_drawer'] and x['dialog_closed'] and x['catalog_closed'] and x['focus_restored'] and not x['errors'] for x in reports)
