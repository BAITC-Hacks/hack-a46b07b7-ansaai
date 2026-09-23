from pathlib import Path
import json,re,shutil
ROOT=Path(__file__).resolve().parents[1]
# Source files in root; public is an explicit generated frontend allowlist.
js=(ROOT/'app.js').read_text()
rubric=json.loads((ROOT/'public/rubric.json').read_text())
js=re.sub(r'^const RUBRIC=.*?;\n',lambda _: 'const RUBRIC='+json.dumps(rubric,ensure_ascii=False)+';\n',js,count=1,flags=re.M)
(ROOT/'app.js').write_text(js)
for filename in ['app.js','styles.css','index.html']:shutil.copy2(ROOT/filename,ROOT/'public'/filename)
html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="styles.css" />','<style>'+(ROOT/'styles.css').read_text()+'</style>').replace('<script src="app.js"></script>','<script>window.TASKREADY_DEMO=true;\n'+js+'</script>')
(ROOT/'TaskReady-demo.html').write_text(html)
(ROOT/'public/demo.html').write_text(html)
print('Built public assets and standalone demo.')
