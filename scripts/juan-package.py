from pathlib import Path
import os,hashlib,json,difflib,zipfile
root=Path.cwd().resolve()
assert str(root).lower()==r'C:\Users\OPPENHEIMER\Desktop\kronox-juan'.lower()
source=Path(r'C:\Users\OPPENHEIMER\Desktop\KRONOX-main')
for ancestor in [root,*root.parents]:
    assert not (ancestor/'.git').exists(),f'Unexpected repository at {ancestor}'
baseline=json.loads((root/'docs/juan/source-baseline.json').read_text('utf-8-sig'))
changed_original=[]
for item in baseline['files']:
    file=source/item['file']
    actual=hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None
    if actual!=item['sha256']: changed_original.append(item['file'])
assert not changed_original,changed_original
report={'source':str(source),'copy':str(root),'originalFilesChecked':len(baseline['files']),'originalContentUnchanged':True,'gitRepositoryCreated':False,'ancestorsChecked':True,'changedOriginalFiles':changed_original}
(root/'docs/juan/source-integrity.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
excluded={'.git','node_modules','dist','build','.vite','.vercel','coverage','.next','.cache','.venv','__pycache__'}
files=[]
for base,dirs,names in os.walk(root):
    dirs[:]=[d for d in dirs if d not in excluded and not (Path(base)/d).is_symlink()]
    for name in names:
        if name.startswith('.env') or name=='.git' or name.endswith(('.zip','.log','.tsbuildinfo')):continue
        files.append(Path(base)/name)
changes=[];patch=[]
text_ext={'.js','.jsx','.ts','.tsx','.mjs','.css','.json','.md','.html','.ps1','.py'}
for file in files:
    rel=file.relative_to(root).as_posix()
    if rel in {'docs/juan/changes.patch','docs/juan/changed-files.json'}:continue
    data=file.read_bytes();original=source/rel
    if original.is_file() and hashlib.sha256(original.read_bytes()).digest()==hashlib.sha256(data).digest():continue
    changes.append({'file':rel,'status':'modified' if original.exists() else 'new','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    if file.suffix in text_ext and not rel.startswith(('docs/juan/archive/','public/demo/')) and not rel.endswith(('source-baseline.json','wcs-reference.json','researchCatalog.js','localObservations.js','catalog.json','real-measurements.json')):
        before=original.read_text('utf-8-sig',errors='replace').splitlines(True) if original.exists() else []
        after=data.decode('utf-8-sig',errors='replace').splitlines(True)
        patch.extend(difflib.unified_diff(before,after,fromfile='a/'+rel if original.exists() else '/dev/null',tofile='b/'+rel))
(root/'docs/juan/changed-files.json').write_text(json.dumps(changes,indent=2),encoding='utf-8')
(root/'docs/juan/changes.patch').write_text(''.join(patch),encoding='utf-8')
files += [root/'docs/juan/changed-files.json',root/'docs/juan/changes.patch']
archive=root/'ENTREGA-JUAN.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted(set(files)):
        z.write(file,'kronox-juan/'+file.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert not any('/.git/' in n or '/node_modules/' in n or '/dist/' in n or '/.env' in n for n in z.namelist())
print(json.dumps({'unchangedOriginalFiles':len(baseline['files']),'changedOrNewFiles':len(changes),'archive':str(archive),'archiveBytes':archive.stat().st_size,'integrity':'passed'},indent=2))
