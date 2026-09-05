"""Copy existing evidence into a portable, separate project without changing sources."""
import json, shutil, hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
def read(name):
    return json.loads((SOURCE / name).read_text(encoding='utf-8-sig'))

def main():
    dest = HERE / 'data'
    dest.mkdir(exist_ok=True)
    assets, seen = [], {}
    def asset(path, kind, metadata):
        if not path or not isinstance(path, str): return None
        src = (SOURCE / path).resolve()
        if not src.is_relative_to(SOURCE) or not src.is_file(): return None
        if path in seen: return seen[path]
        aid = hashlib.sha256(path.encode()).hexdigest()[:20]
        target = HERE / 'media' / (aid + src.suffix.lower())
        target.parent.mkdir(exist_ok=True)
        if not target.exists(): shutil.copy2(src, target)
        row = dict(metadata, id=aid, kind=kind, url='/media/' + target.name,
                   originalPath=path, bytes=src.stat().st_size)
        assets.append(row)
        seen[path] = aid
        return aid
    for row in read('manifest.json'):
        asset(row.get('file'), 'reference-image', row)
    for row in read('keyframes.json'):
        asset(row.get('path'), 'shot-image', row)
    for row in read('voice-sources.json'):
        asset(row.get('path'), 'audio', dict(row, title=row.get('character','')+' · 参考语音', status='用户已确认参考语音'))
    for filename in ['clips.json', 'eva-reviewed-clips.json']:
        rows = read(filename)
        if isinstance(rows,dict): rows = rows.get('clips',[])
        for row in rows:
            asset(row.get('path') or row.get('file'), 'video', row)
    for path in ['references/control-user-wide.png','references/control-user-close.png','clips/wuwa-control-0759-0802.mp4']:
        asset(path, 'video' if path.endswith('.mp4') else 'scene-image', {'title':'指挥室 · 07:59–08:02','shots':[2,3], 'source':'鸣潮原片 07:59–08:02'})
    configs = {x['shot']:x for x in read('generation-config.json')}
    shots = []
    for row in read('storyboard.json')['shots']:
        config = configs.get(row['shot'], {})
        for job in config.get('jobs',[]):
            for entry in job.get('uploadOrder',[]): asset(entry.get('path'),'reference-image',{'title':entry.get('purpose','参考素材')})
            asset(job.get('referenceVideo'),'video',{'title':'分镜动作参考'})
        related = [a['id'] for a in assets if row['shot'] in a.get('shots',[])]
        text = str(row.get('audio','')) + ' '.join(str(j.get('audio','')) for j in config.get('jobs',[]))
        related += [a['id'] for a in assets if a['kind']=='audio' and a.get('character') and a['character'] in text]
        if row['shot']==2:
            config['reviewStatus']='暂停提交：需要重做首帧与动作，旧生成图不可用作参考'
            for job in config.get('jobs',[]):
                job['legacyPrompt']=job.get('prompt','')
                job['prompt']='待重写：原提示词姿势僵硬，先确认实机背景、器械与自然动作，再整理生成提示词。'
                job['camera']='待重写：自然动作与实体控制台构图确认后填写'
                job['image']=None
                job['uploadOrder']=[]
        shots.append(dict(row, config=config, assetIds=list(dict.fromkeys(related))))
    for a in assets:
        if 2 in a.get('shots',[]) and a['kind']=='shot-image':
            a['blocked']=True
            a['status']='历史版本，不作为生成参考'
    project = {'id':'wuwa-eva','title':'把达妮娅还给我','description':'鸣潮 × EVA · 分镜制作档案','revision':0,'shots':shots,'assets':assets,
      'notes':(SOURCE/'VIDEO-LESSONS.md').read_text(encoding='utf-8-sig'),
      'changes':['独立项目迁入；保留原始提示词与素材状态。','公开编辑与上传已获授权。','第02镜旧配置停用；音频保留；场景参考07:59–08:02。']}
    (dest/'wuwa-eva.json').write_text(json.dumps(project,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'shots':len(shots),'assets':len(assets),'bytes':sum(a['bytes'] for a in assets)},ensure_ascii=False))

if __name__=='__main__': main()
