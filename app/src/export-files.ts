import { zipSync } from 'fflate';
import { serializeDocument, type MapDocument, type MapNode } from './model';
import { getSlides } from './Planning';
import { diagramSvg, raster, rows, safeName, utf8, xml, type ExportFormat, type ExportOptions, type ExportTarget, type OutputFile } from './export-core';

const md = (text: string) => text.replace(/([\\`*_[\]<>])/g, '\\$1');
function resourcePath(node: MapNode, index: number) { const asset = node.content!.attachments![index]; const mime = asset.dataUrl.slice(5, asset.dataUrl.indexOf(';')); const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav' } as Record<string, string>)[mime] ?? 'bin'; return `assets/${node.id}-${index}.${ext}`; }
export function assetBytes(dataUrl: string): Uint8Array { return Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), character => character.charCodeAt(0)); }
export function resourceFiles(doc: MapDocument): OutputFile[] { return rows(doc).flatMap(({ node }) => (node.content?.attachments ?? []).map((asset, i) => ({ name: resourcePath(node, i), data: assetBytes(asset.dataUrl), mime: asset.dataUrl.slice(5, asset.dataUrl.indexOf(';')) }))); }
function details(node: MapNode, doc: MapDocument): string[] {
  const c = node.content; if (!c) return [];
  return [c.callout ? `标注：${c.callout}` : '', c.note ? `笔记：${c.note}` : '', c.tags?.length ? `标签：${c.tags.join('，')}` : '', c.markers?.length ? `标记：${c.markers.join('，')}` : '', c.todo ? `任务：${c.todo === 'done' ? '完成' : '未完成'}` : '', c.task ? `计划：${JSON.stringify(c.task)}` : '', c.link ? `链接 (${c.link.kind})：${c.link.kind === 'topic' ? doc.nodes[c.link.value]?.text + ' [' + c.link.value + ']' : c.link.value}` : '', c.equation ? `LaTeX：${c.equation}` : '', c.illustration ? `插画：${c.illustration}` : ''].filter(Boolean);
}
export function markdown(doc: MapDocument): string {
  const text = [`# ${md(doc.title)}\n`];
  for (const { node, depth } of rows(doc)) {
    const runs = node.content?.richText;
    const label = runs ? runs.map(run => { let value = md(run.text); if (run.bold) value = `**${value}**`; if (run.italic) value = `*${value}*`; if (run.strike) value = `~~${value}~~`; if (run.underline) value = `<u>${value}</u>`; return value; }).join('') : md(node.text);
    text.push(`${'  '.repeat(depth)}- ${node.content?.todo ? `[${node.content.todo === 'done' ? 'x' : ' '}] ` : ''}${node.content?.sticker ?? ''}${label}\n`);
    details(node, doc).forEach(line => line.split('\n').forEach(part => text.push(`${'  '.repeat(depth + 1)}${md(part)}  \n`)));
    node.content?.attachments?.forEach((asset, index) => text.push(`${'  '.repeat(depth + 1)}${asset.kind === 'image' ? '!' : ''}[${md(asset.name)}](${resourcePath(node, index)})\n`));
  }
  text.push('\n## 联系\n'); doc.relations.forEach(edge => text.push(`- ${md(doc.nodes[edge.from].text)} → ${md(doc.nodes[edge.to].text)}：${md(edge.text)}\n`));
  text.push('\n## 概要与外框\n'); doc.groups.forEach(group => text.push(`- ${group.kind}：${md(group.text)}（${group.nodeIds.map(id => md(doc.nodes[id].text)).join('、')}）\n`));
  return text.join('');
}
export function opml(doc: MapDocument): string {
  const visit = (id: string): string => { const node = doc.nodes[id]; return `<outline text="${xml(node.text)}" _id="${xml(id)}" _note="${xml(details(node, doc).join('\n'))}" _content="${xml(JSON.stringify(node.content ?? {}))}">${node.collapsed ? '' : node.children.map(visit).join('')}</outline>`; };
  return `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>${xml(doc.title)}</title></head><body>${[doc.rootId, ...(doc.freeRoots ?? [])].map(visit).join('')}</body></opml>`;
}
export function zipFiles(files: OutputFile[]): Uint8Array<ArrayBuffer> {
  const entries: Record<string, Uint8Array> = Object.create(null);
  files.forEach(file => { if (file.name.startsWith('/') || file.name.split('/').some(part => part === '..' || !part) || file.name.includes('\\') || Object.hasOwn(entries, file.name)) throw new Error('导出包文件名无效或重复'); entries[file.name] = file.data; });
  return zipSync(entries, { level: 6 });
}
export async function pdfFile(targets: ExportTarget[], options: ExportOptions): Promise<OutputFile> {
  const { PDFDocument } = await import('pdf-lib'); const pdf = await PDFDocument.create(); pdf.setTitle(targets[0].doc.title); pdf.setCreator('Mimicraft');
  for (const target of targets) {
    const image = await raster(target.doc, options.scale); const embedded = await pdf.embedPng(image.data);
    let [w, h] = options.paper === 'letter' ? [612, 792] : [595.28, 841.89]; if (options.landscape) [w, h] = [h, w];
    const page = pdf.addPage([w, h]); const ratio = Math.min((w - 40) / image.width, (h - 40) / image.height);
    page.drawImage(embedded, { x: (w - image.width * ratio) / 2, y: (h - image.height * ratio) / 2, width: image.width * ratio, height: image.height * ratio });
  }
  return { name: '导图.pdf', mime: 'application/pdf', data: await pdf.save() };
}
async function word(target: ExportTarget): Promise<OutputFile> {
  const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = await import('docx'); const doc = target.doc; const image = await raster(doc, 1);
  const ratio = Math.min(600 / image.width, 700 / image.height);
  const paragraphs = [new Paragraph({ text: `${doc.title} · ${target.name}`, heading: HeadingLevel.TITLE }), new Paragraph({ children: [new ImageRun({ type: 'png', data: image.data, transformation: { width: Math.max(1, Math.round(image.width * ratio)), height: Math.max(1, Math.round(image.height * ratio)) } })] })];
  for (const { node, depth } of rows(doc)) {
    const runs = node.content?.richText?.map(run => new TextRun({ text: run.text, bold: run.bold, italics: run.italic, strike: run.strike, underline: run.underline ? {} : undefined, color: run.color?.slice(1) })) ?? [new TextRun({ text: node.text, bold: node.style?.bold })];
    paragraphs.push(new Paragraph({ children: runs, indent: { left: Math.min(depth, 20) * 240 }, spacing: { before: 140, after: 60 } }));
    details(node, doc).forEach(line => paragraphs.push(new Paragraph({ text: line, indent: { left: Math.min(depth + 1, 20) * 240 } })));
    for (const asset of node.content?.attachments ?? []) {
      paragraphs.push(new Paragraph({ text: `资源：${asset.name}` }));
      if (asset.kind === 'image' && /^data:image\/(png|jpeg)/.test(asset.dataUrl)) { const loaded = new Image(); loaded.src = asset.dataUrl; await loaded.decode(); const ratio = Math.min(1, 450 / loaded.naturalWidth, 300 / loaded.naturalHeight); paragraphs.push(new Paragraph({ children: [new ImageRun({ type: asset.dataUrl.startsWith('data:image/png') ? 'png' : 'jpg', data: assetBytes(asset.dataUrl), transformation: { width: Math.max(1, Math.round(loaded.naturalWidth * ratio)), height: Math.max(1, Math.round(loaded.naturalHeight * ratio)) } })] })); }
    }
  }
  doc.relations.forEach(edge => paragraphs.push(new Paragraph({ text: `联系：${doc.nodes[edge.from].text} → ${doc.nodes[edge.to].text}：${edge.text}` })));
  doc.groups.forEach(group => paragraphs.push(new Paragraph({ text: `${group.kind === 'summary' ? '概要' : '外框'}：${group.text}；${group.nodeIds.map(id => doc.nodes[id].text).join('、')}` })));
  const output = await Packer.toBlob(new Document({ sections: [{ children: paragraphs }] })); return { name: '导图.docx', data: new Uint8Array(await output.arrayBuffer()), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}
async function excel(targets: ExportTarget[]): Promise<OutputFile> {
  const { default: ExcelJS } = await import('exceljs'); const workbook = new ExcelJS.Workbook(); workbook.creator = 'Mimicraft';
  for (let index = 0; index < targets.length; index++) {
    const { doc, name } = targets[index]; const sheet = workbook.addWorksheet(`${index + 1}-${name}`.replace(/[\\/*?:\[\]']/g, '_').slice(0, 31));
    sheet.addRow(['节点 ID', '父节点 ID', '层级', '主题', '笔记', '标签', '任务状态', '开始日期', '截止日期', '负责人', '优先级', '进度', '链接类型', '链接内容', 'LaTeX', '标注', '标记', '资源', '样式 JSON']);
    rows(doc).forEach(({ node, parent, depth }) => { const c = node.content; sheet.addRow([node.id, parent, depth, node.text, c?.note ?? '', c?.tags?.join(', ') ?? '', c?.todo ?? '', c?.task?.startDate ?? '', c?.task?.dueDate ?? '', c?.task?.assignee ?? '', c?.task?.priority ?? '', c?.task?.progress ?? '', c?.link?.kind ?? '', c?.link?.value ?? '', c?.equation ?? '', c?.callout ?? '', c?.markers?.join(', ') ?? '', c?.attachments?.map(asset => asset.name).join(', ') ?? '', JSON.stringify(node.style ?? {})]); });
    sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 19 } }; sheet.columns.forEach((column, i) => { column.width = i === 3 || i === 4 ? 40 : 22; }); sheet.getRow(1).font = { bold: true };
    const meta = workbook.addWorksheet(`${index + 1}-关系与分组`); meta.addRow(['类型', 'ID', '来源 / 成员', '目标', '文字', '样式 JSON']);
    doc.relations.forEach(edge => meta.addRow(['联系', edge.id, edge.from, edge.to, edge.text, JSON.stringify(edge.style ?? {})])); doc.groups.forEach(group => meta.addRow([group.kind, group.id, group.nodeIds.join(', '), '', group.text, JSON.stringify(group.style ?? {})]));
    meta.addRow(['画布', name, doc.layout, doc.background]);
  }
  return { name: '导图.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: new Uint8Array(await workbook.xlsx.writeBuffer()) };
}
async function powerpoint(targets: ExportTarget[]): Promise<OutputFile> {
  const { default: PptxGenJS } = await import('pptxgenjs'); const ppt = new PptxGenJS(); ppt.layout = 'LAYOUT_WIDE'; ppt.author = 'Mimicraft'; ppt.subject = '思维导图演说'; ppt.title = targets[0].doc.title; ppt.theme = { headFontFace: 'Microsoft YaHei', bodyFontFace: 'Microsoft YaHei' };
  let slideNumber = 0;
  for (const target of targets) {
    const doc = target.doc; const theme = doc.presentation?.theme ?? 'sage'; const background = ({ sage: 'F4F8EF', ink: 'ECF1F5', paper: 'FAF5EC', night: '202F2A' })[theme]; const color = theme === 'night' ? 'DCE8D2' : '3D594B'; const scale = doc.presentation?.fontScale ?? 1;
    for (const entry of getSlides(doc).filter(slide => !slide.hidden)) {
      const node = doc.nodes[entry.nodeId]; const lines: string[] = [];
      const visit = (id: string, depth = 0) => { const n = doc.nodes[id]; const content = `${'  '.repeat(Math.min(depth, 12))}• ${n.text}${n.content?.todo ? n.content.todo === 'done' ? ' ✓' : ' □' : ''}`; for (const line of content.split('\n')) for (let i = 0; i < Math.max(1, line.length); i += 65) lines.push(line.slice(i, i + 65)); n.children.forEach(child => visit(child, depth + 1)); };
      node.children.forEach(child => visit(child)); if (!lines.length) lines.push(...(node.content?.note || node.text).match(/[^\n]{1,65}|\n/g) || ['']);
      const perPage = Math.max(5, Math.floor(13 / scale)); for (let offset = 0; offset < lines.length; offset += perPage) {
        const slide = ppt.addSlide(); slide.background = { color: background };
        const heading = entry.title || node.text || doc.title; const titleLines = Math.ceil(heading.length / 35); const titleFont = Math.max(14, Math.min(30 * scale, 60 / Math.max(1, titleLines)));
        slide.addText(heading + (offset ? '（续）' : ''), { x: .7, y: .35, w: 12, h: 1.05, fontFace: 'Microsoft YaHei', fontSize: titleFont, bold: true, color, breakLine: false, valign: 'middle', fit: 'shrink' });
        slide.addText(lines.slice(offset, offset + perPage).join('\n'), { x: .8, y: 1.65, w: 11.7, h: 4.9, fontFace: 'Microsoft YaHei', fontSize: 17 * scale, color, margin: 0, breakLine: false, paraSpaceAfter: 5, fit: 'shrink', valign: 'top' });
        slide.addText(`${target.name} · ${++slideNumber}`, { x: .8, y: 7.05, w: 11, h: .2, fontSize: 9, color }); if (entry.notes) slide.addNotes(entry.notes);
      }
    }
  }
  const blob = await ppt.write({ outputType: 'blob', compression: true }) as Blob; return { name: '演说.pptx', data: new Uint8Array(await blob.arrayBuffer()), mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
}
export async function outputFiles(format: ExportFormat, targets: ExportTarget[], options: ExportOptions): Promise<OutputFile[]> {
  if (format === 'pdf') return [await pdfFile(targets, options)];
  const files: OutputFile[] = [];
  if (format === 'xlsx') files.push(await excel(targets));
  if (format === 'pptx') files.push(await powerpoint(targets));
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]; const prefix = `${String(i + 1).padStart(2, '0')}-${safeName(target.name)}`;
    if (format === 'png' || format === 'jpeg') { const image = await raster(target.doc, options.scale, format === 'jpeg'); files.push({ ...image, name: `${prefix}.${format === 'jpeg' ? 'jpg' : 'png'}` }); }
    else if (format === 'svg') files.push({ name: `${prefix}.svg`, data: utf8(diagramSvg(target.doc).text), mime: 'image/svg+xml' });
    else if (format === 'markdown' || format === 'opml' || format === 'textbundle' || format === 'docx') {
      const dir = format === 'textbundle' ? targets.length === 1 ? '' : `${prefix}.textbundle/` : `${prefix}/`;
      if (format === 'docx') files.push({ ...await word(target), name: `${dir}导图.docx` });
      else files.push({ name: `${dir}${format === 'opml' ? '导图.opml' : format === 'textbundle' ? 'text.md' : '导图.md'}`, data: utf8(format === 'opml' ? opml(target.doc) : markdown(target.doc)), mime: 'text/plain;charset=utf-8' });
      files.push(...resourceFiles(target.doc).map(file => ({ ...file, name: dir + file.name })));
      if (format === 'textbundle') files.push({ name: `${dir}info.json`, data: utf8(JSON.stringify({ version: 2, type: 'net.daringfireball.markdown', transient: false, creatorIdentifier: 'org.mimicraft.web' })), mime: 'application/json' });
    }
    if (!['png', 'jpeg', 'svg'].includes(format)) files.push({ name: `${prefix}-完整数据.mimicraft`, data: utf8(serializeDocument(target.doc)), mime: 'application/octet-stream' });
  }
  return files;
}
