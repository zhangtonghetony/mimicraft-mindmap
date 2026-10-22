import { addNode, cleanReferences, createDocument, deleteNodes, descendants, layoutDocument, parentOf, parseDocument, serializeDocument, type MapDocument } from './model';
import { PALETTES, type NodeStyle, type TextRun } from './extended';

export function addFreeNode(doc: MapDocument, position = { x: 500, y: 300 }, text = '自由主题'): { doc: MapDocument; id: string } {
  const added = addNode(doc, doc.rootId, text); const next = added.doc;
  next.nodes[next.rootId].children = next.nodes[next.rootId].children.filter(id => id !== added.id);
  next.freeRoots = [...(next.freeRoots ?? []), added.id]; next.nodes[added.id].position = position;
  serializeDocument(next); return added;
}
export function detachBranch(doc: MapDocument, id: string): MapDocument {
  if (id === doc.rootId || !doc.nodes[id] || doc.freeRoots?.includes(id)) return doc;
  const next = structuredClone(doc); const parent = parentOf(doc, id); if (!parent) return doc;
  next.nodes[parent].children = next.nodes[parent].children.filter(child => child !== id);
  next.freeRoots = [...(next.freeRoots ?? []), id]; const point = layoutDocument(doc).find(item => item.id === id);
  next.nodes[id].position = { x: point?.x ?? 500, y: point?.y ?? 300 }; return next;
}
export function positionNode(doc: MapDocument, id: string, x: number, y: number): MapDocument {
  if (id === doc.rootId || !doc.nodes[id] || !(doc.freeRoots?.includes(id) || doc.preferences?.freeBranch)) return doc;
  const next = structuredClone(doc); next.nodes[id].position = { x: Math.max(-100000, Math.min(100000, x)), y: Math.max(-100000, Math.min(100000, y)) }; return next;
}
export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y' | 'distribute-x' | 'distribute-y';
export function alignFree(doc: MapDocument, ids: string[], mode: Alignment): MapDocument {
  const points = layoutDocument(doc).filter(point => ids.includes(point.id) && doc.freeRoots?.includes(point.id));
  if (points.length < 2) return doc;
  const next = structuredClone(doc);
  const left = Math.min(...points.map(p => p.x - p.width / 2)); const right = Math.max(...points.map(p => p.x + p.width / 2));
  const top = Math.min(...points.map(p => p.y - p.height / 2)); const bottom = Math.max(...points.map(p => p.y + p.height / 2));
  if (mode.startsWith('distribute')) {
    const axis = mode === 'distribute-x' ? 'x' : 'y'; const dimension = axis === 'x' ? 'width' : 'height';
    points.sort((a, b) => a[axis] - b[axis]);
    const start = points[0][axis] - points[0][dimension] / 2; const last = points.at(-1)!;
    const span = last[axis] + last[dimension] / 2 - start;
    const gap = (span - points.reduce((sum, p) => sum + p[dimension], 0)) / (points.length - 1);
    let current = start;
    points.forEach(p => { next.nodes[p.id].position = { x: p.x, y: p.y, [axis]: current + p[dimension] / 2 }; current += p[dimension] + gap; });
  } else points.forEach(p => {
    next.nodes[p.id].position = {
      x: mode === 'left' ? left + p.width / 2 : mode === 'right' ? right - p.width / 2 : mode === 'center-x' ? (left + right) / 2 : p.x,
      y: mode === 'top' ? top + p.height / 2 : mode === 'bottom' ? bottom - p.height / 2 : mode === 'center-y' ? (top + bottom) / 2 : p.y,
    };
  });
  return next;
}
export function applyStyle(doc: MapDocument, ids: string[], style: NodeStyle, siblings = false, replace = false): MapDocument {
  const next = structuredClone(doc); const targets = new Set(ids);
  if (siblings) ids.forEach(id => { const parent = parentOf(doc, id); (parent ? doc.nodes[parent].children : doc.freeRoots?.includes(id) ? doc.freeRoots : [id])?.forEach(key => targets.add(key)); });
  targets.forEach(id => { if (next.nodes[id]) next.nodes[id].style = replace ? structuredClone(style) : { ...next.nodes[id].style, ...style }; });
  serializeDocument(next); return next;
}
export function setRichText(doc: MapDocument, id: string, runs: TextRun[]): MapDocument {
  const next = structuredClone(doc); const node = next.nodes[id]; if (!node) return doc;
  node.text = runs.map(run => run.text).join(''); node.content = { ...node.content, richText: runs };
  serializeDocument(next); return next;
}
export function applyPalette(doc: MapDocument, colors: string[], rainbow = true): MapDocument {
  const next = structuredClone(doc); next.preferences = { ...next.preferences, palette: [...colors], rainbow };
  [...next.nodes[next.rootId].children, ...(next.freeRoots ?? [])].forEach((id, i) => descendants(next, id).forEach(key => { next.nodes[key].color = colors[rainbow ? i % colors.length : 0]; }));
  serializeDocument(next); return next;
}
export function balanceBranches(doc: MapDocument): MapDocument {
  const next = structuredClone(doc); let left = 0; let right = 0;
  next.nodes[next.rootId].children.forEach(id => { const members = descendants(next, id); const side = left < right ? 'left' : 'right'; members.forEach(key => { next.nodes[key].side = side; delete next.nodes[key].position; }); if (side === 'left') left += members.length; else right += members.length; });
  return next;
}
export function setLayer(doc: MapDocument, ids: string[], front: boolean): MapDocument {
  const next = structuredClone(doc); const ordered = Object.values(next.nodes).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const selected = ordered.filter(node => ids.includes(node.id)); const rest = ordered.filter(node => !ids.includes(node.id));
  (front ? [...rest, ...selected] : [...selected, ...rest]).forEach((node, i) => { node.z = i; }); return next;
}
export function topSelections(doc: MapDocument, ids: string[]): string[] {
  const selected = new Set(ids.filter(id => doc.nodes[id]));
  return [...selected].filter(id => { let p = parentOf(doc, id); while (p) { if (selected.has(p)) return false; p = parentOf(doc, p); } return true; });
}
export function copySelection(doc: MapDocument, ids: string[]): string {
  const selected = topSelections(doc, ids); if (!selected.length) throw new Error('请先选择主题');
  const shell = createDocument('blank'); shell.nodes[shell.rootId].children = selected;
  const members = new Set(selected.flatMap(id => descendants(doc, id)));
  let droppedLinks = 0;
  for (const id of members) {
    shell.nodes[id] = structuredClone(doc.nodes[id]); delete shell.nodes[id].position;
    const link = shell.nodes[id].content?.link;
    if (link?.kind === 'topic' && !members.has(link.value)) { delete shell.nodes[id].content!.link; droppedLinks++; }
  }
  shell.relations = doc.relations.filter(edge => members.has(edge.from) && members.has(edge.to));
  shell.groups = doc.groups.filter(group => group.nodeIds.every(id => members.has(id)));
  const parsed = JSON.parse(serializeDocument(shell));
  return JSON.stringify({ format: 'mimicraft-clipboard', version: 1, document: parsed.document, droppedLinks });
}
export function pasteSelection(doc: MapDocument, targetId: string | null, text: string): { doc: MapDocument; ids: string[]; droppedLinks: number } {
  if (targetId && !doc.nodes[targetId]) throw new Error('目标主题不存在');
  if (new TextEncoder().encode(text).length > 8 * 1024 * 1024) throw new Error('剪贴板内容超过 8 MB');
  let payload: unknown; try { payload = JSON.parse(text); } catch { /* Plain text is supported. */ }
  if (!payload || typeof payload !== 'object' || (payload as { format?: string }).format !== 'mimicraft-clipboard') {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean); if (!lines.length) throw new Error('剪贴板没有可粘贴的内容');
    let next = doc; const ids: string[] = [];
    lines.forEach((line, i) => { const added = targetId ? addNode(next, targetId, line) : addFreeNode(next, { x: 500 + i * 30, y: 300 + i * 85 }, line); next = added.doc; ids.push(added.id); });
    serializeDocument(next); return { doc: next, ids, droppedLinks: 0 };
  }
  const p = payload as { version: number; document: unknown; droppedLinks?: number };
  if (p.version !== 1) throw new Error('不支持此剪贴板版本');
  const source = parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: 3, document: p.document }), false);
  const roots = source.nodes[source.rootId].children; const next = structuredClone(doc); const mapping = new Map<string, string>();
  Object.keys(source.nodes).filter(id => id !== source.rootId).forEach(id => mapping.set(id, crypto.randomUUID()));
  for (const [oldId, newId] of mapping) {
    const node = structuredClone(source.nodes[oldId]); node.id = newId; node.children = node.children.map(id => mapping.get(id)!); delete node.position;
    if (targetId) node.side = next.nodes[targetId].side;
    const link = node.content?.link; if (link?.kind === 'topic') { if (mapping.has(link.value)) link.value = mapping.get(link.value)!; else delete node.content!.link; }
    next.nodes[newId] = node;
  }
  const ids = roots.map(id => mapping.get(id)!);
  if (targetId) { next.nodes[targetId].children.push(...ids); next.nodes[targetId].collapsed = false; }
  else { next.freeRoots = [...(next.freeRoots ?? []), ...ids]; ids.forEach((id, i) => { next.nodes[id].position = { x: 500 + i * 260, y: 300 }; }); }
  source.relations.forEach(edge => next.relations.push({ ...edge, id: crypto.randomUUID(), from: mapping.get(edge.from)!, to: mapping.get(edge.to)! }));
  source.groups.forEach(group => next.groups.push({ ...group, id: crypto.randomUUID(), nodeIds: group.nodeIds.map(id => mapping.get(id)!) }));
  cleanReferences(next); serializeDocument(next);
  return { doc: next, ids, droppedLinks: p.droppedLinks ?? 0 };
}
export function resetStyles(doc: MapDocument, ids: string[]): MapDocument {
  const next = structuredClone(doc); const palette = next.preferences?.palette ?? PALETTES[0].colors;
  ids.forEach(id => { if (!next.nodes[id]) return; delete next.nodes[id].style; if (next.nodes[id].content) delete next.nodes[id].content!.richText; next.nodes[id].color = parentOf(next, id) ? next.nodes[parentOf(next, id)!].color : palette[0]; }); return next;
}
export function removeSelected(doc: MapDocument, ids: string[]): MapDocument { return deleteNodes(doc, ids.filter(id => id !== doc.rootId)); }
