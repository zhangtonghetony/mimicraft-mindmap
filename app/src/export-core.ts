import { descendants, layoutDocument, serializeDocument, type MapDocument, type MapNode } from './model';
import { numbering } from './extended';
import { connectionPath } from './layouts';
import { orderedCanvases } from './workbook';

export type ExportScope = 'current' | 'all' | 'selected' | 'branches';
export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'markdown' | 'opml' | 'textbundle' | 'docx' | 'xlsx' | 'pptx';
export interface ExportOptions { scope: ExportScope; selectedId: string; scale: number; folded: boolean; paper: 'a4' | 'letter'; landscape: boolean }
export interface ExportTarget { name: string; doc: MapDocument }
export interface OutputFile { name: string; data: Uint8Array; mime: string }
export const xml = (text: unknown): string => String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
export const safeName = (text: string) => text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 90) || '导图';
export const utf8 = (text: string) => new TextEncoder().encode(text);
export function branchDocument(doc: MapDocument, rootId: string): MapDocument {
  if (!doc.nodes[rootId]) throw new Error('请先选择一个主题');
  const next = structuredClone(doc); delete next.sheets; delete next.canvasOrder; delete next.canvasId; delete next.canvasName; delete next.presentation;
  const members = new Set(descendants(doc, rootId)); next.rootId = rootId; next.freeRoots = [];
  next.nodes = Object.fromEntries(Object.entries(next.nodes).filter(([id]) => members.has(id)));
  Object.values(next.nodes).forEach(node => { if (node.content?.link?.kind === 'topic' && !members.has(node.content.link.value)) delete node.content.link; });
  next.relations = next.relations.filter(edge => members.has(edge.from) && members.has(edge.to)); next.groups = next.groups.filter(group => group.nodeIds.every(id => members.has(id)));
  serializeDocument(next); return next;
}
export function exportTargets(doc: MapDocument, options: ExportOptions): ExportTarget[] {
  let targets: ExportTarget[];
  if (options.scope === 'all') targets = orderedCanvases(doc).map(canvas => ({ name: canvas.name, doc: canvas.document }));
  else if (options.scope === 'selected') targets = [{ name: doc.nodes[options.selectedId]?.text || '选中分支', doc: branchDocument(doc, options.selectedId) }];
  else if (options.scope === 'branches') targets = [...doc.nodes[doc.rootId].children, ...(doc.freeRoots ?? [])].map(id => ({ name: doc.nodes[id].text || '分支', doc: branchDocument(doc, id) }));
  else targets = [{ name: doc.canvasName ?? '画布 1', doc: orderedCanvases(doc).find(canvas => canvas.id === (doc.canvasId ?? 'main'))!.document }];
  if (!targets.length) throw new Error('没有可导出的分支，请先添加主题');
  return targets.map(target => { if (!options.folded) Object.values(target.doc.nodes).forEach(node => { node.collapsed = false; }); return target; });
}
export function rows(doc: MapDocument): { node: MapNode; parent: string; depth: number }[] {
  const result: { node: MapNode; parent: string; depth: number }[] = [];
  const visit = (id: string, parent = '', depth = 0) => { const node = doc.nodes[id]; result.push({ node, parent, depth }); if (!node.collapsed) node.children.forEach(child => visit(child, id, depth + 1)); };
  [doc.rootId, ...(doc.freeRoots ?? [])].forEach(id => visit(id)); return result;
}
function wrap(text: string, width: number, font: number): string[] {
  const lines: string[] = []; for (const paragraph of text.split('\n')) { let line = ''; let size = 0; for (const c of paragraph) { const w = c.charCodeAt(0) < 256 ? font * .6 : font; if (size + w > width && line) { lines.push(line); line = ''; size = 0; } line += c; size += w; } lines.push(line); } return lines;
}
export function diagramSvg(doc: MapDocument): { text: string; width: number; height: number } {
  const points = layoutDocument(doc); const byId = new Map(points.map(point => [point.id, point])); const labels = numbering(doc);
  const legends = [...doc.relations.filter(edge => byId.has(edge.from) && byId.has(edge.to)).map((edge, i) => ({ key: `R${i + 1}`, id: edge.id, text: edge.text || '联系', color: edge.style?.color ?? '#927eaa' })), ...doc.groups.filter(group => group.nodeIds.some(id => byId.has(id))).map((group, i) => ({ key: `G${i + 1}`, id: group.id, text: group.text || (group.kind === 'summary' ? '概要' : '外框'), color: group.style?.color ?? '#8d9b7c' })), ...points.filter(point => doc.nodes[point.id].content?.equation || doc.nodes[point.id].content?.callout).map((point, i) => { const node = doc.nodes[point.id]; return { key: `N${i + 1}`, id: node.id, text: [node.text, node.content?.callout ? `标注：${node.content.callout}` : '', node.content?.equation ? `LaTeX：${node.content.equation}` : ''].filter(Boolean).join(' · '), color: '#607653' }; })];
  const legendX = Math.max(...points.map(p => p.x + p.width / 2)) + 70;
  const left = Math.min(...points.map(p => p.x - p.width / 2)) - 70; const top = Math.min(...points.map(p => p.y - p.height / 2)) - 200;
  const right = Math.max(...points.map(p => p.x + p.width / 2)) + (legends.length ? 360 : 70); const bottom = Math.max(Math.max(...points.map(p => p.y + p.height / 2)) + 90, top + 200 + legends.reduce((height, entry) => height + wrap(`${entry.key} · ${entry.text}`, 240, 12).length * 18 + 20, 0));
  const width = Math.ceil(right - left); const height = Math.ceil(bottom - top);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}" role="img"><title>${xml(doc.title)}</title><metadata>${xml(JSON.stringify({ generator: 'Mimicraft', layout: doc.layout }))}</metadata><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${doc.background}"/>`];
  for (const group of doc.groups) {
    const members = group.nodeIds.map(id => byId.get(id)).filter(point => !!point); if (!members.length) continue;
    const x = Math.min(...members.map(p => p.x - p.width / 2)) - 16; const y = Math.min(...members.map(p => p.y - p.height / 2)) - 16;
    const w = Math.max(...members.map(p => p.x + p.width / 2)) + 16 - x; const h = Math.max(...members.map(p => p.y + p.height / 2)) + 16 - y;
    const stroke = group.style?.color ?? '#8d9b7c'; const dash = group.style?.dashed ?? group.kind === 'boundary';
    const caption = legends.find(entry => entry.id === group.id)?.key ?? '';
    if (group.kind === 'boundary') parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${group.style?.fill ?? '#eff4e8'}" stroke="${stroke}" stroke-width="${group.style?.width ?? 1.5}" ${dash ? 'stroke-dasharray="6 4"' : ''}/><text x="${x + 6}" y="${y - 6}" font-size="12">${caption}</text>`);
    else parts.push(`<path d="M ${x + w} ${y} q 18 0 18 16 v ${Math.max(0, h / 2 - 32)} l 12 16 l -12 16 v ${Math.max(0, h / 2 - 32)} q 0 16 -18 16" fill="none" stroke="${stroke}" stroke-width="${group.style?.width ?? 1.5}" ${dash ? 'stroke-dasharray="6 4"' : ''}/><text x="${x + w + 36}" y="${y + h / 2}" font-size="12" fill="${stroke}">${caption}</text>`);
  }
  if (!['table', 'matrix', 'grid'].includes(doc.layout)) for (const point of points) for (const child of doc.nodes[point.id].children) {
    const end = byId.get(child); if (end) { const style = doc.nodes[child].style; parts.push(`<path d="${connectionPath(doc, point, end)}" fill="none" stroke="${end.color}" stroke-width="${style?.lineWidth ?? doc.preferences?.branchWidth ?? 2}" ${style?.dashed ? 'stroke-dasharray="6 4"' : ''}/>`); }
  }
  for (const edge of doc.relations) {
    const a = byId.get(edge.from); const b = byId.get(edge.to); if (!a || !b) continue;
    const color = edge.style?.color ?? '#927eaa'; const x = (a.x + b.x) / 2; const y = Math.min(a.y - a.height / 2, b.y - b.height / 2) - 85 + (edge.style?.bend ?? 0); const marker = `arrow-${edge.id}`;
    parts.push(`<defs><marker id="${marker}" orient="auto-start-reverse" markerWidth="6" markerHeight="6" refX="9" refY="5" viewBox="0 0 10 10"><path d="M0 0 L10 5 L0 10Z" fill="${color}"/></marker></defs><path d="M${a.x} ${a.y - a.height / 2} ${edge.style?.curve === 'straight' ? 'L' : `Q${x} ${y}`} ${b.x} ${b.y - b.height / 2}" fill="none" stroke="${color}" stroke-width="${edge.style?.width ?? 1.7}" ${edge.style?.dashed === false ? '' : 'stroke-dasharray="6 4"'} ${edge.style?.arrow === 'none' ? '' : `marker-end="url(#${marker})"`} ${edge.style?.arrow === 'both' ? `marker-start="url(#${marker})"` : ''}/><text x="${x}" y="${edge.style?.curve === 'straight' ? (a.y + b.y) / 2 - 28 : y / 2 + (a.y + b.y) / 4 - 20}" text-anchor="middle" font-size="12" fill="${color}">${legends.find(entry => entry.id === edge.id)?.key ?? ''}</text>`);
  }
  for (const point of [...points].sort((a, b) => (doc.nodes[a.id].z ?? 0) - (doc.nodes[b.id].z ?? 0))) {
    const node = doc.nodes[point.id]; const style = node.style; const root = node.id === doc.rootId; const bold = style?.bold ?? root; const family = style?.fontFamily ?? doc.preferences?.globalFont; const font = style?.fontSize ?? (root ? 20 : 14); const color = style?.textColor ?? (root ? '#ffffff' : '#35443e'); const x = point.x - point.width / 2; const y = point.y - point.height / 2;
    const radius = style?.shape === 'pill' ? 40 : style?.shape === 'rectangle' || doc.layout === 'table' ? 0 : 9;
    parts.push(`<g font-family="${family === 'serif' ? 'serif' : family === 'mono' ? 'monospace' : 'Arial,Microsoft YaHei,sans-serif'}"><rect x="${x}" y="${y}" width="${point.width}" height="${point.height}" rx="${radius}" fill="${style?.shape === 'underline' ? 'none' : style?.fill ?? (root ? '#3b5c4d' : '#f5f8f1')}" stroke="${style?.borderColor ?? node.color}" stroke-width="${style?.borderWidth ?? 1.2}"/>`);
    if (style?.shape === 'underline') { parts.pop(); parts.push(`<g font-family="${family === 'serif' ? 'serif' : family === 'mono' ? 'monospace' : 'Arial,Microsoft YaHei,sans-serif'}"><path d="M${x} ${y + point.height} H${x + point.width}" stroke="${style.borderColor ?? node.color}" stroke-width="${style.borderWidth ?? 2}"/>`); }
    const lines = wrap(`${node.content?.sticker ?? ''}${labels.get(node.id) ?? ''}${node.text}`, point.width - 28, font); let baseline = y + 16 + font;
    let runIndex = 0; let runOffset = 0; const runs = node.content?.richText;
    for (const line of lines) {
      const anchor = style?.align === 'left' ? 'start' : style?.align === 'right' ? 'end' : 'middle'; const tx = anchor === 'start' ? x + 14 : anchor === 'end' ? x + point.width - 14 : point.x;
      let body = xml(line);
      if (runs?.length && !node.content?.sticker && !labels.get(node.id)) {
        body = ''; for (const c of line) { while (runs[runIndex] && runOffset >= runs[runIndex].text.length) { runIndex++; runOffset = 0; } const run = runs[runIndex]; body += `<tspan font-weight="${run?.bold ? '700' : bold ? '700' : '400'}" font-style="${run?.italic ? 'italic' : 'normal'}" text-decoration="${[run?.underline ? 'underline' : '', run?.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}" fill="${run?.color ?? color}">${xml(c)}</tspan>`; runOffset++; }
        while (runs[runIndex] && runOffset >= runs[runIndex].text.length) { runIndex++; runOffset = 0; } if (runs[runIndex]?.text[runOffset] === '\n') runOffset++;
      }
      parts.push(`<text x="${tx}" y="${baseline}" text-anchor="${anchor}" font-size="${font}" font-weight="${bold ? 700 : 400}" font-style="${style?.italic ? 'italic' : 'normal'}" text-decoration="${[style?.underline ? 'underline' : '', style?.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}" fill="${color}">${body}</text>`); baseline += Math.ceil(font * 1.65);
    }
    const reference = legends.find(entry => entry.id === node.id)?.key;
    const extras = [reference ? `[${reference}]` : '', node.content?.todo ? `[${node.content.todo === 'done' ? '✓' : ' '}] ${node.content?.task?.progress ?? (node.content.todo === 'done' ? 100 : 0)}%` : '', node.content?.tags?.map(tag => `#${tag}`).join(' '), node.content?.markers?.join(' '), node.content?.callout, node.content?.equation ? `LaTeX: ${node.content.equation}` : ''].filter(Boolean);
    extras.forEach(text => { const line = wrap(text!, point.width - 20, 10)[0]; if (baseline < y + point.height - 5) { parts.push(`<text x="${x + 10}" y="${baseline}" font-size="10" fill="${root ? '#e4edde' : '#607653'}">${xml(line)}</text>`); baseline += 17; } });
    const asset = node.content?.attachments?.find(item => item.kind === 'image');
    if (asset) parts.push(`<image x="${x + 10}" y="${y + point.height - 74}" width="${point.width - 20}" height="64" preserveAspectRatio="xMidYMid meet" href="${asset.dataUrl}" xlink:href="${asset.dataUrl}"/>`);
    parts.push('</g>');
  }
  for (const edge of doc.relations) { const source = byId.get(edge.from); const label = legends.find(entry => entry.id === edge.id); if (!source || !label) continue; parts.push(`<g font-family="Arial,sans-serif" font-size="11"><rect x="${source.x - 15}" y="${source.y - source.height / 2 - 26}" width="30" height="18" rx="4" fill="${doc.background}"/><text x="${source.x}" y="${source.y - source.height / 2 - 13}" text-anchor="middle" fill="${label.color}">${label.key}</text></g>`); }
  let legendY = top + 200;
  for (const entry of legends) { const lines = wrap(`${entry.key} · ${entry.text}`, 240, 12); parts.push(`<g font-family="Arial,Microsoft YaHei,sans-serif" fill="${entry.color}" font-size="12">`); for (const line of lines) { parts.push(`<text x="${legendX}" y="${legendY}">${xml(line)}</text>`); legendY += 18; } legendY += 20; parts.push('</g>'); }
  parts.push('</svg>'); return { text: parts.join(''), width, height };
}
export async function raster(doc: MapDocument, scale: number, jpeg = false): Promise<OutputFile & { width: number; height: number }> {
  const svg = diagramSvg(doc); const width = Math.ceil(svg.width * scale); const height = Math.ceil(svg.height * scale);
  if (![1, 2, 3].includes(scale) || width > 16384 || height > 16384 || width * height > 40000000) throw new Error('图像超出 16384 像素或 4000 万总像素，请选较小倍数或按主分支切图');
  const url = URL.createObjectURL(new Blob([svg.text], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器无法创建图像画布');
    context.fillStyle = doc.background; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    const mime = jpeg ? 'image/jpeg' : 'image/png'; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('浏览器图像编码失败')), mime, .94));
    canvas.width = canvas.height = 1; return { name: `diagram.${jpeg ? 'jpg' : 'png'}`, data: new Uint8Array(await blob.arrayBuffer()), mime, width, height };
  } finally { URL.revokeObjectURL(url); }
}
export function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
