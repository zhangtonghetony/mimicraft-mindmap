# Contributing

欢迎提交可复现的问题、交互改进、文档修正与 Pull Request。界面目前以中文为主，Issue/PR 可使用中文或英文。

1. Fork 仓库并创建工作分支。
2. 安装 Node.js 24 与 pnpm 11.25.0，执行 `pnpm --dir app install --frozen-lockfile`。
3. 先说明用户场景、预期行为和数据兼容影响，再实现小范围变更。
4. 运行 `pnpm --dir app test`、`pnpm --dir app build`；交互变更另运行 `pnpm --dir app test:e2e --workers=4`，首次需安装 Chromium。
5. 保持 guide/ 与 plan.md 同步，在 PR 中说明验证结果和已知限制。

Bug 报告请附浏览器、操作步骤、预期/实际结果和脱敏样例。请勿公开上传真实个人导图、密码、密钥或含隐私的截图。

优先事项见 [plan.md](plan.md)。新增账号、联网存储/协作、付费机制或引入不兼容文件格式前，请先讨论范围。现有 MIT 许可证适用于项目自有代码，第三方依赖继续遵守各自许可。
