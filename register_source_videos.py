"""Register uploaded source videos and persist the existing assembly plan."""
import hashlib,json,urllib.request
from pathlib import Path
BASE='https://storyframe-studio.xiuruisu.workers.dev'
URL=BASE+'/api/projects/ecd47a23-1611-49ec-bd0c-6958b25bf893'
def request(url,data=None):
    return urllib.request.urlopen(urllib.request.Request(url,data=data,method='PUT' if data else 'GET',headers={'User-Agent':'StoryframeStudio/1.0','Content-Type':'application/json'}),timeout=180)
with request(URL) as response: project=json.load(response)
sources=[('wuwa','BV14J98B8EtZ','鸣潮'),('eva','BV12b411x7Zm','EVA')]
for name,bv,label in sources:
    path=Path('C:/Users/15620/Downloads')/(bv+'.mp4')
    url='/media/source-'+name+'-'+bv+'.mp4'
    local=hashlib.sha256()
    with path.open('rb') as f:
        while block:=f.read(1024*1024): local.update(block)
    remote=hashlib.sha256();size=0
    with request(BASE+url) as response:
        while block:=response.read(1024*1024): remote.update(block);size+=len(block)
    assert size==path.stat().st_size and remote.digest()==local.digest(),name
    aid='source-'+name+'-full'
    row={'id':aid,'kind':'video','title':label+' · 完整来源视频','filename':bv+'.mp4','url':url,'bytes':size,'source':'https://www.bilibili.com/video/'+bv+'/',
         'role':'source','status':'完整来源视频 · 非直接整段插入','originalPath':str(path),'sha256':local.hexdigest(),
         'analysis':'保留原下载文件，未重新编码。用于核对原片时间码、回看上下文及重新截取。'+('六段已选接续片段按制作记录安排插入，整段原视频不直接插入成片。' if name=='wuwa' else '仅作为动作、表情和运镜参考；不将EVA人物、原声或整段画面插入鸣潮成片。')}
    existing=next((a for a in project['assets'] if a['id']==aid),None)
    if existing: existing.update(row)
    else: project['assets'].append(row)
    print(label, 'full-file SHA256 verified',size,flush=True)

placements={
 'wuwa-opening-a':([1],'开场接续 1/3：07:42–07:58 → 08:03–08:10 → 08:23–08:30，然后进入第1镜失去回应；三段按此顺序。','顺序已明确；画面方向、声尾和最终切点需剪辑复核'),
 'wuwa-opening-b':([1],'开场接续 2/3：接 wuwa-opening-a，后接 wuwa-opening-c，随后进入第1镜。','顺序已明确；最终切点待剪辑复核'),
 'wuwa-opening-c':([1],'开场接续 3/3：接 wuwa-opening-b，结束后进入第1镜失去回应，再接第2镜指挥室。','顺序已明确；最终切点待剪辑复核'),
 'wuwa-threat':([5],'直接替代第5镜威胁逼近画面；第4镜呼吸 → 本段08:43–08:46 → 第6镜把她还给我。无需重复生成该威胁动作。','插入位置已明确；原片3秒，分镜原建议8秒不代表要拉伸视频'),
 'wuwa-response-a':([7],'第7镜回应段落的原片接续：08:59–09:06；随后09:09–09:30承接第8镜重新站立。与第7镜生成眼部近景的精确切点尚未锁定。','段落归属已明确；精确插入点和声画衔接待剪辑确认'),
 'wuwa-response-b':([7,8],'承接第7镜回应和上一段08:59–09:06，用09:09–09:30承担第8镜重新站立，尾帧接第9镜光翼展开。不能在第7和第8镜各重复放一次。','跨第7–8镜只用一次；精确切点待剪辑确认')}
plan=[]
for a in project['assets']:
    stem=Path(a.get('originalPath','')).stem
    if a['kind']!='video' or a.get('role')=='source': continue
    if stem in placements:
        shots,placement,status=placements[stem]
        a.update(role='continuation',sourceAssetId='source-wuwa-full',placement=placement,placementStatus=status)
        a['title']='成片接续 · '+stem
        a['segment']=f"{int(a['start'])//60:02d}:{int(a['start'])%60:02d}–{int(a['end'])//60:02d}:{int(a['end'])%60:02d}"
        a['analysis']=placement+'\n'+status
        plan.append({'assetId':a['id'],'sourceAssetId':'source-wuwa-full','shots':shots,'sourceStart':a['start'],'sourceEnd':a['end'],'placement':placement,'status':status})
    elif stem.startswith('eva-'):
        a.update(role='reference',sourceAssetId='source-eva-full')
        if not a.get('source'): a['source']='https://www.bilibili.com/video/BV12b411x7Zm/'
        a['analysis']=(a.get('analysis') or a.get('observation') or a.get('guidance') or '')+'\n用途：仅参考动作、表情、运镜，不直接剪入成片。'
    elif stem.startswith('wuwa-control'):
        a.update(role='reference',sourceAssetId='source-wuwa-full')
project['assemblyPlan']={'status':'分镜级安排，非锁定剪辑时间线','timebase':'sourceStart/sourceEnd 是原视频秒数，不是成片绝对时间码','clips':plan}
marker='\n\n## 完整视频与接续位置（新会话必读）'
if marker in project['notes']: project['notes']=project['notes'].split(marker)[0]
project['notes']+=marker+'''\n完整来源视频已在“视频片段”：鸣潮 BV14J98B8EtZ、EVA BV12b411x7Zm；用于核对与重截，不代表整段放进成片。
1. 开场三段07:42–07:58 → 08:03–08:10 → 08:23–08:30，之后进入第1镜失去回应，再接第2镜。
2. 第4镜之后用08:43–08:46承担第5镜威胁逼近，再接第6镜；该原片3秒，不应按原建议8秒强行拉伸。
3. 第7镜回应段落接08:59–09:06，随后09:09–09:30承接第8镜重新站立，尾帧接第9镜。与第7镜眼部生成镜头的精确切点未锁定，跨第7–8镜的片段只放一次。
4. EVA 14段只作动作、表情和运镜参考；指挥室07:59–08:02只作场景器械参考。
5. 所有上述时间均为完整源视频时间码，不是成片时间码；总时长与逐帧切点尚未锁定。
新会话先读取notes和assemblyPlan，再按assetId读取片段、sourceAssetId读取完整源片，复核关联分镜的visual/audio/config.jobs。不要仅凭文件名猜插入位置，也不要把参考片当作成片接续片。
'''
with request(URL,json.dumps(project,ensure_ascii=False).encode()) as response: saved=json.load(response)
with request(URL) as response: verified=json.load(response)
assert saved==verified
print(json.dumps({'assets':len(saved['assets']),'assemblyEntries':len(plan),'revision':saved['revision']}))
