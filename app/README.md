# Mimicraft Mindmap application

完整产品介绍、在线地址、ZIP/clone 使用方法、能力与边界见 [项目 README](../README.md)。

从仓库根目录运行：

```bash
pnpm --dir app install --frozen-lockfile
pnpm --dir app dev
pnpm --dir app test
pnpm --dir app build
pnpm --dir app exec playwright install chromium
pnpm --dir app test:e2e --workers=4
```

Node.js 24.x，pnpm 11.25.0。Vite 开发默认地址为 http://127.0.0.1:5173/，生产产物位于 app/dist/。

应用是纯前端，文件处理保留在浏览器。浏览器自动保存为明文；密码只保护明确下载的加密文件。产品文档见 [guide/](../guide/ARCHITECTURE.md)。
