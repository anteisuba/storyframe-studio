# Cloudflare 部署与换电脑接续

站点：https://storyframe-studio.xiuruisu.workers.dev

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

当前使用默认 workers.dev 域名。中国大陆访问需实际网络测试；后续可绑定用户自己的域名，不能把默认域名部署成功等同于所有地区都可达。
