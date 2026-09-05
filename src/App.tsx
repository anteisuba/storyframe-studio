import React from "react";
import { createRoot } from "react-dom/client";
import {
  type Asset,
  type Project,
  type Shot,
  type Job,
  type Section,
  api,
  categories,
  assetCategories,
  categoryOf,
  categoryLabel,
  titleOf,
  sizeLabel,
} from "./model";
import { AssetCard, Preview } from "./Media";
import { ProjectBrief } from './ProjectBrief';
import { downloadZip, saveBlob } from "./download";
import "./workspace.css";

function App() {
  const [projects, setProjects] = React.useState<
      { id: string; title: string }[]
    >([]),
    [project, setProject] = React.useState<Project>(),
    [baseline, setBaseline] = React.useState<Project>();
  const [section, setSection] = React.useState<Section>("overview"),
    [shotId, setShotId] = React.useState(2),
    [editing, setEditing] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState("正在读取项目…");
  const [search, setSearch] = React.useState(""),
    [status, setStatus] = React.useState("current"),
    [density, setDensity] = React.useState("medium"),
    [selection, setSelection] = React.useState<string[]>([]),
    [detailId, setDetailId] = React.useState<string>();
  const [expanded, setExpanded] = React.useState(false),
    [picker, setPicker] = React.useState(false),
    [pickerKind, setPickerKind] = React.useState("all"),
    [pickerSearch, setPickerSearch] = React.useState(""),
    [pickIds, setPickIds] = React.useState<string[]>([]);
  const [downloadBusy, setDownloadBusy] = React.useState(false),
    [failedDownloads, setFailedDownloads] = React.useState<Asset[]>([]),
    [failedUploads, setFailedUploads] = React.useState<File[]>([]),
    [dragging, setDragging] = React.useState(false);
  const [heroPicker, setHeroPicker] = React.useState(false);
  const replaceInput = React.useRef<HTMLInputElement>(null);
  const detailPanel = React.useRef<HTMLElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null),
    dialog = React.useRef<HTMLDialogElement>(null);
  const dirty = JSON.stringify(project) !== JSON.stringify(baseline),
    shot = project?.shots.find((s) => s.shot === shotId),
    detail = project?.assets.find((a) => a.id === detailId);
  const related =
      project?.assets.filter((a) => shot?.assetIds.includes(a.id)) || [],
    isStory = section === "story" || section === "seedance",
    isLibrary =
      assetCategories.some(([id]) => id === section) || section === "analysis";
  const visible =
    project?.assets
      .filter(
        (a) => categoryOf(a) === (section === "analysis" ? "video" : section),
      )
      .filter((a) =>
        (titleOf(a) + " " + (a.character || ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .filter(
        (a) =>
          status === "all" || (status === "history" ? a.blocked : !a.blocked),
      ) || [];
  const picked =
    project?.assets.filter(
      (a) =>
        !a.blocked &&
        (pickerKind === "all" || categoryOf(a) === pickerKind) &&
        titleOf(a).toLowerCase().includes(pickerSearch.toLowerCase()),
    ) || [];
  async function load(id: string) {
    setBusy(true);
    try {
      const p = await api<Project>("/api/projects/" + id);
      setProject(p);
      setBaseline(p);
      setShotId(p.shots[0]?.shot || 1);
      setEditing(false);
      setHeroPicker(false);
      setSelection([]);
      setDetailId(undefined);
      setPicker(false);
      setMessage("所有修改已保存");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  React.useEffect(() => {
    api<{ id: string; title: string }[]>("/api/projects")
      .then((rows) => {
        setProjects(rows);
        if (rows.length) void load(rows[0].id);
        else setMessage("创建你的第一个项目");
      })
      .catch((e) => setMessage(String(e)));
  }, []);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  React.useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  React.useEffect(() => {
    if (!detailId || picker || expanded || busy) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailPanel.current?.contains(event.target)) {
        setDetailId(undefined);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [detailId, picker, expanded, busy]);
  function leave() {
    if (busy) return false;
    if (dirty && !window.confirm("有未保存的修改，放弃修改并离开？"))
      return false;
    if (dirty) setProject(baseline);
    setEditing(false);
    setHeroPicker(false);
    return true;
  }
  function navigate(next: Section) {
    if (!leave()) return;
    setSection(next);
    setSearch("");
    setSelection([]);
    setDetailId(undefined);
    setPicker(false);
  }
  function mutate(change: (p: Project) => Project) {
    setProject((p) => (p ? change(p) : p));
    setMessage("有未保存的修改");
  }
  function updateShot(values: Partial<Shot>) {
    mutate((p) => ({
      ...p,
      shots: p.shots.map((s) => (s.shot === shotId ? { ...s, ...values } : s)),
    }));
  }
  function updateJob(id: string, values: Partial<Job>) {
    if (shot)
      updateShot({
        config: {
          ...shot.config,
          jobs: shot.config.jobs.map((j) =>
            j.id === id ? { ...j, ...values } : j,
          ),
        },
      });
  }
  function updateAsset(values: Partial<Asset>) {
    mutate((p) => ({
      ...p,
      assets: p.assets.map((a) =>
        a.id === detailId ? { ...a, ...values } : a,
      ),
    }));
  }
  async function save() {
    if (!project) return;
    setBusy(true);
    try {
      const p = await api<Project>("/api/projects/" + project.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      setProject(p);
      setBaseline(p);
      setEditing(false);
      setHeroPicker(false);
      setPicker(false);
      setMessage("所有修改已保存");
    } catch (e) {
      setMessage(String(e) + " · 修改仍保留，可导出项目备份");
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (busy) return;
    if (dirty && !confirm("放弃本次未保存的修改？")) return;
    setProject(baseline);
    setEditing(false);
    setHeroPicker(false);
    setPicker(false);
    setDetailId((id) =>
      baseline?.assets.some((a) => a.id === id) ? id : undefined,
    );
    setMessage("已退出编辑");
  }
  async function create() {
    if (!leave()) return;
    const title = prompt("新项目名称");
    if (!title?.trim()) return;
    setBusy(true);
    try {
      const p = await api<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setProjects((v) => [...v, { id: p.id, title: p.title }]);
      setProject(p);
      setBaseline(p);
      setSection("overview");
      setDetailId(undefined);
      setSelection([]);
      setMessage("项目已创建");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  function addShot() {
    if (!project) return;
    const n = Math.max(0, ...project.shots.map((s) => s.shot)) + 1;
    mutate((p) => ({
      ...p,
      shots: [
        ...p.shots,
        {
          shot: n,
          title: "新分镜",
          assetIds: [],
          config: { jobs: [{ id: String(n), prompt: "" }] },
        },
      ],
    }));
    setShotId(n);
  }
  async function upload(files: File[], replaceHero = false) {
    if (!project || !editing || busy) return;
    setBusy(true);
    const failed: File[] = [];
    let first: string | undefined;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setMessage(`上传 ${i + 1}/${files.length} · ${file.name}`);
      try {
        if (file.size > 50 * 1024 * 1024) throw Error("超过50MB");
        const type = file.type === "audio/x-wav" ? "audio/wav" : file.type;
        const actual = type.startsWith("audio/")
          ? "audio"
          : type.startsWith("video/")
            ? "video"
            : type.startsWith("image/")
              ? "image"
              : "unknown";
        if (replaceHero && actual !== "image") throw Error("请选择图片");
        if (actual === "unknown") throw Error("格式不支持");
        const target = section === "analysis" ? "video" : section;
        const kind =
          actual === "image"
            ? ["character", "scene", "frame", "shot-image"].includes(target)
              ? target
              : "shot-image"
            : actual;
        const row = await api<{ id: string; url: string; bytes: number }>(
          "/api/upload",
          { method: "POST", headers: { "Content-Type": type }, body: file },
        );
        const a: Asset = {
          ...row,
          title: file.name,
          filename: file.name,
          kind,
          status: "待整理",
        };
        first ??= a.id;
        mutate((p) => ({
          ...p,
          assets: [...p.assets, a],
          shots: isStory
            ? p.shots.map((s) =>
                s.shot === shotId
                  ? {
                      ...s,
                      assetIds: [...s.assetIds, a.id],
                      ...(replaceHero ? { heroAssetId: a.id } : {}),
                    }
                  : s,
              )
            : p.shots,
        }));
      } catch {
        failed.push(file);
      }
    }
    setFailedUploads(failed);
    setBusy(false);
    setDetailId(first);
    setMessage(
      failed.length
        ? `${files.length - failed.length} 项已上传，${failed.length} 项失败（格式或50MB上限），可重试`
        : "上传完成，请填写来源与关联后保存",
    );
  }
  async function batchDownload(assets: Asset[], label: string) {
    if (!assets.length || downloadBusy) return;
    setDownloadBusy(true);
    try {
      const failed = await downloadZip(assets, label, setMessage);
      setFailedDownloads(failed);
      setMessage(
        failed.length
          ? `${assets.length - failed.length} 项已打包，${failed.length} 项失败，可重试`
          : `${assets.length} 项原文件已打包下载`,
      );
    } catch (e) {
      setMessage("打包失败：" + String(e));
      setFailedDownloads(assets);
    } finally {
      setDownloadBusy(false);
    }
  }
  function toggle(id: string) {
    setSelection((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  }
  function openAsset(a: Asset) {
    setPicker(false);
    setDetailId(a.id);
  }
  const sectionName = categories.find(([id]) => id === section)?.[1] || "",
    hero =
      related.find((a) => a.id === shot?.heroAssetId) ||
      related.find((a) => !["video", "audio"].includes(a.kind) && !a.blocked);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">S</span>
          <span>
            Storyframe<small>制作工作台</small>
          </span>
        </a>
        <div className="project-switch">
          <label htmlFor="project">当前项目</label>
          <select
            id="project"
            disabled={busy}
            value={project?.id || ""}
            onChange={(e) => {
              const id = e.target.value;
              if (leave()) void load(id);
            }}
          >
            {!projects.length && <option>暂无项目</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button className="text-button" onClick={create}>
            ＋ 新建项目
          </button>
        </div>
        <div className="nav-label">制作空间</div>
        <nav aria-label="项目分类">
          {categories.map(([id, label, icon]) => (
            <button
              key={id}
              className={section === id ? "nav-active" : ""}
              onClick={() => navigate(id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
              {assetCategories.some(([c]) => c === id) && (
                <small>
                  {project?.assets.filter((a) => categoryOf(a) === id).length ||
                    0}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="online-dot" />
          {['localhost', '127.0.0.1'].includes(location.hostname) ? <>本地工作空间<small>数据保存在本机</small></> : <>云端工作空间<small>共享编辑 · 自动保存版本</small></>}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {project?.title || "新项目"}
            <span>/</span>
            <strong>{sectionName}</strong>
          </div>
          <div className="header-actions">
            <span className={"save-state " + (dirty ? "unsaved" : "")}>
              {busy ? "处理中…" : dirty ? "未保存" : "已保存"}
            </span>
            {editing ? (
              <>
                <button disabled={busy} onClick={cancel}>
                  取消
                </button>
                <button
                  className="primary"
                  disabled={busy || !dirty}
                  onClick={save}
                >
                  保存修改
                </button>
              </>
            ) : (
              <button
                className="primary"
                disabled={!project || busy}
                onClick={() => setEditing(true)}
              >
                编辑内容
              </button>
            )}
            <button
              title="导出项目JSON，不包含媒体文件"
              disabled={!project}
              onClick={() =>
                project &&
                saveBlob(
                  new Blob([JSON.stringify(project, null, 2)], {
                    type: "application/json",
                  }),
                  project.id + ".json",
                )
              }
            >
              导出项目
            </button>
          </div>
        </header>
        <div className="feedback" role="status">
          {message}
          {failedDownloads.length > 0 && (
            <button
              disabled={downloadBusy}
              onClick={() => batchDownload(failedDownloads, "重试素材")}
            >
              重试失败下载（{failedDownloads.length}）
            </button>
          )}
          {failedUploads.length > 0 && editing && (
            <button disabled={busy} onClick={() => upload(failedUploads)}>
              重试上传
            </button>
          )}
        </div>
        <main
          inert={busy}
          onDragOver={(e) => {
            if (editing && e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (editing) void upload(Array.from(e.dataTransfer.files));
            else setMessage("请先点击编辑内容，再上传素材");
          }}
        >
          {dragging && (
            <div className="drop-overlay">松开鼠标，上传到当前分类</div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {section === "story" ? "STORYBOARD" : "PROJECT WORKSPACE"}
              </div>
              <h1>{sectionName}</h1>
              <p>
                {isStory
                  ? "把故事拆成画面，让每一镜的动作、声音和参考都清楚。"
                  : isLibrary
                    ? "集中整理原始素材，保留来源，也保留每一次修改的依据。"
                    : "从这里继续你的创作。"}
              </p>
            </div>
            {isLibrary && (
              <button
                className="primary"
                disabled={!editing || busy}
                onClick={() => fileInput.current?.click()}
              >
                ＋ 批量上传
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            hidden
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/webm"
            onChange={(e) => {
              void upload(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          {!project ? (
            <div className="empty">
              <h2>每一个故事，都从一个项目开始</h2>
              <button className="primary" onClick={create}>
                新建项目
              </button>
            </div>
          ) : (
            <>
              {section === "overview" && (
                <>
                  <ProjectBrief project={project} editing={editing} onChange={setProject} onOpen={openAsset} />
                  <div className="summary-grid">
                    <div>
                      <span>分镜</span>
                      <strong>
                        {project.shots.length}
                        <small>镜</small>
                      </strong>
                    </div>
                    <div>
                      <span>参考素材</span>
                      <strong>
                        {project.assets.length}
                        <small>项</small>
                      </strong>
                    </div>
                    <div>
                      <span>参考音频</span>
                      <strong>
                        {
                          project.assets.filter((a) => a.kind === "audio")
                            .length
                        }
                        <small>段</small>
                      </strong>
                    </div>
                  </div>
                  <section className="panel overview">
                    <h2>{project.title}</h2>
                    <p>
                      {project.description ||
                        "为这个作品整理分镜、提示词和参考素材。"}
                    </p>
                    <button
                      className="primary"
                      onClick={() => navigate("story")}
                    >
                      进入分镜工作稿 →
                    </button>
                    <h3>制作约定</h3>
                    <p>
                      视频生成由用户在生成平台手动提交。历史停用素材保留供复核，不作为新生成的参考。
                    </p>
                    <p className="muted">
                      本地保存的数据需要随 data 和 media 目录一起迁移。
                    </p>
                  </section>
                </>
              )}
              {section === "notes" && (
                <section className="panel">
                  <Field
                    label="制作记录"
                    value={project.notes}
                    editing={editing}
                    onChange={(notes) => mutate((p) => ({ ...p, notes }))}
                  />
                </section>
              )}
              {isStory && (
                <div className="story-layout">
                  <div className="shot-list">
                    <div className="list-heading">
                      镜头列表 <span>{project.shots.length}</span>
                    </div>
                    {editing && (
                      <button className="add-shot" onClick={addShot}>
                        ＋ 新建分镜
                      </button>
                    )}
                    {project.shots.map((s) => (
                      <button
                        className={s.shot === shotId ? "chosen" : ""}
                        key={s.shot}
                        onClick={() => {
                          if (s.shot === shotId) return;
                          if (leave()) {
                            setShotId(s.shot);
                            setDetailId(undefined);
                            setPicker(false);
                          }
                        }}
                      >
                        <small>{String(s.shot).padStart(2, "0")}</small>
                        <span>
                          {s.title}
                          <em>{s.set || "场景待定"}</em>
                        </span>
                        <b>{s.suggestedDuration || "—"}s</b>
                      </button>
                    ))}
                  </div>
                  <article className="shot-content">
                    {shot ? (
                      <>
                        <div className="shot-heading">
                          <span className="pill">
                            SHOT {String(shot.shot).padStart(2, "0")}
                          </span>
                          <span>
                            {shot.suggestedDuration || "—"} 秒 ·{" "}
                            {shot.set || "场景待定"}
                          </span>
                        </div>
                        {editing ? (
                          <input
                            className="title-input"
                            aria-label="分镜标题"
                            value={shot.title}
                            onChange={(e) =>
                              updateShot({ title: e.target.value })
                            }
                          />
                        ) : (
                          <h2>{shot.title}</h2>
                        )}
                        {shot.config.reviewStatus && (
                          <div className="notice">
                            {shot.config.reviewStatus}
                          </div>
                        )}
                        {section === "story" && (
                          <>
                            {editing && (
                              <div className="hero-actions">
                                <button
                                  onClick={() => {
                                    setDetailId(undefined);
                                    setPicker(false);
                                    setHeroPicker(true);
                                  }}
                                >
                                  选择已有图片
                                </button>
                                <button
                                  onClick={() => replaceInput.current?.click()}
                                >
                                  上传替换主图
                                </button>
                              </div>
                            )}
                            <input
                              hidden
                              ref={replaceInput}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => {
                                if (e.target.files?.[0])
                                  void upload([e.target.files[0]], true);
                                e.target.value = "";
                              }}
                            />
                            <div className="hero-preview">
                              {hero ? (
                                <button
                                  className="hero-open"
                                  onClick={() => openAsset(hero)}
                                  aria-label="查看主图详情"
                                >
                                  <Preview asset={hero} />
                                </button>
                              ) : (
                                <div className="empty">
                                  {related.some((a) => a.blocked)
                                    ? "当前镜头图待修正，历史版本见右侧参考区"
                                    : "还没有关联镜头图"}
                                </div>
                              )}
                            </div>
                            <div className="fields-row">
                              <Field
                                label="场景"
                                value={shot.set || ""}
                                editing={editing}
                                onChange={(set) => updateShot({ set })}
                              />
                              <Field
                                label="建议时长（秒）"
                                value={String(shot.suggestedDuration || "")}
                                editing={editing}
                                onChange={(s) =>
                                  updateShot({
                                    suggestedDuration: Number(s) || undefined,
                                  })
                                }
                              />
                            </div>
                            <Field
                              label="画面与动作"
                              value={shot.visual || ""}
                              editing={editing}
                              onChange={(visual) => updateShot({ visual })}
                            />
                            <Field
                              label="声音与对白"
                              value={shot.audio || ""}
                              editing={editing}
                              onChange={(audio) => updateShot({ audio })}
                            />
                          </>
                        )}
                        {section === "seedance" && (
                          <>
                            <div className="notice neutral">
                              记录生成平台配置，不自动调用模型或消耗积分。
                            </div>
                            <Field
                              label="模型名称（按平台实际选项填写）"
                              value={shot.config.model || ""}
                              editing={editing}
                              onChange={(model) =>
                                updateShot({
                                  config: { ...shot.config, model },
                                })
                              }
                            />
                            <div className="fields-row">
                              <Field
                                label="画面比例"
                                value={shot.config.ratio || ""}
                                editing={editing}
                                onChange={(ratio) =>
                                  updateShot({
                                    config: { ...shot.config, ratio },
                                  })
                                }
                              />
                              <Field
                                label="分辨率"
                                value={shot.config.resolution || ""}
                                editing={editing}
                                onChange={(resolution) =>
                                  updateShot({
                                    config: { ...shot.config, resolution },
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                        <h3>
                          生成提示词{" "}
                          <span className="muted">
                            {shot.config.jobs.length} 个任务
                          </span>
                        </h3>
                        {shot.config.jobs.map((j) => (
                          <section className="job" key={j.id}>
                            <div className="row">
                              <span className="pill">任务 {j.id}</span>
                              <button
                                onClick={() =>
                                  navigator.clipboard
                                    .writeText(j.prompt)
                                    .then(() => setMessage("提示词已复制"))
                                    .catch(() =>
                                      setMessage("复制失败，请手动选择文字"),
                                    )
                                }
                              >
                                复制提示词
                              </button>
                            </div>
                            <Field
                              label="视频提示词"
                              value={j.prompt}
                              editing={editing}
                              onChange={(prompt) => updateJob(j.id, { prompt })}
                            />
                            <Field
                              label="运镜"
                              value={j.camera || ""}
                              editing={editing}
                              onChange={(camera) => updateJob(j.id, { camera })}
                            />
                            {section === "seedance" && (
                              <>
                                <Field
                                  label="表演与动作"
                                  value={j.performance || ""}
                                  editing={editing}
                                  onChange={(performance) =>
                                    updateJob(j.id, { performance })
                                  }
                                />
                                <Field
                                  label="结束状态"
                                  value={j.endState || ""}
                                  editing={editing}
                                  onChange={(endState) =>
                                    updateJob(j.id, { endState })
                                  }
                                />
                              </>
                            )}
                          </section>
                        ))}
                        {!shot.config.jobs.length && (
                          <p className="empty">沿用原片，本镜没有生成任务。</p>
                        )}
                      </>
                    ) : (
                      <div className="empty">
                        点击编辑内容，再添加第一个分镜。
                      </div>
                    )}
                  </article>
                  <aside className="reference-panel">
                    <div className="row">
                      <h3>
                        参考素材 <small>{related.length}</small>
                      </h3>
                      <button
                        disabled={!editing || !shot}
                        onClick={() => {
                          setPicker(true);
                          setDetailId(undefined);
                          setPickIds(shot?.assetIds || []);
                        }}
                      >
                        ＋ 添加
                      </button>
                    </div>
                    <button
                      className="full"
                      disabled={!related.length || downloadBusy}
                      onClick={() =>
                        batchDownload(related, `分镜${shotId}-参考素材`)
                      }
                    >
                      ↓ 下载本镜素材 ZIP
                    </button>
                    {editing && (
                      <button
                        className="upload-dashed"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                      >
                        ＋ 上传 / 拖入素材
                      </button>
                    )}
                    <div className="ref-cards">
                      {related.map((a) => (
                        <button
                          className="ref-card"
                          key={a.id}
                          onClick={() => openAsset(a)}
                        >
                          <div>
                            <Preview asset={a} />
                          </div>
                          <span>
                            {titleOf(a)}
                            <small className={a.blocked ? "warning" : ""}>
                              {a.blocked
                                ? "历史版本 · 不作为参考"
                                : categoryLabel(a)}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                    {!related.length && (
                      <p className="empty">
                        在编辑模式中关联图片、语音与视频。
                      </p>
                    )}
                  </aside>
                </div>
              )}
              {isLibrary && (
                <>
                  <div className="library-toolbar">
                    <input
                      type="search"
                      aria-label="搜索素材"
                      placeholder="搜索名称或角色…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                      aria-label="素材状态"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">全部状态</option>
                      <option value="current">非停用素材</option>
                      <option value="history">历史停用</option>
                    </select>
                    <div className="density" aria-label="卡片大小">
                      {[
                        ["small", "小"],
                        ["medium", "中"],
                        ["large", "大"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={density === id}
                          className={density === id ? "active" : ""}
                          onClick={() => setDensity(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="selection-bar">
                    <label>
                      <input
                        type="checkbox"
                        aria-label="全选当前筛选结果"
                        checked={
                          visible.length > 0 &&
                          visible.every((a) => selection.includes(a.id))
                        }
                        onChange={(e) =>
                          setSelection(
                            e.target.checked ? visible.map((a) => a.id) : [],
                          )
                        }
                      />
                      全选筛选结果
                    </label>
                    <span>
                      {selection.length
                        ? `已选 ${selection.length} 项`
                        : `${visible.length} 项素材`}
                    </span>
                    {selection.length > 0 && (
                      <>
                        <button
                          disabled={downloadBusy}
                          className="primary"
                          onClick={() =>
                            batchDownload(
                              project.assets.filter((a) =>
                                selection.includes(a.id),
                              ),
                              sectionName,
                            )
                          }
                        >
                          ↓ 下载 ZIP
                        </button>
                        <button onClick={() => setSelection([])}>
                          取消选择
                        </button>
                      </>
                    )}
                  </div>
                  {editing && (
                    <button
                      className="upload-dashed"
                      disabled={busy}
                      onClick={() => fileInput.current?.click()}
                    >
                      拖入文件批量上传，或点击选择 · 单文件最高 50 MB
                    </button>
                  )}
                  <div className={"asset-grid " + density}>
                    {visible.map((a) => (
                      <AssetCard
                        key={a.id}
                        asset={a}
                        selected={selection.includes(a.id)}
                        onSelect={() => toggle(a.id)}
                        onOpen={() => openAsset(a)}
                      />
                    ))}
                  </div>
                  {!visible.length && (
                    <div className="empty">
                      <h3>
                        {search ? "没有匹配的素材" : "这个分类还没有素材"}
                      </h3>
                      <p>
                        {editing
                          ? "拖入文件，或点击批量上传。"
                          : "点击编辑内容后，可上传和整理素材。"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {heroPicker && (
        <aside className="drawer" aria-label="选择分镜主图">
          <div className="drawer-header">
            <h2>选择分镜主图</h2>
            <button onClick={() => setHeroPicker(false)}>关闭</button>
          </div>
          <div className="drawer-body">
            <p>选择后点击顶部保存；原素材会保留。</p>
            {project?.assets
              .filter((a) => !["video", "audio"].includes(a.kind) && !a.blocked)
              .map((a) => (
                <button
                  className="hero-choice"
                  key={a.id}
                  onClick={() => {
                    updateShot({
                      heroAssetId: a.id,
                      assetIds: [...new Set([...(shot?.assetIds || []), a.id])],
                    });
                    setHeroPicker(false);
                  }}
                >
                  <Preview asset={a} />
                  <span>{titleOf(a)}</span>
                </button>
              ))}
          </div>
        </aside>
      )}
      {(detail || picker) && (
        <aside
          ref={detailPanel}
          inert={busy}
          className="drawer"
          aria-label={picker ? "素材选择器" : "素材详情"}
        >
          <div className="drawer-header">
            <h2>{picker ? "添加参考素材" : "素材详情"}</h2>
            <button
              aria-label="关闭详情"
              onClick={() => {
                setDetailId(undefined);
                setPicker(false);
              }}
            >
              ×
            </button>
          </div>
          {picker ? (
            <>
              <div className="drawer-tools">
                <input
                  aria-label="查找参考素材"
                  placeholder="搜索素材…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                />
                <select
                  aria-label="参考素材分类"
                  value={pickerKind}
                  onChange={(e) => setPickerKind(e.target.value)}
                >
                  <option value="all">全部分类</option>
                  {assetCategories.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="picker-list">
                {picked.map((a) => (
                  <label key={a.id} className="picker-item">
                    <input
                      type="checkbox"
                      checked={pickIds.includes(a.id)}
                      onChange={() =>
                        setPickIds((v) =>
                          v.includes(a.id)
                            ? v.filter((id) => id !== a.id)
                            : [...v, a.id],
                        )
                      }
                    />
                    <div className="picker-thumb">
                      <Preview asset={a} />
                    </div>
                    <span>
                      {titleOf(a)}
                      <small>
                        {a.blocked ? "历史停用，请谨慎关联" : categoryLabel(a)}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="drawer-footer">
                <span>已选 {pickIds.length} 项</span>
                <button
                  className="primary"
                  onClick={() => {
                    updateShot({ assetIds: pickIds });
                    setPicker(false);
                  }}
                >
                  确认关联
                </button>
              </div>
            </>
          ) : (
            detail && (
              <div className="drawer-body">
                <div className="detail-preview">
                  <Preview asset={detail} controls />
                </div>
                <div className="row">
                  <span className="pill">{categoryLabel(detail)}</span>
                  <button onClick={() => setExpanded(true)}>放大预览 ↗</button>
                </div>
                <Field
                  label="素材名称"
                  value={titleOf(detail)}
                  editing={editing}
                  onChange={(title) => updateAsset({ title })}
                />
                {editing && (
                  <label className="field">
                    <span>分类</span>
                    <select
                      value={categoryOf(detail)}
                      onChange={(e) => updateAsset({ kind: e.target.value })}
                    >
                      {assetCategories
                        .filter(([id]) =>
                          detail.kind === "audio"
                            ? id === "audio"
                            : detail.kind === "video"
                              ? id === "video"
                              : !["video", "audio"].includes(id),
                        )
                        .map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <Field
                  label="状态"
                  value={
                    detail.blocked
                      ? "历史停用 · " + (detail.status || "")
                      : detail.status || ""
                  }
                  editing={editing && !detail.blocked}
                  onChange={(status) => updateAsset({ status })}
                />
                <Field
                  label="角色 / 用途"
                  value={detail.character || ""}
                  editing={editing}
                  onChange={(character) => updateAsset({ character })}
                />
                <Field
                  label="来源"
                  value={detail.source || ""}
                  editing={editing}
                  onChange={(source) => updateAsset({ source })}
                />
                <Field
                  label="截取时间段"
                  value={detail.segment || ""}
                  editing={editing}
                  onChange={(segment) => updateAsset({ segment })}
                />
                <Field
                  label={detail.kind === "video" ? "视频分析" : "素材说明"}
                  value={detail.analysis || ""}
                  editing={editing}
                  onChange={(analysis) => updateAsset({ analysis })}
                />
                {!["video", "audio"].includes(detail.kind) && (
                  <Field
                    label="图像提示词"
                    value={detail.prompt || ""}
                    editing={editing}
                    onChange={(prompt) => updateAsset({ prompt })}
                  />
                )}
                <h3>关联分镜</h3>
                <div className="shot-links">
                  {project?.shots.map((s) =>
                    editing ? (
                      <label key={s.shot}>
                        <input
                          type="checkbox"
                          checked={s.assetIds.includes(detail.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            mutate((p) => ({
                              ...p,
                              shots: p.shots.map((x) =>
                                x.shot === s.shot
                                  ? {
                                      ...x,
                                      assetIds: checked
                                        ? [
                                            ...new Set([
                                              ...x.assetIds,
                                              detail.id,
                                            ]),
                                          ]
                                        : x.assetIds.filter(
                                            (id) => id !== detail.id,
                                          ),
                                    }
                                  : x,
                              ),
                            }));
                          }}
                        />
                        #{s.shot} {s.title}
                      </label>
                    ) : s.assetIds.includes(detail.id) ? (
                      <span key={s.shot}>
                        #{s.shot} {s.title}
                      </span>
                    ) : null,
                  )}
                </div>
                <p className="muted">
                  {sizeLabel(detail.bytes)}{" "}
                  {detail.width ? ` · ${detail.width} × ${detail.height}` : ""}
                </p>
                <button
                  disabled={downloadBusy}
                  onClick={() => batchDownload([detail], titleOf(detail))}
                >
                  ↓ 下载原文件 ZIP
                </button>
              </div>
            )
          )}
        </aside>
      )}
      <dialog
        ref={dialog}
        className="lightbox"
        onCancel={() => setExpanded(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setExpanded(false);
        }}
      >
        <button
          autoFocus
          className="lightbox-close"
          onClick={() => setExpanded(false)}
        >
          关闭预览 ×
        </button>
        {expanded && detail && <Preview asset={detail} controls />}
      </dialog>
    </div>
  );
}
function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {editing ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className={"read-value " + (!value ? "placeholder" : "")}>
          {value || "未填写"}
        </div>
      )}
    </label>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
