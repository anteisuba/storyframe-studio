"""Append missing source images using the revision-checked local API; never rebuild a project."""
import hashlib, json, re, shutil, urllib.request
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
API = 'http://127.0.0.1:8788/api/projects/wuwa-eva'

def read(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))

def stamp(seconds):
    return f'{int(seconds)//60:02d}:{seconds%60:04.1f}'

project = json.load(urllib.request.urlopen(API))
paths = {a.get('originalPath') for a in project['assets']}
hashes = set()
for a in project['assets']:
    f = HERE/a['url'].lstrip('/')
    if f.is_file(): hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
clips = {c['id']:c for c in read('clips.json')}
metadata = {a.get('path'):a for a in read('keyframes.json')}
added = []
for folder in ['eva-review','references','keyframes','assets','project-backup-images']:
    for f in sorted((ROOT/folder).rglob('*')):
        if f.suffix.lower() not in ['.jpg','.jpeg','.png','.webp']: continue
        relative = f.relative_to(ROOT).as_posix()
        digest = hashlib.sha256(f.read_bytes()).hexdigest()
        if relative in paths or digest in hashes: continue
        row = dict(metadata.get(relative, {}))
        row.update(title=row.get('title') or f.stem, kind='reference-image', status=row.get('status') or '已导入，待整理')
        if folder == 'eva-review':
            clip = clips.get(f.parent.name if f.parent.name != folder else f.stem, {})
            start, end = clip.get('start',0), clip.get('end',0)
            sheet = f.parent.name == folder
            seconds = start if sheet else start + (int(f.stem)-1)*0.5
            row.update(kind='frame', title=f'EVA · {clip.get("id",f.stem)} · '+('总览图' if sheet else stamp(seconds)),
                       source=clip.get('source','EVA 原片'), segment=f'{stamp(start)}–{stamp(end)}' if sheet else stamp(seconds),
                       shots=clip.get('shots',[]), status='原片复核总览' if sheet else '原片截帧',
                       analysis='每0.5秒取样的复核总览。' if sheet else '从对应片段按2fps取样；时间码为采样位置。')
        elif folder == 'references':
            match = re.fullmatch(r'(wuwa|wuwa-story|aleph|eva|eva-story)-(\d+)',f.stem)
            if match:
                eva = match[1].startswith('eva'); seconds=int(match[2])
                row.update(kind='frame', title=f'{"EVA" if eva else "鸣潮"} · {stamp(seconds)}', segment=stamp(seconds),
                           source='BV12b411x7Zm.mp4' if eva else 'BV14J98B8EtZ.mp4', status='原视频截帧')
            elif 'contact' in f.stem or 'review' in f.stem:
                row.update(kind='frame',title=f.stem+' · 复核总览',source=relative,status='复核总览图')
        elif folder in ['keyframes','project-backup-images']:
            row.update(kind='shot-image',blocked=True,status='历史归档，未经本次确认，不作为生成参考')
        aid = 'import-'+digest[:24]
        target = HERE/'media'/(aid+f.suffix.lower())
        shutil.copy2(f,target)
        with Image.open(f) as im: width,height=im.size
        row.update(id=aid,url='/media/'+target.name,originalPath=relative,filename=f.name,bytes=f.stat().st_size,width=width,height=height)
        project['assets'].append(row); added.append(row); hashes.add(digest); paths.add(relative)
        for shot in project['shots']:
            if shot['shot'] in row.get('shots',[]): shot['assetIds']=list(dict.fromkeys(shot['assetIds']+[aid]))
if added:
    counts={kind:sum(a['kind']==kind for a in added) for kind in sorted({a['kind'] for a in added})}
    project['notes']+='\n\n2026-09-06：补齐历史截帧与复核总览，按文件内容去重。新增 '+str(counts)+'。保留来源路径、采样时间与已知分镜关联；未确认旧生成图标记为历史归档。音频卡片新增真实波形和直接播放。'
    request=urllib.request.Request(API,data=json.dumps(project,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'},method='PUT')
    result=json.load(urllib.request.urlopen(request))
    print(json.dumps({'added':counts,'revision':result['revision'],'total':len(result['assets'])},ensure_ascii=False))
else: print('No missing images')
