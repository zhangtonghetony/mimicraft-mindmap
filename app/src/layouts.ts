import type { MapDocument, PlacedNode } from './model';

type Size = { width: number; height: number };
export function alternativeLayout(doc: MapDocument, sizes: Map<string, Size>): PlacedNode[] | null {
  if (['mindmap', 'logic', 'brace', 'tree'].includes(doc.layout)) return null;
  const gap = doc.preferences?.layoutGap ?? 28;
  const result: PlacedNode[] = [];
  const visibleChildren = (id: string) => doc.nodes[id].collapsed ? [] : doc.nodes[id].children;
  const point = (id: string, x: number, y: number, override?: Partial<Size>) => { const node = doc.nodes[id]; result.push({ id, x, y, ...sizes.get(id)!, ...override, color: node.color, side: 'right' }); };
  const widths = new Map<string, number>();
  const measure = (id: string): number => { const children = visibleChildren(id); const width = Math.max(sizes.get(id)!.width, children.reduce((sum, child) => sum + measure(child), 0) + Math.max(0, children.length - 1) * gap); widths.set(id, width); return width; };
  measure(doc.rootId);
  const vertical = (id: string, x: number, y: number, sign = 1) => {
    const size = sizes.get(id)!; point(id, x, y);
    const children = visibleChildren(id);
    const width = children.reduce((sum, child) => sum + widths.get(child)!, 0) + Math.max(0, children.length - 1) * gap;
    let left = x - width / 2;
    // Every child at this level shares one baseline; tall siblings cannot intrude into descendants.
    const maxChildHeight = Math.max(0, ...children.map(child => sizes.get(child)!.height));
    children.forEach(child => { const childWidth = widths.get(child)!; vertical(child, left + childWidth / 2, y + sign * (size.height / 2 + maxChildHeight / 2 + 70 + gap), sign); left += childWidth + gap; });
  };
  const root = doc.nodes[doc.rootId]; const rootSize = sizes.get(root.id)!;
  if (doc.layout === 'org') vertical(root.id, 0, 0);
  else if (doc.layout === 'timeline' || doc.layout === 'fishbone') {
    point(root.id, 0, 0);
    let offset = rootSize.width / 2 + 100;
    visibleChildren(root.id).forEach((id, i) => {
      const width = widths.get(id)!; const x = offset + width / 2;
      if (doc.layout === 'timeline') vertical(id, x, 0);
      else vertical(id, -x, (i % 2 ? 1 : -1) * (130 + sizes.get(id)!.height / 2), i % 2 ? 1 : -1);
      offset += width + 85 + gap;
    });
  } else if (doc.layout === 'matrix') {
    point(root.id, 0, 0);
    const children = visibleChildren(root.id);
    const columnWidth = new Map<string, number>();
    const list = (id: string, depth = 0): { id: string; depth: number }[] => [{ id, depth }, ...visibleChildren(id).flatMap(child => list(child, depth + 1))];
    children.forEach(id => { columnWidth.set(id, Math.max(...list(id).map(item => sizes.get(item.id)!.width + item.depth * 26)) + 25); });
    const width = children.reduce((sum, id) => sum + columnWidth.get(id)!, 0) + Math.max(0, children.length - 1) * gap;
    let left = -width / 2;
    children.forEach(id => {
      const colWidth = columnWidth.get(id)!; let y = rootSize.height / 2 + 100;
      list(id).forEach(item => { const size = sizes.get(item.id)!; point(item.id, left + size.width / 2 + item.depth * 26, y + size.height / 2); y += size.height + 18; });
      left += colWidth + gap;
    });
  } else if (doc.layout === 'table') {
    let y = 0;
    const rows = (id: string, depth = 0) => {
      const size = sizes.get(id)!; const indent = Math.min(depth, 12) * 25;
      const width = Math.max(size.width, 650 - indent);
      point(id, -325 + indent + width / 2, y + size.height / 2, { width });
      y += size.height + 4;
      visibleChildren(id).forEach(child => rows(child, depth + 1));
    };
    rows(root.id);
    const rootPoint = result[0]; const dy = rootPoint.y; result.forEach(p => { p.y -= dy; });
  } else {
    const ids: string[] = []; const queue = [root.id];
    for (let i = 0; i < queue.length; i++) { const id = queue[i]; ids.push(id); queue.push(...visibleChildren(id)); }
    const columns = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
    const width = Math.max(...ids.map(id => sizes.get(id)!.width)) + 20;
    const heights: number[] = [];
    ids.forEach((id, i) => { const row = Math.floor(i / columns); heights[row] = Math.max(heights[row] ?? 0, sizes.get(id)!.height + 25); });
    const rowTop = heights.map((_, i) => heights.slice(0, i).reduce((sum, height) => sum + height + gap, 0));
    ids.forEach((id, i) => point(id, (i % columns) * (width + gap), rowTop[Math.floor(i / columns)] + sizes.get(id)!.height / 2));
    const dy = result[0].y; result.forEach(p => { p.y -= dy; });
  }
  return result;
}

export function connectionPath(doc: MapDocument, start: PlacedNode, end: PlacedNode): string {
  const style = doc.nodes[end.id].style;
  if (doc.layout === 'org' || doc.layout === 'fishbone' && start.id !== doc.rootId || doc.layout === 'timeline' && start.id !== doc.rootId) {
    const sign = end.y >= start.y ? 1 : -1;
    const y1 = start.y + sign * start.height / 2; const y2 = end.y - sign * end.height / 2;
    return `M ${start.x} ${y1} V ${(y1 + y2) / 2} H ${end.x} V ${y2}`;
  }
  if (doc.layout === 'fishbone') return `M ${start.x - start.width / 2} ${start.y} H ${end.x + 65} L ${end.x} ${end.y - Math.sign(end.y) * end.height / 2}`;
  const sign = end.x >= start.x ? 1 : -1;
  const x1 = start.x + sign * start.width / 2; const x2 = end.x - sign * end.width / 2; const mid = (x1 + x2) / 2;
  if (doc.layout === 'timeline' || style?.line === 'straight') return `M ${x1} ${start.y} L ${x2} ${end.y}`;
  if (doc.layout === 'tree' || style?.line === 'elbow') return `M ${x1} ${start.y} H ${mid} V ${end.y} H ${x2}`;
  if (doc.layout === 'brace') {
    const offset = sign * 12;
    return `M ${x1} ${start.y} H ${mid - offset} Q ${mid} ${start.y} ${mid} ${start.y + (end.y > start.y ? 12 : -12)} L ${mid} ${end.y + (end.y > start.y ? -12 : 12)} Q ${mid} ${end.y} ${mid + offset} ${end.y} H ${x2}`;
  }
  return `M ${x1} ${start.y} C ${mid} ${start.y}, ${mid} ${end.y}, ${x2} ${end.y}`;
}
