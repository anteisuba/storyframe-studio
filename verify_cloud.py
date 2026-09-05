import concurrent.futures, hashlib, json, urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent
state=json.loads((root/'data/cloud-transfer.json').read_text())
def get(path,range=False):
    headers={'User-Agent':'StoryframeStudio-Migration/1.0'}
    if range: headers['Range']='bytes=0-0'
    return urllib.request.urlopen(urllib.request.Request(state['base']+path,headers=headers),timeout=90)
with get('/api/projects/'+state['projectId']) as r: project=json.load(r)
def check(a):
    with get(a['url'],True) as r:
        assert r.status==206,(a['id'],r.status)
        assert r.headers['Content-Range']==f"bytes 0-0/{a['bytes']}",(a['id'],r.headers['Content-Range'])
        assert len(r.read())==1
    return a['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    checked=list(pool.map(check,project['assets']))
reverse={v:k for k,v in state['urls'].items()}
for kind in ['audio','video','frame','shot-image']:
    a=next(a for a in project['assets'] if a['kind']==kind)
    with get(a['url']) as r: remote=r.read()
    local=(root/reverse[a['url']].lstrip('/')).read_bytes()
    assert hashlib.sha256(remote).digest()==hashlib.sha256(local).digest(),a['id']
print(json.dumps({'linksAndSizesVerified':len(checked),'fullSHA256Samples':4,'shots':len(project['shots'])}))
