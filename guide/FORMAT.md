# Native files, exports and storage

## `.mimicraft`

当前明文文件为 UTF-8 JSON：

```json
{
  "format": "mimicraft-map",
  "schemaVersion": 4,
  "document": {
    "id": "stable-document-id",
    "title": "My map",
    "rootId": "root-node-id",
    "nodes": {},
    "relations": [],
    "groups": []
  }
}
```

上例只展示封装结构，**不是可直接导入的完整文件**。真实字段及约束以 [model.ts](../app/src/model.ts) / [extended.ts](../app/src/extended.ts) 为准，包括创建/更新时间、节点语义/样式/资源、布局、背景、自由主题、计划任务、演说，以及可选 canvasId/canvasName/canvasOrder/sheets。

- 可读 v1/v2/v3，下载统一写 v4；未来版本或未知字段被明确拒绝，避免静默丢失。
- 资源使用受约束的数据 URL 自包含，文件不依赖当前浏览器中的临时资源键。
- 打开文件默认创建浏览器副本，不修改磁盘原文件，也不覆盖现有导图。
- 文件扩展名只是识别线索，格式/版本/结构/引用关系均需校验。
- 其他产品的原生格式和通用第三方格式导入目前不支持；导出格式不自动等于可导入格式。

## Encrypted envelope

密码文件使用 `mimicraft-encrypted` v1 封装，包含算法、KDF、固定迭代参数、随机 salt/iv 和 ciphertext。实现使用 PBKDF2-SHA256（250000 次，16 字节随机盐）、AES-256-GCM（12 字节随机 IV）及附加认证数据；参数、密文或密码错误均拒绝。

实现见 [encrypted.ts](../app/src/encrypted.ts)，测试覆盖随机密文、往返、错误密码、篡改和非法参数。它尚未经过独立安全审计，不是设备安全或浏览器存储加密方案。

**IndexedDB 副本仍是明文。** 密码只留在当前文件会话内存，刷新/切换文件清除；打开加密文件后再次加密下载需重新设置。密码无法找回，已经下载的文件不会随设置改变而自动改写。

## Export mappings

| 输出 | 映射与损失 |
| --- | --- |
| SVG / PNG / JPEG | 独立布局，节点/树/图片/关系/分组；长标注/公式与结构标签可进入编号图例。手绘/插画等效果有简化，公式为 LaTeX 源文；不包含完整笔记/语音/附件内容 |
| PDF | 每范围一页的图像 PDF，中文由浏览器绘制，无文本检索或矢量编辑承诺 |
| Markdown | 层级、局部文字格式、内容说明、相对资源路径 |
| OPML | outline 层级、节点标识与内容属性；XML 安全转义 |
| TextBundle | v2 的 info.json / text.md / assets；单画布 .textpack，多个画布用 ZIP 中独立目录 |
| Word | 正规 DOCX，可编辑层级文字/内容及嵌入图像；自由布局等以结构图及原生副本保留 |
| Excel | 正规 XLSX，节点/父级/层级/内容/任务与关系分组表；文本以字符串写入，避免公式注入 |
| PowerPoint | 正规 PPTX，按可见演说页的顺序/外观/标题/备注/字号，长内容自动续页 |

结构化输出包明确附带当前输出范围的原生快照；附件可能单独出现，也可从自包含快照取得。SVG 只保留生成器/布局元数据，不夹带笔记或其他画布。分享前检查 ZIP 中原生副本和资源是否包含私密内容。

## Storage and technical limits

| 范围 | 当前边界 |
| --- | --- |
| 每文件 | 最多 100 画布，明文 JSON 总计 8 MB |
| 每画布 | 最多 5000 节点、128 层（含根）、1000 联系、1000 分组 |
| 每主题资源 | 最多 10 个，每个 2 MB |
| 栅格输出 | 每边 16384 像素、总计 4000 万像素；超限可切图或降低倍数 |
| 自动保存 | 当前来源下的 IndexedDB；浏览器清理、隐私模式及容量都可能影响持久性 |
| 模板/风格库 | IndexedDB / localStorage；应用后的设置随文件搬移，整个库不自动嵌入单份文档 |

以上不是付费配额或上限规模流畅性保证。静态网页可访问不代表应用已具备 PWA 离线启动。
