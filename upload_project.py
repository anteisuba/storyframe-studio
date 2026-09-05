"""One-time local-to-cloud transfer with a resumable checkpoint in ignored data/."""
import concurrent.futures, json, mimetypes, sys, urllib.request
from pathlib import Path

HERE=Path(__file__).resolve().parent
base=sys.argv[1].rstrip('/')
if not base.startswith('https://'): raise SystemExit('HTTPS destination required')
def request(path, data=None, method=None, content_type='application/json'):
    req=urllib.request.Request(base+path,data=data,method=method,headers={'Content-Type':content_type})
    with urllib.request.urlopen(req,timeout=180) as response: return json.load(response)
project=json.load(urllib.request.urlopen('http://127.0.0.1:8788/api/projects/wuwa-eva'))
files={a['url']:HERE/a['url'].lstrip('/') for a in project['assets']}
missing=[str(f) for f in files.values() if not f.is_file()]
if missing: raise SystemExit('Missing local media: '+str(missing))
checkpoint=HERE/'data/cloud-transfer.json'
if checkpoint.exists():
    state=json.loads(checkpoint.read_text())
    if state['base']!=base: raise SystemExit('Checkpoint belongs to another destination')
else:
    remote=request('/api/projects',json.dumps({'title':project['title']}).encode(),'POST')
    state={'base':base,'projectId':remote['id'],'urls':{}}
def save(): checkpoint.write_text(json.dumps(state),encoding='utf-8')
save()
def upload(entry):
    url,f=entry
    mime=mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
    if f.suffix=='.wav': mime='audio/wav'
    result=request('/api/upload',f.read_bytes(),'POST',mime)
    return url,result['url']
pending=[entry for entry in files.items() if entry[0] not in state['urls']]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for future in concurrent.futures.as_completed([pool.submit(upload,e) for e in pending]):
        old,new=future.result(); state['urls'][old]=new; save()
        if len(state['urls'])%20==0: print(f"Uploaded {len(state['urls'])}/{len(files)}",flush=True)
remote=request('/api/projects/'+state['projectId'])
if remote['assets'] and not state.get('complete'): raise SystemExit('Cloud project changed during transfer; refusing to overwrite')
if state.get('complete'): raise SystemExit('Transfer already complete; cloud edits were not overwritten')
project['id']=remote['id'];project['revision']=remote['revision']
for asset in project['assets']: asset['url']=state['urls'][asset['url']]
project['notes']+='\n\n2026-09-06：项目迁至Cloudflare Workers + D1 + R2，公开编辑。GitHub保存代码，云端保存项目与素材。之后从云端网址继续工作。'
saved=request('/api/projects/'+project['id'],json.dumps(project,ensure_ascii=False).encode(),'PUT')
check=request('/api/projects/'+project['id'])
assert check==saved
state['complete']=True;save()
print(json.dumps({'projectId':saved['id'],'assets':len(saved['assets']),'shots':len(saved['shots']),'revision':saved['revision']},ensure_ascii=False),flush=True)
