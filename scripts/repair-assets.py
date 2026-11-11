from pathlib import Path
import zipfile,json,re
root=Path.cwd();scene=(root/'src/scene/createScene.js').read_text('utf-8');names=sorted(set(re.findall(r"'([\w-]+\.(?:jpg|png|webp))'",scene)))
archive=Path(r'C:\Users\OPPENHEIMER\Desktop\KRONOX-main.zip')
entries=zipfile.ZipFile(archive).namelist() if archive.exists() else []
rows=[{'asset':n,'presentInCopy':(root/'public/textures/planets'/n).exists(),'inOriginalZip':any(e.endswith('/'+n) for e in entries)} for n in names]
(root/'docs/repair-2026-11-07/assets-audit.json').write_text(json.dumps({'assets':rows,'ignoredPatterns':(root/'.gitignore').read_text(),'gitHistoryAvailable':False,'versionsCompared':['KRONOX-main source','pre-repair kronox-juan backup']},indent=2),encoding='utf-8')
print(rows)
