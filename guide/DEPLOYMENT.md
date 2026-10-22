# Deployment

在线站点：[zhangtonghetony.github.io/mimicraft-mindmap](https://zhangtonghetony.github.io/mimicraft-mindmap/)。

本产品为纯前端静态应用，发布构建产物即可；不需要文档后端、云数据库或账号服务。

## GitHub Pages

[pages.yml](../.github/workflows/pages.yml) 在 main 更新时运行：

1. Node.js 24 / pnpm 11.25.0；按锁文件安装。
2. 单元测试与 Chromium 浏览器回归。
3. 从 Pages 配置读取 base_path，设置 PAGES_BASE_PATH 后构建。
4. 上传 app/dist 并部署到 github-pages 环境。

PR 运行测试和构建，不部署。工作流使用标准 ubuntu-latest，Actions 固定到已核对的提交标识。权限按构建/发布职责分开配置。

如果 Fork：在 Settings → Pages 选择 GitHub Actions，允许工作流，然后推送 main 或手动运行工作流。生成的站点路径通常是 `https://用户名.github.io/仓库名/`，以 Pages 返回地址为准。Pages 的可用性、配额和使用政策以 GitHub 官方文档为准。

## Other static hosting

在仓库根目录：

```bash
pnpm --dir app install --frozen-lockfile
pnpm --dir app build
```

发布 app/dist。默认适用于域名根路径。若托管在 /my-map/，设置环境变量后再构建：

```bash
# Bash
PAGES_BASE_PATH=/my-map/ pnpm --dir app build
```

```powershell
# PowerShell
$env:PAGES_BASE_PATH = '/my-map/'
pnpm --dir app build
Remove-Item Env:PAGES_BASE_PATH
```

`pnpm --dir app preview` 仅用于本地检查生产构建。**子路径构建的 preview 也需要设置相同的 PAGES_BASE_PATH**，并打开终端给出的带前缀地址；只在构建时设置而预览时清除，会使本地预览资源路由不匹配。根路径和子路径的 JS/CSS/图标/字体都应验证；不要直接双击 dist/index.html 或只上传源码 index.html。

构建产物含项目 LICENSE.txt、直接依赖说明 THIRD_PARTY_NOTICES.md，以及 Vite 生成的 THIRD_PARTY_LICENSES.md，托管时请一同保留。

## Data migration

文档按浏览器来源存储，不按 Git 仓库同步。localhost、GitHub Pages、自定义域名之间请使用原生文件下载/导入迁移。变更域名、清理数据、使用隐私模式或移除浏览器配置前先备份。GitHub Pages 本身不替用户保存导图。
