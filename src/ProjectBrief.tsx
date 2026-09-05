import { type Project, type Asset, titleOf } from './model';
import { Preview } from './Media';
export function ProjectBrief({project,editing,onChange,onOpen}:{project:Project;editing:boolean;onChange:(p:Project)=>void;onOpen:(a:Asset)=>void}) {
 const progress=project.progress||{stage:'',completed:'',next:''};
 const references=project.styleReferences||[];
 const images=project.assets.filter(a=>!['video','audio'].includes(a.kind)&&!a.blocked);
 return <>
  <section className="panel project-progress"><h2>当前进度</h2>
   {([['stage','当前阶段'],['completed','已经完成'],['next','下一步与待确认']] as const).map(([key,label])=><label className="field" key={key}>{label}{editing?<textarea value={progress[key]} onChange={e=>onChange({...project,progress:{...progress,[key]:e.target.value}})}/>:<div className="read-value">{progress[key]||'尚未填写'}</div>}</label>)}
  </section>
  <section className="panel"><h2>已确认画风基准</h2>
   <p className="muted">整体视觉与角色校准分别注明用途；实机参考用于核对身份、服装和器械。</p>
   <div className="style-reference-grid">{references.map((ref,i)=>{
    const asset=project.assets.find(a=>a.id===ref.assetId);
    const update=(patch:Partial<typeof ref>)=>onChange({...project,styleReferences:references.map((r,j)=>j===i?{...r,...patch}:r)});
    return <article key={i}>
     {editing?<label className="field">基准名称<input value={ref.title} onChange={e=>update({title:e.target.value})}/></label>:<h3>{ref.title}</h3>}
     {asset?<button className="style-reference-image" aria-label={'查看画风基准 '+titleOf(asset)} onClick={()=>onOpen(asset)}><Preview asset={asset}/></button>:<p>尚未选择图片</p>}
     {editing&&<label className="field">参考图片<select value={ref.assetId} onChange={e=>update({assetId:e.target.value})}><option value="">选择已有图片</option>{images.map(a=><option key={a.id} value={a.id}>{titleOf(a)}</option>)}</select></label>}
     {editing?<label className="field">适用范围<textarea value={ref.usage} onChange={e=>update({usage:e.target.value})}/></label>:<p className="read-value">{ref.usage}</p>}
     {editing&&<button onClick={()=>onChange({...project,styleReferences:references.filter((_,j)=>j!==i)})}>移除此基准关联</button>}
    </article>
   })}</div>
   {!references.length&&<p className="muted">尚未指定基准图。进入编辑后从已有素材选择。</p>}
   {editing&&<button onClick={()=>onChange({...project,styleReferences:[...references,{assetId:'',title:'新画风基准',usage:''}]})}>＋ 添加画风基准</button>}
  </section>
 </>;
}
