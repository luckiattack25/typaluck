from pathlib import Path
import re
root=Path(__file__).parent
html=(root/'index.template.html').read_text()
css=(root/'style.css').read_text()
app=(root/'app.js').read_text()
data=(root/'data.js').read_text()
assert '</style' not in css.lower() and '</script' not in app.lower() and '</script' not in data.lower()
assert "import {ERAS,RELEASES,TRACKS,SON_OF_SAM_TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';" in app
app=app.replace("import {ERAS,RELEASES,TRACKS,SON_OF_SAM_TRACKS,APPLE_ARTIST,LAST_LAUGH} from './data.js';",'// Data bundled for a one-file GitHub Pages deployment.',1)
data=re.sub(r'(?m)^export (const |let |function |class )',r'\1',data)
html=html.replace('<!-- INLINE_CSS -->','<style>\n'+css+'\n</style>').replace('<!-- INLINE_JS -->','<script type="module">\n'+data+'\n'+app+'\n</script>')
(root/'index.html').write_text(html)
print('Generated index.html:',len(html.encode()),'bytes')