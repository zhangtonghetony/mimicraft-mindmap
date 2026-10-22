# Validation baseline

## Current evidence

发布前在 Windows / Node.js 24 / pnpm 11.25.0 上验证：

| 检查 | 结果 |
| --- | --- |
| Vitest | 48 项单元/不变量测试通过 |
| Playwright Chromium | 46 项浏览器回归通过；导出细节调整后另复验 18 项专项 |
| TypeScript / Vite | 类型检查与生产构建通过 |
| 真实导出 | 十种格式在生产构建中生成成功、无页面运行错误 |
| 独立读取器 | python-docx、python-pptx、openpyxl、pypdf、Pillow、XML/ZIP 读取通过 |
| 排版 | 桌面/窄屏、导出设置、生成图片和独立分页打印已查看 |

CI 当前状态见 [GitHub Actions](https://github.com/zhangtonghetony/mimicraft-mindmap/actions/workflows/pages.yml)。自动化基线与具体线上构建结果分别看待；请以相应提交的工作流为准。

## What the tests check

- 树/森林可达性、唯一父级、深度/规模边界、循环保护与混合操作不变量。
- 编辑/输入法/焦点、层级/拖放、重叠多选删除、历史分叉与引用重映射。
- 自动保存/刷新/快速切换、IndexedDB 故障恢复、无效/未来文件隔离。
- 内容/媒体/公式/关系/分组的文件往返；麦克风拒绝与合成设备成功路径。
- 十种布局的节点矩形避让、不同尺寸深层内容、自由主题对齐/分布/挂接。
- 富文本/并列样式/配色/模板/计划/提醒、视图与演说、多画布/回收恢复/合并。
- 加密随机性、正确往返、错误密码/篡改/非法参数拒绝。
- PNG/JPEG 签名、2 倍尺寸、XML 转义、原图字节、PDF 页数、实际打印调用。
- TextBundle 元数据/相对资源、Office OOXML 内容/关系、Excel 字符串防公式注入、PPT 备注/隐藏页/续页与尾部文字。
- 导出超限失败保留文档；SVG 不夹带未显示笔记或其他画布。

## Reproduce

从仓库根目录：

```bash
pnpm --dir app install --frozen-lockfile
pnpm --dir app test
pnpm --dir app build
pnpm --dir app exec playwright install chromium
pnpm --dir app test:e2e --workers=4
```

Linux CI 用 `playwright install --with-deps chromium` 安装系统依赖。浏览器测试启动/复用 127.0.0.1:5173；默认独立上下文，不读取用户的浏览器文档。录音使用合成设备；打印调用以替身断言，不发送真实打印任务。

## Limits of the evidence

测试通过不等于其他浏览器、手机触控、真实麦克风、所有 Office 客户端显示和最大规模性能都已验证。独立文件读取器也不等于已在 Microsoft Office GUI 检查全部页面。当前没有第三方安全审计或 PWA 离线启动验收。

下一步重点是用户真实样例、兼容性、性能与可访问性，见 [plan.md](../plan.md)。
