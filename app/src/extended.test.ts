import { describe, expect, it } from 'vitest';
import { addGroup, addNode, addRelation, commit, createDocument, deleteNodes, duplicateBranch, editNode, layoutDocument, moveNode, parseDocument, serializeDocument, setContent, startHistory, undo, validateDocument } from './model';
import { LAYOUTS, TEMPLATE_CATALOG, numbering, type LayoutType } from './extended';
import { addFreeNode, alignFree, applyPalette, applyStyle, copySelection, detachBranch, pasteSelection, positionNode, resetStyles, setLayer, setRichText } from './operations';
import { connectionPath } from './layouts';

describe('P1–P3 完整合同', () => {
  it('TC-020 旧版本迁移与 v3 全量字段往返', () => {
    let doc = createDocument('project'); const child = doc.nodes[doc.rootId].children[0];
    doc = applyStyle(doc, [child], { fontSize: 22, shape: 'pill', line: 'straight', dashed: true });
    doc = setContent(doc, child, { callout: '重要提示', markers: ['flag'], task: { startDate: '2026-10-21', dueDate: '2026-10-22', priority: 3, progress: 50, reminderAt: '2026-10-22T01:00:00Z' } });
    doc = addFreeNode(doc).doc; doc.preferences = { handDrawn: true, globalFont: 'serif', numbering: 'roman' };
    doc.presentation = { theme: 'night', fontScale: 1.2, slides: [{ id: 's1', nodeId: child, title: '自定义标题', notes: '备注', hidden: false }] };
    const file = serializeDocument(doc); expect(JSON.parse(file).schemaVersion).toBe(4); expect(parseDocument(file, false)).toEqual(doc);
    const legacy = createDocument('blank');
    expect(parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: 2, document: legacy }), false)).toEqual(legacy);
  });
  it('TC-020 拒绝非法样式、富文本错位、日期区间和森林引用', () => {
    const doc = createDocument('blank');
    const changes = [
      () => applyStyle(doc, [doc.rootId], { fill: 'url(javascript:alert(1))' }),
      () => applyStyle(doc, [doc.rootId], { fontSize: 1000 }),
      () => setContent(doc, doc.rootId, { richText: [{ text: '文字不相同' }] }),
      () => setContent(doc, doc.rootId, { task: { startDate: '2026-10-25', dueDate: '2026-10-21' } }),
      () => setContent(doc, doc.rootId, { task: { dueDate: '2026-02-30' } }),
      () => validateDocument({ ...doc, freeRoots: [doc.rootId] }),
      () => validateDocument({ ...doc, freeRoots: ['missing'] }),
    ];
    changes.forEach(change => expect(change).toThrow()); expect(Object.keys(doc.nodes)).toHaveLength(1);
  });
  for (const layout of Object.keys(LAYOUTS) as LayoutType[]) it(`TC-021 ${LAYOUTS[layout]} 保留全部节点且自动矩形不重叠`, () => {
    const doc = createDocument('project'); doc.layout = layout; const snapshot = JSON.stringify(doc.nodes);
    const points = layoutDocument(doc); expect(points).toHaveLength(13);
    expect(new Set(points.map(p => p.id)).size).toBe(13);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i]; const b = points[j];
      expect(Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 0.01).toBe(false);
    }
    expect(JSON.stringify(doc.nodes)).toBe(snapshot);
    doc.nodes[doc.rootId].collapsed = true; expect(layoutDocument(doc)).toHaveLength(1);
  });
  it('TC-021 树形与括号连线路径不同，所有图库模板可验证', () => {
    const doc = createDocument(); const points = layoutDocument(doc); const child = points[1]; const root = points[0];
    const curve = connectionPath(doc, root, child); doc.layout = 'tree'; const tree = connectionPath(doc, root, child); doc.layout = 'brace'; const brace = connectionPath(doc, root, child);
    expect(curve).not.toBe(tree); expect(tree).not.toBe(brace);
    TEMPLATE_CATALOG.forEach(template => expect(() => validateDocument(createDocument(template.id))).not.toThrow());
  });
  it('TC-022 自由主题移动对齐、子树挂接与删除保持可达性', () => {
    let doc = createDocument('blank'); const a = addFreeNode(doc, { x: 450, y: 200 }, '自由 A'); const b = addFreeNode(a.doc, { x: 700, y: 350 }, '自由 B'); doc = b.doc;
    const c = addNode(doc, a.id, '自由的孩子'); doc = c.doc;
    expect(layoutDocument(doc)).toHaveLength(4); expect(validateDocument(doc)).toEqual(doc);
    doc = alignFree(doc, [a.id, b.id], 'left');
    const points = layoutDocument(doc); const pa = points.find(p => p.id === a.id)!; const pb = points.find(p => p.id === b.id)!;
    expect(pa.x - pa.width / 2).toBe(pb.x - pb.width / 2);
    doc = moveNode(doc, a.id, doc.rootId); expect(doc.freeRoots).not.toContain(a.id);
    expect(doc.nodes[doc.rootId].children).toContain(a.id);
    doc = detachBranch(doc, a.id); expect(doc.freeRoots).toContain(a.id);
    const moved = positionNode(doc, a.id, -200, 100); expect(moved.nodes[a.id].position).toEqual({ x: -200, y: 100 });
    const removed = deleteNodes(moved, [a.id], true); expect(removed.freeRoots).toContain(c.id); expect(validateDocument(removed)).toEqual(removed);
    expect(undo(commit(startHistory(moved), removed)).present).toEqual(moved);
  });
  it('TC-023 局部富文本与普通编辑、同级样式应用和重置', () => {
    let doc = createDocument('mindmap'); const [a, b] = doc.nodes[doc.rootId].children;
    doc = setRichText(doc, a, [{ text: '局部', bold: true, color: '#aa0000' }, { text: '富文本', italic: true }]);
    expect(doc.nodes[a].text).toBe('局部富文本'); expect(doc.nodes[a].content?.richText?.[0].bold).toBe(true);
    doc = applyStyle(doc, [a], { fontSize: 24, width: 150, shape: 'rectangle' }, true);
    expect(doc.nodes[b].style?.width).toBe(150); expect(parseDocument(serializeDocument(doc), false)).toEqual(doc);
    expect(editNode(doc, a, '新纯文本').nodes[a].content?.richText).toBeUndefined();
    expect(resetStyles(doc, [a]).nodes[a].style).toBeUndefined();
  });
  it('TC-024 配色/编号与画布设置持久化', () => {
    let doc = createDocument(); doc = applyPalette(doc, ['#000000', '#ffffff'], false); doc.preferences = { ...doc.preferences, numbering: 'decimal', handDrawn: true, globalFont: 'mono', zenTheme: 'night' };
    const [a, b] = doc.nodes[doc.rootId].children; expect(doc.nodes[a].color).toBe(doc.nodes[b].color);
    expect(numbering(doc).get(a)).toBe('1 '); expect(numbering(doc).get(doc.nodes[a].children[0])).toBe('1.1 ');
    expect(parseDocument(serializeDocument(doc), false)).toEqual(doc);
  });
  it('TC-027 跨文档粘贴重映射内部资源、联系/分组，清理外部主题链接', () => {
    let source = createDocument('blank'); const a = addNode(source, source.rootId, 'A'); const b = addNode(a.doc, a.id, 'B'); source = b.doc;
    source = setContent(source, a.id, { link: { kind: 'topic', value: b.id }, markers: ['flag'] });
    source = setContent(source, b.id, { link: { kind: 'topic', value: source.rootId } });
    source = addGroup(addRelation(source, a.id, b.id), [a.id, b.id], 'summary');
    const target = createDocument('blank'); const pasted = pasteSelection(target, target.rootId, copySelection(source, [a.id, b.id]));
    const id = pasted.ids[0]; const child = pasted.doc.nodes[id].children[0];
    expect(pasted.ids).toHaveLength(1); expect(pasted.doc.nodes[id].content?.link?.value).toBe(child); expect(pasted.doc.nodes[child].content?.link).toBeUndefined();
    expect(pasted.droppedLinks).toBe(1); expect(pasted.doc.relations[0].from).toBe(id); expect(pasted.doc.groups[0].nodeIds).toEqual([id, child]);
    expect(validateDocument(pasted.doc)).toEqual(pasted.doc);
    const free = pasteSelection(target, null, copySelection(source, [a.id])); expect(free.doc.freeRoots).toEqual(free.ids);
  });
  it('TC-027 普通多行文本与超限失败原子回滚', () => {
    const doc = createDocument('blank'); const result = pasteSelection(doc, doc.rootId, '第一行\n\n第二行');
    expect(result.ids).toHaveLength(2); expect(Object.keys(doc.nodes)).toHaveLength(1);
    expect(() => pasteSelection(doc, doc.rootId, 'a'.repeat(10001))).toThrow(); expect(Object.keys(doc.nodes)).toHaveLength(1);
  });
  it('TC-028 图层不改变父子或顺序', () => {
    const doc = createDocument(); const [a] = doc.nodes[doc.rootId].children;
    const front = setLayer(doc, [a], true); expect(front.nodes[a].z).toBe(Object.keys(doc.nodes).length - 1);
    expect(front.nodes[doc.rootId].children).toEqual(doc.nodes[doc.rootId].children);
    expect(setLayer(front, [a], false).nodes[a].z).toBe(0);
  });
  it('TC-023 复制分支保留样式且后续修改互不影响', () => {
    let doc = createDocument(); const a = doc.nodes[doc.rootId].children[0];
    doc = applyStyle(doc, [a], { fontSize: 28, fill: '#223344', width: 240 });
    const copy = duplicateBranch(doc, a); expect(copy.doc.nodes[copy.id].style).toEqual(doc.nodes[a].style);
    const changed = applyStyle(copy.doc, [copy.id], { fontSize: 12 });
    expect(changed.nodes[a].style?.fontSize).toBe(28); expect(changed.nodes[copy.id].style?.fontSize).toBe(12);
  });
  it('TC-022 不同宽高的自由主题各方向对齐及等距分布', () => {
    let doc = createDocument('blank'); const ids: string[] = [];
    for (let i = 0; i < 3; i++) { const added = addFreeNode(doc, { x: i * 400, y: i * 300 }); doc = applyStyle(added.doc, [added.id], { width: 120 + i * 70, fontSize: 12 + i * 8 }); ids.push(added.id); }
    for (const mode of ['left', 'right', 'top', 'bottom', 'center-x', 'center-y'] as const) {
      const points = layoutDocument(alignFree(doc, ids, mode)).filter(p => ids.includes(p.id));
      const values = points.map(p => mode === 'left' ? p.x - p.width / 2 : mode === 'right' ? p.x + p.width / 2 : mode === 'top' ? p.y - p.height / 2 : mode === 'bottom' ? p.y + p.height / 2 : mode === 'center-x' ? p.x : p.y);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.001);
    }
    for (const mode of ['distribute-x', 'distribute-y'] as const) {
      const axis = mode === 'distribute-x' ? 'x' : 'y'; const size = axis === 'x' ? 'width' : 'height';
      const points = layoutDocument(alignFree(doc, ids, mode)).filter(p => ids.includes(p.id)).sort((a, b) => a[axis] - b[axis]);
      const gaps = points.slice(1).map((p, i) => p[axis] - p[size] / 2 - points[i][axis] - points[i][size] / 2);
      expect(gaps[0]).toBeCloseTo(gaps[1]);
    }
  });
  it('TC-021 大小不一的深层内容在自动布局及同级对齐时不重叠', () => {
    let doc = createDocument(); const branches = doc.nodes[doc.rootId].children;
    for (let i = 0; i < branches.length; i++) {
      doc = applyStyle(doc, [branches[i]], { fontSize: 12 + i * 10, width: 110 + i * 100 });
      const child = doc.nodes[branches[i]].children[0]; doc = setContent(doc, child, { callout: '多行标注'.repeat(12), equation: 'x^2' });
      const deep = addNode(doc, child, '更深层的长文字'.repeat(8)); doc = applyStyle(deep.doc, [deep.id], { fontSize: 26, width: 180 });
    }
    for (const layout of Object.keys(LAYOUTS) as LayoutType[]) {
      doc.layout = layout; doc.preferences = { alignSiblings: true, layoutGap: 12 };
      const points = layoutDocument(doc);
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        const a = points[i]; const b = points[j];
        expect(Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 0.01, `${layout}: ${a.id}/${b.id}`).toBe(false);
      }
    }
  });
});
