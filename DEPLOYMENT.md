# Cloudflare 部署与换电脑接续

主站：https://storyframe.anteisuba.com

备用：https://storyframe-studio.xiuruisu.workers.dev

## 资源

- Workers：`storyframe-studio`，网页和 `/api/*`、`/media/*` 接口。
- D1：`storyframe-studio`，项目和保存前的版本。
- R2：`storyframe-studio-media`，图片、音频、视频原文件。
- 配置：`wrangler.jsonc`。仓库不包含登录令牌。

网页公开浏览、编辑、上传，按用户确认的方式无需登录。保存时检查 revision，避免覆盖其他人的更新。

## 更新代码

安装 Node.js 24 与 pnpm 后：

```sh
git clone https://github.com/anteisuba/storyframe-studio.git
cd storyframe-studio
pnpm install
pnpm exec wrangler login
pnpm test
pnpm build
pnpm exec wrangler deploy
```

代码推送 GitHub 与 Cloudflare 部署是两个步骤；目前尚未连接 Git 自动部署。若在 Cloudflare Workers Builds 连接此仓库，构建命令使用 `pnpm build`，部署命令使用 `pnpm exec wrangler deploy`。不要在自动构建里运行素材导入脚本。

## 项目与素材

上传迁移程序：`upload_project.py <HTTPS站点地址>`。仅用于本项目首次迁移；通过本地 API 读取项目，用当前站点公开接口上传，`data/cloud-transfer.json` 保存断点和 URL 对照。完成后不会覆盖云端后续编辑。

本地原有 `data/`、`media/` 保留；不进入 Git。云端与本地是独立数据副本，不会双向自动同步。迁移完成后，换电脑直接打开上述云端网址继续同一项目，不必复制素材目录。

离线编辑仍需自行备份并复制 `data/` 与 `media/`。网页「导出项目」只导出 JSON；下载素材需使用分类里的批量 ZIP。

## 访问

使用用户已有域名的子域名，未购买域名或升级套餐。已有域名续费、账号套餐及超额用量仍按原规则计费。

2026-09-06 Globalping中国大陆节点抽测：自定义域名首页、项目列表API、前端JS、图片共12次请求全部成功（HTTP 200/206），约0.8–2.6秒；包含长沙联通、宁波移动以及腾讯国内机房。默认workers.dev的3次测试均TCP超时。此结果不代表全部运营商、地区及长期稳定性，也不是完整视频加载速度测试。

可复查的公开测试ID：`2oFNCztPL2ratulA90002152i`（首页）、`2dEtWUeiIGhyccXVY0002152k`（API）、`2kIkVt7UaAtxsp3r90002152k`（JS）、`2BDxtB1HdjfY7LooI0002152k`（图片）。通过 `https://globalping.io/?measurement=<id>` 查看。

## 助手接续

公开读取指南：https://storyframe.anteisuba.com/llms.txt 。新会话先读指南，再读 `/api/projects` 和目标项目JSON中的notes、shots、assets；修改前读取最新revision，保存后重读核对。网页中也可以使用有标签的编辑框、保存按钮、素材选择器完成操作。不要覆盖用户已有未保存编辑。

## 首次迁移验收 · 2026-09-06

已迁入24镜、372项素材。逐项验证372个R2文件的可读性、范围响应和大小；图片、截帧、音频、视频各抽样1份，SHA-256与本地原文件一致。云端项目保存后重新读取一致。

后续请优先使用云端网址继续编辑。本机旧项目为迁移时副本，不会随云端编辑自动更新。

## 完整源片与接续计划 · 2026-09-06
已追加鸣潮完整来源视频（199052701字节）和EVA完整来源视频（46892296字节），两份云端全文件SHA-256均与原文件一致。当前374项素材，其中23个视频。鸣潮6段接续位置保存于项目assemblyPlan、制作记录和片段analysis。源片时间码与成片时间码明确区分，第7–8镜精确切点未锁定。
