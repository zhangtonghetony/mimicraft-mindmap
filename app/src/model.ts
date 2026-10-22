import { ILLUSTRATIONS, LAYOUTS, TEMPLATE_CATALOG, numbering, validateExtras, type Illustration, type LayoutType, type TextRun, type NodeStyle, type TaskPlan, type Marker, type MapPreferences, type PresentationSettings, type EdgeStyle, type GroupStyle } from './extended';
import { alternativeLayout } from './layouts';
export type Side = 'left' | 'right';
export type Layout = LayoutType;
export type Template = typeof TEMPLATE_CATALOG[number]['id'];
export interface Attachment { id: string; name: string; kind: 'image' | 'audio' | 'file'; dataUrl: string }
export interface NodeContent {
  callout?: string; markers?: Marker[]; task?: TaskPlan; richText?: TextRun[];
  note?: string;
  tags?: string[];
  todo?: 'open' | 'done';
  link?: { kind: 'web' | 'path' | 'topic'; value: string };
  equation?: string;
  sticker?: string;
  illustration?: Illustration;
  attachments?: Attachment[];
}
export interface Relation { id: string; from: string; to: string; text: string; style?: EdgeStyle }
export interface NodeGroup { id: string; kind: 'summary' | 'boundary'; nodeIds: string[]; text: string; style?: GroupStyle }
export interface MapNode {
  style?: NodeStyle; position?: { x: number; y: number }; z?: number;
  id: string;
  text: string;
  children: string[];
  side: Side;
  color: string;
  collapsed: boolean;
  content?: NodeContent;
}
export interface MapDocument {
  canvasId?: string; canvasName?: string; canvasOrder?: string[]; sheets?: { id: string; name: string; data: CanvasData }[];
  preferences?: MapPreferences; freeRoots?: string[]; presentation?: PresentationSettings;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  rootId: string;
  nodes: Record<string, MapNode>;
  layout: Layout;
  background: string;
  relations: Relation[];
  groups: NodeGroup[];
}
export type CanvasData = Pick<MapDocument, 'rootId' | 'nodes' | 'layout' | 'background' | 'relations' | 'groups' | 'preferences' | 'freeRoots' | 'presentation'>;
export interface History { past: MapDocument[]; present: MapDocument; future: MapDocument[] }
export interface PlacedNode { id: string; x: number; y: number; width: number; height: number; color: string; side: Side }
export const COLORS = ['#4e8b77', '#c88752', '#8c7ab8', '#5d8da6', '#c06b7c', '#b2a04b'];
export const MAX_NODES = 5000;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function createDocument(template: Template = 'mindmap'): MapDocument {
  const rootId = uid();
  const timestamp = now();
  const root: MapNode = { id: rootId, text: template === 'project' ? '下一个好项目' : template === 'blank' ? '中心主题' : '让想法，自由生长', children: [], side: 'right', color: '#344c45', collapsed: false };
  const doc: MapDocument = { id: uid(), title: template === 'project' ? '项目计划' : template === 'blank' ? '未命名导图' : '我的第一张导图', createdAt: timestamp, updatedAt: timestamp, rootId, nodes: { [rootId]: root }, layout: 'mindmap', background: '#f7f8f5', relations: [], groups: [] };
  let branches = template === 'project'
    ? [{ text: '目标与愿景', children: ['我们想解决什么？', '怎样衡量成功？'] }, { text: '行动计划', children: ['拆解关键步骤', '确定下一步'] }, { text: '资源与协作', children: ['参与的人', '需要的支持'] }, { text: '回顾与改进', children: ['记录进展', '下一次迭代'] }]
    : template === 'blank' ? [] : [{ text: '捕捉灵感', children: ['记下每一个好想法', '双击节点，开始编辑'] }, { text: '连接思路', children: ['用层级理清脉络', '拖动节点，重新组织'] }, { text: '付诸行动', children: ['从一个小步骤开始', '让想法变成可能'] }, { text: '安心创作', children: ['自动保存在此浏览器', '下载文件，随时带走'] }];
  if (!['blank', 'mindmap', 'project'].includes(template)) {
    const entry = TEMPLATE_CATALOG.find(item => item.id === template)!;
    root.text = entry.center; doc.title = entry.name; doc.layout = entry.layout;
    branches = entry.topics.map(text => ({ text, children: ['补充细节', '下一步行动'] }));
  }
  branches.forEach((branch, i) => {
    const id = uid();
    const side: Side = i < Math.ceil(branches.length / 2) ? 'right' : 'left';
    const node: MapNode = { id, text: branch.text, children: [], side, color: COLORS[i], collapsed: false };
    root.children.push(id); doc.nodes[id] = node;
    branch.children.forEach(text => {
      const child = uid();
      node.children.push(child);
      doc.nodes[child] = { id: child, text, children: [], side, color: COLORS[i], collapsed: false };
    });
  });
  return doc;
}

export function parentOf(doc: MapDocument, id: string): string | undefined {
  return Object.values(doc.nodes).find(node => node.children.includes(id))?.id;
}
export function descendants(doc: MapDocument, id: string): string[] {
  const result: string[] = [];
  const visit = (key: string) => { result.push(key); doc.nodes[key]?.children.forEach(visit); };
  if (doc.nodes[id]) visit(id);
  return result;
}
export function depthOf(doc: MapDocument, id: string): number {
  let depth = 0; let parent = parentOf(doc, id);
  while (parent) { depth++; parent = parentOf(doc, parent); }
  return depth;
}
function balancedSide(doc: MapDocument): Side {
  const children = doc.nodes[doc.rootId].children;
  const left = children.filter(id => doc.nodes[id].side === 'left').length;
  return left < children.length - left ? 'left' : 'right';
}
export function addNode(doc: MapDocument, parentId: string, text = '新主题'): { doc: MapDocument; id: string } {
  if (!doc.nodes[parentId]) throw new Error('找不到父节点');
  if (Object.keys(doc.nodes).length >= MAX_NODES) throw new Error('当前文档已达到 5000 个节点的验证规模，请拆分导图');
  if (depthOf(doc, parentId) >= 127) throw new Error('层级过深，请提升节点后再添加');
  const next = structuredClone(doc); const id = uid(); const parent = next.nodes[parentId];
  const isRoot = parentId === next.rootId;
  next.nodes[id] = { id, text, children: [], side: isRoot ? balancedSide(doc) : parent.side, color: isRoot ? COLORS[parent.children.length % COLORS.length] : parent.color, collapsed: false };
  parent.children.push(id); parent.collapsed = false;
  return { doc: next, id };
}
export function editNode(doc: MapDocument, id: string, text: string): MapDocument {
  if (!doc.nodes[id] || doc.nodes[id].text === text) return doc;
  if (text.length > 10000) throw new Error('节点文字不能超过 10000 个字符');
  const next = structuredClone(doc); next.nodes[id].text = text; if (next.nodes[id].content) delete next.nodes[id].content!.richText; return next;
}
export function deleteNodes(doc: MapDocument, ids: string[], keepChildren = false): MapDocument {
  const selected = new Set(ids.filter(id => id !== doc.rootId && doc.nodes[id]));
  const top = [...selected].filter(id => { let p = parentOf(doc, id); while (p) { if (selected.has(p)) return false; p = parentOf(doc, p); } return true; });
  if (!top.length) return doc;
  const next = structuredClone(doc);
  top.forEach(id => {
    const parentId = parentOf(next, id); const parent = parentId ? next.nodes[parentId] : undefined; const node = next.nodes[id];
    if (parent) {
      const index = parent.children.indexOf(id);
      parent.children.splice(index, 1, ...(keepChildren ? node.children : []));
    } else {
      next.freeRoots = (next.freeRoots ?? []).filter(key => key !== id);
      if (keepChildren) node.children.forEach((child, i) => { next.freeRoots!.push(child); next.nodes[child].position = { x: (node.position?.x ?? 0) + i * 240, y: node.position?.y ?? 0 }; });
    }
    (keepChildren ? [id] : descendants(next, id)).forEach(key => delete next.nodes[key]);
  });
  cleanReferences(next);
  return next;
}
export function cleanReferences(doc: MapDocument) {
  if (doc.presentation) { doc.presentation.slides = doc.presentation.slides.filter(slide => doc.nodes[slide.nodeId]); if (doc.presentation.slides.length && doc.presentation.slides.every(slide => slide.hidden)) doc.presentation.slides[0].hidden = false; }
  doc.relations = doc.relations.filter(edge => doc.nodes[edge.from] && doc.nodes[edge.to]);
  doc.groups = doc.groups.map(group => ({ ...group, nodeIds: group.nodeIds.filter(id => doc.nodes[id]) })).filter(group => group.nodeIds.length);
  Object.values(doc.nodes).forEach(node => {
    if (node.content?.link?.kind === 'topic' && !doc.nodes[node.content.link.value]) delete node.content.link;
  });
}
export function addRelation(doc: MapDocument, from: string, to: string): MapDocument {
  if (from === to || !doc.nodes[from] || !doc.nodes[to] || doc.relations.some(edge => edge.from === from && edge.to === to)) return doc;
  if (doc.relations.length >= 1000) throw new Error('当前版本支持最多 1000 条联系');
  const next = structuredClone(doc); next.relations.push({ id: uid(), from, to, text: '联系' }); return next;
}
export function addGroup(doc: MapDocument, ids: string[], kind: NodeGroup['kind']): MapDocument {
  const members = [...new Set(ids.filter(id => doc.nodes[id]))]; if (!members.length) return doc;
  if (doc.groups.length >= 1000) throw new Error('当前版本支持最多 1000 个概要或外框');
  const next = structuredClone(doc); next.groups.push({ id: uid(), kind, nodeIds: members, text: kind === 'summary' ? '概要' : '外框' }); return next;
}
export function setContent(doc: MapDocument, id: string, content: NodeContent): MapDocument {
  if (!doc.nodes[id]) return doc;
  const next = structuredClone(doc); next.nodes[id].content = content;
  serializeDocument(next); return next;
}
export type DropMode = 'child' | 'before' | 'after';
export function moveNode(doc: MapDocument, id: string, targetId: string, mode: DropMode = 'child'): MapDocument {
  if (id === doc.rootId || !doc.nodes[id] || !doc.nodes[targetId] || descendants(doc, id).includes(targetId)) return doc;
  const parentId = mode === 'child' ? targetId : parentOf(doc, targetId);
  if (!parentId) return doc;
  const subtreeDepth = (key: string): number => Math.max(0, ...doc.nodes[key].children.map(child => 1 + subtreeDepth(child)));
  if (depthOf(doc, parentId) + 1 + subtreeDepth(id) > 127) return doc;
  const next = structuredClone(doc);
  const oldParent = parentOf(doc, id); const old = oldParent ? next.nodes[oldParent] : undefined;
  if (old) old.children = old.children.filter(key => key !== id);
  else next.freeRoots = (next.freeRoots ?? []).filter(key => key !== id);
  delete next.nodes[id].position;
  const parent = next.nodes[parentId];
  const index = mode === 'child' ? parent.children.length : parent.children.indexOf(targetId) + (mode === 'after' ? 1 : 0);
  parent.children.splice(index, 0, id); parent.collapsed = false;
  const side = parentId === doc.rootId ? mode === 'child' ? balancedSide(next) : next.nodes[targetId].side : parent.side;
  descendants(next, id).forEach(key => { next.nodes[key].side = side; });
  return JSON.stringify(next) === JSON.stringify(doc) ? doc : next;
}
export function changeLevel(doc: MapDocument, id: string, direction: 'promote' | 'demote'): MapDocument {
  const parentId = parentOf(doc, id); if (!parentId) return doc;
  if (direction === 'promote') return moveNode(doc, id, parentId, 'after');
  const siblings = doc.nodes[parentId].children; const index = siblings.indexOf(id);
  return index > 0 ? moveNode(doc, id, siblings[index - 1], 'child') : doc;
}
export function duplicateBranch(doc: MapDocument, id: string): { doc: MapDocument; id: string } {
  const parentId = parentOf(doc, id);
  if (!parentId) throw new Error('中心主题不能复制为分支');
  let next = doc; const mapping = new Map<string, string>();
  const copy = (sourceId: string, parent: string): string => {
    const source = doc.nodes[sourceId];
    const added = addNode(next, parent, source.text); next = added.doc; mapping.set(sourceId, added.id);
    next.nodes[added.id].color = source.color;
    if (source.style) next.nodes[added.id].style = structuredClone(source.style);
    if (source.z !== undefined) next.nodes[added.id].z = source.z;
    if (source.content) next.nodes[added.id].content = structuredClone(source.content);
    source.children.forEach(child => copy(child, added.id));
    next.nodes[added.id].collapsed = source.collapsed;
    return added.id;
  };
  const newId = copy(id, parentId);
  for (const newKey of mapping.values()) {
    const link = next.nodes[newKey].content?.link;
    if (link?.kind === 'topic' && mapping.has(link.value)) link.value = mapping.get(link.value)!;
  }
  doc.relations.filter(edge => mapping.has(edge.from) && mapping.has(edge.to)).forEach(edge => next.relations.push({ ...edge, id: uid(), from: mapping.get(edge.from)!, to: mapping.get(edge.to)! }));
  doc.groups.filter(group => group.nodeIds.every(key => mapping.has(key))).forEach(group => next.groups.push({ ...group, id: uid(), nodeIds: group.nodeIds.map(key => mapping.get(key)!) }));
  serializeDocument(next);
  return { doc: next, id: newId };
}
export function toggleCollapse(doc: MapDocument, id: string): MapDocument {
  if (!doc.nodes[id]?.children.length) return doc;
  const next = structuredClone(doc); next.nodes[id].collapsed = !next.nodes[id].collapsed; return next;
}
export function recolor(doc: MapDocument, ids: string[], color: string): MapDocument {
  const next = structuredClone(doc);
  ids.forEach(id => descendants(next, id).forEach(key => { next.nodes[key].color = color; }));
  return next;
}
export function startHistory(doc: MapDocument): History { return { past: [], present: doc, future: [] }; }
export function commit(history: History, next: MapDocument): History {
  if (next === history.present || JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return { past: [...history.past, history.present].slice(-100), present: { ...next, updatedAt: now() }, future: [] };
}
export function undo(history: History): History {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
}
export function redo(history: History): History {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('文件包含此版本尚不支持的字段，未打开以避免丢失内容');
}
function validId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value); }
export function validateDocument(value: unknown): MapDocument {
  const fail = () => { throw new Error('导图文件结构无效或超出支持范围'); };
  if (!object(value)) return fail();
  fields(value, ['id', 'title', 'createdAt', 'updatedAt', 'rootId', 'nodes', 'layout', 'background', 'relations', 'groups', 'preferences', 'freeRoots', 'presentation', 'canvasId', 'canvasName', 'canvasOrder', 'sheets']);
  if (value.canvasId !== undefined && !validId(value.canvasId)) return fail();
  if (value.canvasName !== undefined && (typeof value.canvasName !== 'string' || !value.canvasName.trim() || value.canvasName.length > 100)) return fail();
  if (value.sheets !== undefined) {
    if (!Array.isArray(value.sheets) || value.sheets.length > 99) return fail();
    const canvasIds = new Set([value.canvasId ?? 'main']);
    for (const sheet of value.sheets) {
      if (!object(sheet)) return fail(); fields(sheet, ['id', 'name', 'data']);
      if (!validId(sheet.id) || canvasIds.has(sheet.id) || typeof sheet.name !== 'string' || !sheet.name.trim() || sheet.name.length > 100 || !object(sheet.data)) return fail();
      fields(sheet.data, ['rootId', 'nodes', 'layout', 'background', 'relations', 'groups', 'preferences', 'freeRoots', 'presentation']);
      canvasIds.add(sheet.id);
      validateDocument({ id: value.id, title: value.title, createdAt: value.createdAt, updatedAt: value.updatedAt, ...sheet.data });
    }
  }
  if (value.canvasOrder !== undefined) {
    const expected = new Set([value.canvasId ?? 'main', ...((value.sheets ?? []) as { id: string }[]).map(sheet => sheet.id)]);
    if (!Array.isArray(value.canvasOrder) || value.canvasOrder.length !== expected.size || new Set(value.canvasOrder).size !== expected.size || value.canvasOrder.some(id => !expected.has(id))) return fail();
  }
  if (!validId(value.id) || !validId(value.rootId) || typeof value.title !== 'string' || value.title.length > 200 || !object(value.nodes) || !Object.hasOwn(LAYOUTS, value.layout as string) || typeof value.background !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.background)) return fail();
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))) return fail();
  const nodes = value.nodes;
  const entries = Object.entries(nodes);
  if (!entries.length || entries.length > MAX_NODES || !Object.hasOwn(nodes, value.rootId)) return fail();
  const parentCount = new Map<string, number>();
  for (const [key, node] of entries) {
    if (!validId(key) || !object(node)) return fail();
    fields(node, ['id', 'text', 'children', 'side', 'color', 'collapsed', 'content', 'style', 'position', 'z']);
    if (node.id !== key || typeof node.text !== 'string' || node.text.length > 10000 || !Array.isArray(node.children) || !['left', 'right'].includes(node.side as string) || typeof node.collapsed !== 'boolean' || typeof node.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(node.color)) return fail();
    for (const child of node.children) {
      if (!validId(child) || !Object.hasOwn(nodes, child)) return fail();
      parentCount.set(child, (parentCount.get(child) ?? 0) + 1);
    }
    if (node.content !== undefined) {
      if (!object(node.content)) return fail();
      const content = node.content;
      fields(content, ['note', 'tags', 'todo', 'link', 'equation', 'sticker', 'illustration', 'attachments', 'callout', 'markers', 'task', 'richText']);
      for (const [key, max] of [['note', 10000], ['equation', 2000], ['sticker', 20]] as const) if (content[key] !== undefined && (typeof content[key] !== 'string' || (content[key] as string).length > max)) return fail();
      if (content.tags !== undefined && (!Array.isArray(content.tags) || content.tags.length > 30 || content.tags.some(tag => typeof tag !== 'string' || tag.length > 100))) return fail();
      if (content.todo !== undefined && !['open', 'done'].includes(content.todo as string)) return fail();
      if (content.illustration !== undefined && !(ILLUSTRATIONS as readonly string[]).includes(content.illustration as string)) return fail();
      if (content.link !== undefined) {
        if (!object(content.link)) return fail();
        fields(content.link, ['kind', 'value']);
        if (!['web', 'path', 'topic'].includes(content.link.kind as string) || typeof content.link.value !== 'string' || !content.link.value || content.link.value.length > 2000) return fail();
        if (content.link.kind === 'web') { try { if (!['http:', 'https:'].includes(new URL(content.link.value).protocol)) return fail(); } catch { return fail(); } }
        if (content.link.kind === 'topic' && !Object.hasOwn(nodes, content.link.value)) return fail();
      }
      if (content.attachments !== undefined) {
        if (!Array.isArray(content.attachments) || content.attachments.length > 10) return fail();
        const ids = new Set<string>();
        for (const asset of content.attachments) {
          if (!object(asset)) return fail();
          fields(asset, ['id', 'name', 'kind', 'dataUrl']);
          if (!validId(asset.id) || ids.has(asset.id) || typeof asset.name !== 'string' || asset.name.length > 200 || !['image', 'audio', 'file'].includes(asset.kind as string) || typeof asset.dataUrl !== 'string' || asset.dataUrl.length > 2 * 1024 * 1024 * 4 / 3 + 200) return fail();
          const pattern = asset.kind === 'image' ? /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/]*={0,2}$/ : asset.kind === 'audio' ? /^data:audio\/(webm|ogg|mpeg|mp4|wav|x-wav|aac|flac);base64,[a-zA-Z0-9+/]*={0,2}$/ : /^data:application\/octet-stream;base64,[a-zA-Z0-9+/]*={0,2}$/;
          if (!pattern.test(asset.dataUrl)) return fail();
          ids.add(asset.id);
        }
      }
    }
  }
  const free = value.freeRoots ?? [];
  if (!Array.isArray(free) || free.length > MAX_NODES || new Set(free).size !== free.length || free.some(id => !validId(id) || id === value.rootId || !Object.hasOwn(nodes, id))) return fail();
  const roots = new Set<string>([value.rootId, ...free]);
  if (entries.some(([id]) => roots.has(id) ? (parentCount.get(id) ?? 0) !== 0 : parentCount.get(id) !== 1)) return fail();
  const visited = new Set<string>(); const stack: [string, number][] = [...roots].map(id => [id, 0]);
  while (stack.length) {
    const [id, depth] = stack.pop()!;
    if (visited.has(id) || depth > 127) return fail();
    visited.add(id);
    const node = nodes[id] as unknown as MapNode;
    node.children.forEach(child => stack.push([child, depth + 1]));
  }
  if (visited.size !== entries.length) return fail();
  if (!Array.isArray(value.relations) || value.relations.length > 1000 || !Array.isArray(value.groups) || value.groups.length > 1000) return fail();
  const ids = new Set<string>(); const pairs = new Set<string>();
  for (const edge of value.relations) {
    if (!object(edge)) return fail(); fields(edge, ['id', 'from', 'to', 'text', 'style']);
    if (!validId(edge.id) || ids.has(edge.id) || typeof edge.from !== 'string' || typeof edge.to !== 'string' || edge.from === edge.to || !Object.hasOwn(nodes, edge.from) || !Object.hasOwn(nodes, edge.to) || typeof edge.text !== 'string' || edge.text.length > 1000) return fail();
    if (pairs.has(`${edge.from}:${edge.to}`)) return fail(); pairs.add(`${edge.from}:${edge.to}`);
    ids.add(edge.id);
  }
  for (const group of value.groups) {
    if (!object(group)) return fail(); fields(group, ['id', 'kind', 'nodeIds', 'text', 'style']);
    if (!validId(group.id) || ids.has(group.id) || !['summary', 'boundary'].includes(group.kind as string) || !Array.isArray(group.nodeIds) || !group.nodeIds.length || group.nodeIds.length > MAX_NODES || new Set(group.nodeIds).size !== group.nodeIds.length || group.nodeIds.some(id => typeof id !== 'string' || !Object.hasOwn(nodes, id)) || typeof group.text !== 'string' || group.text.length > 1000) return fail();
    ids.add(group.id);
  }
  validateExtras(value);
  return structuredClone(value) as unknown as MapDocument;
}
export function serializeDocument(doc: MapDocument): string {
  validateDocument(doc);
  const text = JSON.stringify({ format: 'mimicraft-map', schemaVersion: 4, document: doc }, null, 2);
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error('文件超出 8 MB，请拆分导图后下载');
  return text;
}
export function parseDocument(text: string, asCopy = true): MapDocument {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error('文件超过 8 MB，暂不支持打开');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('无法读取文件，请选择有效的 .mimicraft 文件'); }
  if (!object(value) || value.format !== 'mimicraft-map') throw new Error('这不是 Mimicraft 导图文件，请选择有效的 .mimicraft 文件');
  if (![1, 2, 3, 4].includes(value.schemaVersion as number)) throw new Error('暂不支持此文件版本，请使用兼容版本的 Mimicraft 打开');
  fields(value, ['format', 'schemaVersion', 'document']);
  if (value.schemaVersion === 1) {
    if (!object(value.document) || !object(value.document.nodes)) throw new Error('旧版文件结构无效');
    fields(value.document, ['id', 'title', 'createdAt', 'updatedAt', 'rootId', 'nodes', 'layout', 'background']);
    for (const node of Object.values(value.document.nodes)) {
      if (!object(node)) throw new Error('旧版主题结构无效');
      fields(node, ['id', 'text', 'children', 'side', 'color', 'collapsed']);
    }
    value.document = { ...value.document, relations: [], groups: [] };
  }
  const doc = validateDocument(value.document);
  return asCopy ? { ...doc, id: uid(), updatedAt: now() } : doc;
}

export function nodeSize(text: string, root = false, style?: NodeStyle): { width: number; height: number } {
  const font = style?.fontSize ?? (root ? 20 : 14);
  const limit = style?.width ? Math.max(50, style.width - (root ? 64 : 48)) : root ? 240 : 210;
  let lines = 0; let max = 0;
  for (const line of text.split('\n')) {
    let width = 0;
    for (const c of line) width += (/[\u0000-\u00ff]/.test(c) ? font * 0.6 : font) * (style?.bold ? 1.06 : 1);
    lines += Math.max(1, Math.ceil(width / limit)); max = Math.max(max, width);
  }
  return { width: style?.width ?? Math.max(root ? 190 : 100, Math.min(limit, max) + (root ? 64 : 48)), height: Math.max(root ? 68 : 44, lines * Math.ceil(font * 1.65) + (root ? 28 : 20)) };
}
export function layoutDocument(doc: MapDocument): PlacedNode[] {
  let result: PlacedNode[] = [];
  const labels = numbering(doc); const gap = doc.preferences?.layoutGap ?? 22;
  const root = doc.nodes[doc.rootId]; const sizes = new Map<string, { width: number; height: number }>();
  const heights = new Map<string, number>();
  const measure = (id: string): number => {
    const node = doc.nodes[id]; const size = nodeSize(`${node.content?.sticker ? `${node.content.sticker} ` : ''}${node.content?.illustration ? '  ' : ''}${labels.get(id) ?? ''}${node.text}`, id === doc.rootId, node.style);
    if (node.content && Object.keys(node.content).length) { size.height += 24; if (!node.style?.width) size.width = Math.max(size.width, 180); }
    if (node.content?.attachments?.some(asset => asset.kind === 'image')) size.height += 78;
    if (node.content?.equation) size.height += 60;
    if (node.content?.callout) size.height += Math.min(100, Math.ceil(node.content.callout.length / 18) * 16 + 16);
    if (doc.layout === 'grid' && id !== doc.rootId) size.height += 16;
    sizes.set(id, size);
    const children = node.collapsed ? [] : node.children;
    const total = children.reduce((sum, child) => sum + measure(child), 0) + Math.max(0, children.length - 1) * gap;
    const height = Math.max(size.height + 12, total); heights.set(id, height); return height;
  };
  measure(doc.rootId); (doc.freeRoots ?? []).forEach(measure);
  const place = (id: string, x: number, y: number, side: Side) => {
    const node = doc.nodes[id]; const size = sizes.get(id)!;
    result.push({ id, x, y, ...size, color: node.color, side });
    const children = node.collapsed ? [] : node.children;
    const total = children.reduce((s, child) => s + heights.get(child)!, 0) + Math.max(0, children.length - 1) * gap;
    let top = y - total / 2;
    children.forEach(child => {
      const childSize = sizes.get(child)!; const height = heights.get(child)!;
      place(child, x + (side === 'right' ? 1 : -1) * (size.width / 2 + childSize.width / 2 + 68), top + height / 2, side);
      top += height + gap;
    });
  };
  result.push({ id: root.id, x: 0, y: 0, ...sizes.get(root.id)!, color: root.color, side: 'right' });
  if (!root.collapsed) for (const side of ['left', 'right'] as const) {
    const children = root.children.filter(id => (doc.layout !== 'mindmap' ? 'right' : doc.nodes[id].side) === side);
    const total = children.reduce((sum, child) => sum + heights.get(child)!, 0) + Math.max(0, children.length - 1) * 36;
    let top = -total / 2;
    children.forEach(child => {
      const size = sizes.get(child)!; const height = heights.get(child)!;
      place(child, (side === 'right' ? 1 : -1) * (sizes.get(root.id)!.width / 2 + size.width / 2 + 88), top + height / 2, side);
      top += height + 36;
    });
  }
  const alternate = alternativeLayout(doc, sizes);
  if (alternate) result = alternate;
  (doc.freeRoots ?? []).forEach((id, i) => { const pos = doc.nodes[id].position ?? { x: 600 + i * 320, y: 400 }; place(id, pos.x, pos.y, 'right'); });
  if (doc.preferences?.alignSiblings && ['mindmap', 'logic', 'brace', 'tree'].includes(doc.layout)) {
    const main = new Set(descendants(doc, doc.rootId)); const widths = new Map<string, number>(); const centers = new Map<string, number>();
    result.forEach(point => { if (!main.has(point.id) || point.id === doc.rootId) return; const key = `${point.side}:${depthOf(doc, point.id)}`; widths.set(key, Math.max(widths.get(key) ?? 0, point.width)); });
    for (const side of ['left', 'right'] as const) {
      let previousWidth = sizes.get(doc.rootId)!.width; let center = 0;
      for (let depth = 1; depth <= 127; depth++) { const key = `${side}:${depth}`; const width = widths.get(key); if (!width) break; center += previousWidth / 2 + width / 2 + 68; centers.set(key, center); previousWidth = width; }
    }
    result.forEach(point => { if (!main.has(point.id) || point.id === doc.rootId) return; const key = `${point.side}:${depthOf(doc, point.id)}`; point.x = (point.side === 'left' ? -1 : 1) * (centers.get(key) ?? Math.abs(point.x)); });
  }
  if (doc.preferences?.freeBranch) for (const point of [...result]) {
    const pos = doc.nodes[point.id].position; if (!pos || point.id === doc.rootId || doc.freeRoots?.includes(point.id)) continue;
    const members = new Set(descendants(doc, point.id)); const dx = pos.x - point.x; const dy = pos.y - point.y;
    result.forEach(p => { if (members.has(p.id)) { p.x += dx; p.y += dy; } });
  }
  return result;
}
