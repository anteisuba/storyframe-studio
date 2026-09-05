# Storyframe Studio

独立的多项目分镜制作站。公开浏览、公开编辑与上传，不连接视频生成接口。所有生成操作由用户在生成平台手动提交。

## 已确认范围

- 多项目与分镜新增、编辑。
- 角色图、场景图、分镜图、视频片段、视频截帧、音频上传。
- 素材来源、视频分析、时间段、角色、用途、音频处理状态。
- 每镜图像提示词与视频提示词、运镜、表演、结束状态、参考素材与 Seedance 配置。
- 云端共享数据与本地编辑；导入导出可搬迁的数据包。
- 代码放 GitHub；媒体独立保存，避免将大量视频和原图放入 Git 历史。

## 部署方向

Cloudflare Workers 承载网页与 API，D1 保存项目数据与版本，R2 保存媒体。普通 Cloudflare 全球网络与 Vercel 均不能保证中国大陆可达。上线后需要用实际域名测试。Cloudflare 中国网络是独立企业服务。

仓库：https://github.com/anteisuba/storyframe-studio 。尚未创建云资源，尚未上线。

## 当前素材规则

第 02 镜暂停视频提交。旧生成图不作为新生成输入；使用实机角色图与鸣潮 07:59–08:02 场景器械参考。音频已获用户认可。图像输出目标 2560×1440 或 3840×2160；现有 1672×941 图不得标记为 2K/4K。

## 来源

- https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china
- https://developers.cloudflare.com/china-network/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/


## 本地首版（已实现）

React + TypeScript + Vite。多项目切换与新建、分镜新建和编辑、提示词复制与编辑、图片视频音频预览、50MB以内素材上传、分镜关联、项目JSON导出。保存采用revision检查，并保留旧版本。现有EVA项目24镜112项素材已导入。

安装 Node.js 22.12+ 或24、pnpm，运行 `pnpm install`。在两个终端分别运行 `node server/local.mjs` 和 `pnpm dev`，打开 http://127.0.0.1:5174 。数据保存在 data/，媒体在 media/；两者需要单独备份，不进入Git。

新电脑克隆仓库后，可以直接新建空项目。如需接续现有作品，将旧电脑本项目的 `data/` 和 `media/` 整个复制过来，再启动。不要运行导入脚本覆盖已有编辑；`import_existing.py` 只用于首次从其上一级旧制作册目录导入。仓库本身不包含 EVA 素材。

已验证：TypeScript检查、Vite生产构建、浏览器加载与保存、API保存后重读、过期revision返回409、媒体读取。

Cloudflare后端代码在 server/worker.mjs，数据库结构在 server/schema.sql；部署配置样例为 wrangler.example.jsonc。尚未完成云端实测、资源创建和素材同步。不可把本地保存成功当作云端保存成功。

待补：素材属性与来源编辑、Seedance独立参数表单、导入恢复界面、历史恢复界面、视频截帧工具及云端端到端验证。生成按钮仍由用户在视频平台手动点击。


## 浅色工作台更新

已补齐11个分类入口、默认查看/显式编辑、顶部保存取消、来源与分镜关联编辑、右侧多选素材选择器、批量上传、可调卡片大小、放大预览及原文件ZIP批量下载。设计选择见 UI-DECISIONS.md。`pnpm test` 检查ZIP命名和失败处理。单次ZIP在浏览器内存中打包，最高512MB；大批素材分批选择。上传仍为单文件50MB。
