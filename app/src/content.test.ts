import { describe, expect, it } from 'vitest';
import { addGroup, addNode, addRelation, commit, createDocument, deleteNodes, duplicateBranch, parseDocument, serializeDocument, setContent, startHistory, undo } from './model';

function fixture() {
  const base = createDocument('blank'); const a = addNode(base, base.rootId, 'A'); const b = addNode(a.doc, base.rootId, 'B');
  return { doc: b.doc, a: a.id, b: b.id };
}
describe('P2 结构与资源合同', () => {
  it('TC-011 联系不允许自身和同向重复；删节点清理并可撤销', () => {
    const { doc, a, b } = fixture(); const linked = addRelation(doc, a, b);
    expect(addRelation(linked, a, a)).toBe(linked);
    expect(addRelation(linked, a, b)).toBe(linked);
    const removed = deleteNodes(linked, [a]); expect(removed.relations).toHaveLength(0);
    expect(undo(commit(startHistory(linked), removed)).present.relations).toEqual(linked.relations);
  });
  it('TC-012 分组去重、删成员收缩、全空移除', () => {
    const { doc, a, b } = fixture();
    const grouped = addGroup(addGroup(doc, [a, b, a], 'summary'), [a], 'boundary');
    expect(grouped.groups[0].nodeIds).toEqual([a, b]);
    const removed = deleteNodes(grouped, [a]); expect(removed.groups).toHaveLength(1); expect(removed.groups[0].nodeIds).toEqual([b]);
    expect(deleteNodes(removed, [b]).groups).toHaveLength(0);
  });
  it('TC-013/014 内容、公式、媒体自包含往返并清理失效主题链接', () => {
    const { doc, a, b } = fixture();
    const next = setContent(doc, a, { note: '笔记\n正文', tags: ['重要'], todo: 'open', link: { kind: 'topic', value: b }, equation: 'E=mc^2', sticker: '💡', illustration: 'plant', attachments: [{ id: 'asset-1', name: '说明.txt', kind: 'file', dataUrl: 'data:application/octet-stream;base64,SGVsbG8=' }] });
    expect(parseDocument(serializeDocument(next), false)).toEqual(next);
    expect(deleteNodes(next, [b]).nodes[a].content?.link).toBeUndefined();
  });
  it('TC-016 v1 迁移只补新集合，不丢文字、方向和稳定节点 ID', () => {
    const { doc } = fixture(); const legacy = structuredClone(doc) as Partial<typeof doc>;
    delete legacy.relations; delete legacy.groups;
    const migrated = parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: 1, document: legacy }), false);
    expect(migrated).toEqual(doc);
    expect(JSON.parse(serializeDocument(migrated)).schemaVersion).toBe(4);
  });
  it('复制分支保留折叠内容，内部链接、联系和分组重映射到副本', () => {
    const { doc, a } = fixture(); const child = addNode(doc, a, '孩子');
    let next = setContent(child.doc, a, { link: { kind: 'topic', value: child.id }, note: '复制的笔记' });
    next = addGroup(addRelation(next, a, child.id), [a, child.id], 'boundary'); next.nodes[a].collapsed = true;
    const copied = duplicateBranch(next, a); const copyChild = copied.doc.nodes[copied.id].children[0];
    expect(copied.doc.nodes[copied.id].collapsed).toBe(true);
    expect(copied.doc.nodes[copied.id].content?.link?.value).toBe(copyChild);
    expect(copied.doc.relations.some(edge => edge.from === copied.id && edge.to === copyChild)).toBe(true);
    expect(copied.doc.groups.some(group => group.nodeIds.includes(copied.id) && group.nodeIds.includes(copyChild))).toBe(true);
    expect(parseDocument(serializeDocument(copied.doc), false)).toEqual(copied.doc);
  });
  it('TC-015/016 拒绝不可信媒体、无效网页和失效引用，不修改旧文档', () => {
    const { doc, a } = fixture(); const original = serializeDocument(doc);
    expect(() => setContent(doc, a, { link: { kind: 'web', value: 'javascript:alert(1)' } })).toThrow();
    expect(() => setContent(doc, a, { attachments: [{ id: 'bad', name: 'bad.svg', kind: 'image', dataUrl: 'data:image/svg+xml;base64,SGVsbG8=' }] })).toThrow();
    expect(() => setContent(doc, a, { link: { kind: 'topic', value: 'missing' } })).toThrow();
    expect(() => setContent(doc, a, { tags: Array.from({ length: 31 }, (_, i) => String(i)) })).toThrow();
    expect(serializeDocument(doc)).toEqual(original);
  });
});
