import { describe, expect, it } from 'vitest';
import { addNode, changeLevel, commit, createDocument, deleteNodes, descendants, editNode, layoutDocument, moveNode, parentOf, parseDocument, redo, serializeDocument, startHistory, toggleCollapse, undo, validateDocument, type MapDocument } from './model';

function blankWithChildren() {
  let doc = createDocument('blank');
  const a = addNode(doc, doc.rootId, 'A'); doc = a.doc;
  const b = addNode(doc, doc.rootId, 'B'); doc = b.doc;
  const c = addNode(doc, a.id, 'C'); doc = c.doc;
  return { doc, a: a.id, b: b.id, c: c.id };
}
function malformed(change: (doc: MapDocument) => void) {
  const { doc } = blankWithChildren(); change(doc);
  return JSON.stringify({ format: 'mimicraft-map', schemaVersion: 2, document: doc });
}

describe('P1 文档合同', () => {
  it('TC-001 原创模板都有唯一根和完整可达树', () => {
    for (const template of ['blank', 'mindmap', 'project'] as const) {
      const doc = createDocument(template);
      expect(validateDocument(doc)).toEqual(doc);
      expect(parentOf(doc, doc.rootId)).toBeUndefined();
      expect(descendants(doc, doc.rootId).length).toBe(Object.keys(doc.nodes).length);
    }
  });
  it('TC-002 添加和文字编辑保留树结构，不修改输入文档', () => {
    const { doc, a } = blankWithChildren(); const snapshot = serializeDocument(doc);
    const added = addNode(doc, a, '细分主题');
    expect(parentOf(added.doc, added.id)).toBe(a);
    const changed = editNode(added.doc, added.id, '中文\n第二行 <script>alert(1)</script>');
    expect(changed.nodes[added.id].text).toContain('\n');
    expect(serializeDocument(doc)).toBe(snapshot);
    expect(editNode(changed, added.id, changed.nodes[added.id].text)).toBe(changed);
    expect(() => editNode(doc, a, 'a'.repeat(10001))).toThrow();
  });
  it('TC-003 删除子树、重叠多选和根保护', () => {
    const { doc, a, b, c } = blankWithChildren();
    const next = deleteNodes(doc, [doc.rootId, a, c]);
    expect(Object.keys(next.nodes).sort()).toEqual([doc.rootId, b].sort());
    expect(validateDocument(next)).toEqual(next);
    expect(deleteNodes(doc, [doc.rootId])).toBe(doc);
  });
  it('TC-003 仅删节点把孩子提升到原序位', () => {
    const { doc, a, b, c } = blankWithChildren();
    const next = deleteNodes(doc, [a], true);
    expect(next.nodes[doc.rootId].children).toEqual([c, b]);
    expect(parentOf(next, c)).toBe(doc.rootId);
    expect(next.nodes[a]).toBeUndefined(); expect(validateDocument(next)).toEqual(next);
  });
  it('TC-004 移动、重排、升降级，不允许移入自身或后代', () => {
    const { doc, a, b, c } = blankWithChildren();
    expect(moveNode(doc, a, c)).toBe(doc);
    expect(moveNode(doc, a, a)).toBe(doc);
    expect(moveNode(doc, doc.rootId, b)).toBe(doc);
    const moved = moveNode(doc, c, b);
    expect(parentOf(moved, c)).toBe(b);
    const promoted = changeLevel(moved, c, 'promote');
    expect(promoted.nodes[doc.rootId].children).toEqual([a, b, c]);
    expect(parentOf(changeLevel(promoted, c, 'demote'), c)).toBe(b);
    expect(moveNode(doc, b, a, 'before').nodes[doc.rootId].children).toEqual([b, a]);
    expect(moveNode(doc, a, b, 'after').nodes[doc.rootId].children).toEqual([b, a]);
    expect(changeLevel(doc, a, 'promote')).toBe(doc);
  });
  it('TC-005 历史往返与分叉，没有变化的操作不记历史', () => {
    const doc = createDocument('blank'); const history = startHistory(doc);
    const edited = commit(history, editNode(doc, doc.rootId, '新的文字'));
    expect(undo(edited).present).toEqual(doc);
    expect(redo(undo(edited)).present).toEqual(edited.present);
    const branch = commit(undo(edited), editNode(doc, doc.rootId, '另一条路径'));
    expect(branch.future).toHaveLength(0);
    expect(commit(history, structuredClone(doc))).toBe(history);
  });
  it('TC-007 自有文件完整往返，导入复制文档 ID 保留节点 ID', () => {
    const { doc } = blankWithChildren();
    expect(parseDocument(serializeDocument(doc), false)).toEqual(doc);
    const copy = parseDocument(serializeDocument(doc));
    expect(copy.id).not.toBe(doc.id); expect(copy.nodes).toEqual(doc.nodes);
  });
  it('TC-008 拒绝损坏 JSON、其他格式、未来版本与未知字段', () => {
    expect(() => parseDocument('{')).toThrow('无法读取');
    expect(() => parseDocument('{}')).toThrow('不是 Mimicraft');
    expect(() => parseDocument('{"format":"mimicraft-map","schemaVersion":999}')).toThrow('版本');
    expect(() => parseDocument(malformed(doc => { Object.assign(doc, { attachments: [] }); }))).toThrow('不支持的字段');
    expect(() => parseDocument(malformed(doc => { Object.assign(doc.nodes[doc.rootId], { relation: 'not-supported' }); }))).toThrow('不支持的字段');
  });
  it('TC-008 拒绝多父、重复边、断链、循环、孤岛与危险键', () => {
    const cases = [
      malformed(doc => { const a = doc.nodes[doc.rootId].children[0]; doc.nodes[doc.rootId].children.push(a); }),
      malformed(doc => { doc.nodes[doc.rootId].children.push('missing'); }),
      malformed(doc => { doc.nodes[doc.nodes[doc.rootId].children[0]].children.push(doc.rootId); }),
      malformed(doc => { doc.nodes[doc.rootId].children = []; }),
      malformed(doc => { doc.nodes[doc.rootId].children.push('__proto__'); }),
    ];
    cases.forEach(text => expect(() => parseDocument(text)).toThrow());
  });
  it('TC-008 层级限制防止过深文件和非法深度移动', () => {
    let doc = createDocument('blank'); let id = doc.rootId;
    for (let i = 0; i < 127; i++) { const added = addNode(doc, id); doc = added.doc; id = added.id; }
    expect(validateDocument(doc)).toEqual(doc);
    expect(() => addNode(doc, id)).toThrow('层级过深');
    const extra = { id: 'extra', text: '', children: [], color: '#000000', collapsed: false, side: 'right' as const };
    doc.nodes[id].children.push(extra.id); doc.nodes[extra.id] = extra;
    expect(() => validateDocument(doc)).toThrow();
  });
  it('TC-010 折叠隐藏布局子树但不丢文件数据，节点矩形不重叠', () => {
    const doc = createDocument('mindmap'); const nodes = layoutDocument(doc);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]; const b = nodes[j];
      const overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
      expect(overlap).toBe(false);
    }
    const folded = toggleCollapse(doc, doc.rootId);
    expect(layoutDocument(folded)).toHaveLength(1);
    expect(Object.keys(parseDocument(serializeDocument(folded)).nodes)).toHaveLength(Object.keys(doc.nodes).length);
  });
  it('TC-003/004 混合 250 次编辑后仍满足唯一父节点与可达性不变量', () => {
    let doc = createDocument('mindmap'); let seed = 41;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 250; i++) {
      const ids = Object.keys(doc.nodes); const id = ids[random() % ids.length]; const target = ids[random() % ids.length];
      const op = i % 5;
      if (op === 0 || ids.length < 4) doc = addNode(doc, id, `节点 ${i}`).doc;
      else if (op === 1) doc = moveNode(doc, id, target, ['child', 'before', 'after'][random() % 3] as 'child' | 'before' | 'after');
      else if (op === 2) doc = deleteNodes(doc, [id], true);
      else if (op === 3) doc = editNode(doc, id, `改写 ${i}`);
      else doc = toggleCollapse(doc, id);
      expect(validateDocument(doc)).toEqual(doc);
    }
  });
});
