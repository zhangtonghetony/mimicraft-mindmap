import { createDocument, parseDocument, serializeDocument, type CanvasData, type MapDocument } from './model';
import { copySelection, pasteSelection } from './operations';

const canvasKeys = ['rootId', 'nodes', 'layout', 'background', 'relations', 'groups', 'preferences', 'freeRoots', 'presentation'] as const;
export function canvasData(doc: MapDocument): CanvasData {
  return Object.fromEntries(canvasKeys.filter(key => doc[key] !== undefined).map(key => [key, structuredClone(doc[key])])) as unknown as CanvasData;
}
export function canvases(doc: MapDocument): { id: string; name: string; document: MapDocument }[] {
  const base = { id: doc.id, title: doc.title, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  return [{ id: doc.canvasId ?? 'main', name: doc.canvasName ?? '画布 1', document: { ...base, ...canvasData(doc) } }, ...(doc.sheets ?? []).map(sheet => ({ id: sheet.id, name: sheet.name, document: { ...base, ...structuredClone(sheet.data) } }))];
}
export function switchCanvas(doc: MapDocument, id: string): MapDocument {
  if (id === (doc.canvasId ?? 'main')) return doc;
  const target = doc.sheets?.find(sheet => sheet.id === id); if (!target) throw new Error('画布不存在');
  const next = { ...doc }; canvasKeys.forEach(key => { delete (next as unknown as Record<string, unknown>)[key]; });
  Object.assign(next, structuredClone(target.data)); next.canvasId = target.id; next.canvasName = target.name;
  next.canvasOrder = orderedCanvases(doc).map(canvas => canvas.id);
  next.sheets = [{ id: doc.canvasId ?? 'main', name: doc.canvasName ?? '画布 1', data: canvasData(doc) }, ...doc.sheets!.filter(sheet => sheet.id !== id)];
  // Keep the stable tab order independently of which canvas is active.
  next.sheets.sort((a, b) => orderOf(doc, a.id) - orderOf(doc, b.id)); serializeDocument(next); return next;
}
function orderOf(doc: MapDocument, id: string): number { return (doc.canvasOrder ?? [doc.canvasId ?? 'main', ...(doc.sheets ?? []).map(sheet => sheet.id)]).indexOf(id); }
export function orderedCanvases(doc: MapDocument) { return canvases(doc).sort((a, b) => orderOf(doc, a.id) - orderOf(doc, b.id)); }
export function addCanvas(doc: MapDocument, name = '新画布', duplicate = false): MapDocument {
  const data = duplicate ? canvasData(doc) : canvasData(createDocument('blank')); const id = crypto.randomUUID();
  const next = structuredClone(doc); next.canvasOrder = [...orderedCanvases(doc).map(canvas => canvas.id), id]; next.sheets = [...(next.sheets ?? []), { id, name: name.trim().slice(0, 100) || '新画布', data }];
  return switchCanvas(next, id);
}
export function renameCanvas(doc: MapDocument, id: string, name: string): MapDocument {
  if (!name.trim() || name.length > 100) throw new Error('画布名称需为 1～100 个字符');
  const next = structuredClone(doc); if (id === (doc.canvasId ?? 'main')) next.canvasName = name.trim(); else { const sheet = next.sheets?.find(item => item.id === id); if (!sheet) throw new Error('画布不存在'); sheet.name = name.trim(); } return next;
}
export function deleteCanvas(doc: MapDocument, id: string): MapDocument {
  const list = orderedCanvases(doc); if (list.length === 1) throw new Error('至少保留一个画布');
  const next = id === (doc.canvasId ?? 'main') ? switchCanvas(doc, list.find(canvas => canvas.id !== id)!.id) : structuredClone(doc);
  next.sheets = next.sheets?.filter(sheet => sheet.id !== id); next.canvasOrder = list.map(canvas => canvas.id).filter(key => key !== id); serializeDocument(next); return next;
}
export function reorderCanvas(doc: MapDocument, id: string, offset: number): MapDocument {
  const ids = orderedCanvases(doc).map(canvas => canvas.id); const index = ids.indexOf(id); const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return doc;
  [ids[index], ids[target]] = [ids[target], ids[index]]; return { ...doc, canvasOrder: ids };
}
export function cloneWorkbook(doc: MapDocument): MapDocument { return parseDocument(serializeDocument({ ...doc, title: `${doc.title} 副本`.slice(0, 200) })); }
export function mergeWorkbook(doc: MapDocument, source: MapDocument, mode: 'canvases' | 'branch'): MapDocument {
  if (mode === 'branch') return pasteSelection(doc, doc.rootId, copySelection(source, [source.rootId, ...(source.freeRoots ?? [])])).doc;
  const next = structuredClone(doc); const incoming = orderedCanvases(source).map(canvas => ({ id: crypto.randomUUID(), name: `${source.title} · ${canvas.name}`.slice(0, 100), data: canvasData(canvas.document) }));
  next.canvasOrder = [...orderedCanvases(doc).map(canvas => canvas.id), ...incoming.map(canvas => canvas.id)]; next.sheets = [...(next.sheets ?? []), ...incoming]; serializeDocument(next); return next;
}
