import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createDocument, serializeDocument, parseDocument, validateDocument, addRelation, addGroup, setContent, commit, startHistory, undo } from './model';
import { addCanvas, canvasData, cloneWorkbook, deleteCanvas, mergeWorkbook, orderedCanvases, renameCanvas, reorderCanvas, switchCanvas } from './workbook';
import { decryptWorkbook, encryptWorkbook } from './encrypted';
import { branchDocument, diagramSvg, exportTargets, type ExportOptions } from './export-core';
import { markdown, opml, resourceFiles, zipFiles } from './export-files';

const options: ExportOptions = { scope: 'all', selectedId: '', scale: 1, folded: false, paper: 'a4', landscape: true };
describe('P4 文档与文件合同', () => {
  it('TC-031 多画布新建、编辑、切换和 v4 往返不混淆内容', () => {
    const first = createDocument(); let doc = addCanvas(first, '第二张'); const secondId = doc.canvasId!;
    doc.nodes[doc.rootId].text = '第二张独立内容'; doc = switchCanvas(doc, 'main'); expect(doc.nodes[doc.rootId].text).toBe(first.nodes[first.rootId].text);
    expect(orderedCanvases(doc).map(canvas => canvas.name)).toEqual(['画布 1', '第二张']);
    doc = switchCanvas(doc, secondId); expect(doc.nodes[doc.rootId].text).toBe('第二张独立内容');
    expect(parseDocument(serializeDocument(doc), false)).toEqual(doc); expect(JSON.parse(serializeDocument(doc)).schemaVersion).toBe(4);
    for (const version of [1, 2, 3]) { const legacy = createDocument('blank'); const data = structuredClone(legacy) as any; if (version === 1) { delete data.relations; delete data.groups; } expect(parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: version, document: data }), false).rootId).toBe(legacy.rootId); }
  });
  it('TC-031 排序、重命名、复制、删除和撤销保持画布与元数据', () => {
    const first = createDocument(); let doc = addCanvas(first, '复制画布', true); const id = doc.canvasId!;
    expect(canvasData(doc)).toEqual(canvasData(first)); doc.nodes[doc.rootId].text = '改动副本'; expect(first.nodes[first.rootId].text).not.toBe('改动副本');
    doc = renameCanvas(doc, id, '我的画布'); doc = reorderCanvas(doc, id, -1); expect(orderedCanvases(doc)[0].name).toBe('我的画布');
    const removed = deleteCanvas(doc, id); expect(orderedCanvases(removed)).toHaveLength(1); expect(undo(commit(startHistory(doc), removed)).present).toEqual(doc);
    expect(() => deleteCanvas(removed, removed.canvasId!)).toThrow('至少保留'); expect(() => renameCanvas(doc, id, '')).toThrow();
  });
  it('TC-031 拒绝递归画布、重复顺序与损坏树', () => {
    const doc = addCanvas(createDocument()); const bad = structuredClone(doc) as any; bad.sheets[0].data.sheets = []; expect(() => validateDocument(bad)).toThrow();
    expect(() => validateDocument({ ...doc, canvasOrder: [doc.canvasId, doc.canvasId] })).toThrow();
    const broken = structuredClone(doc); broken.sheets![0].data.nodes[broken.sheets![0].data.rootId].children.push('missing'); expect(() => validateDocument(broken)).toThrow();
  });
  it('TC-032 副本和两种合并保持来源与内部引用', () => {
    let source = createDocument(); const [a, b] = source.nodes[source.rootId].children;
    source = setContent(source, a, { link: { kind: 'topic', value: b } }); source = addGroup(addRelation(source, a, b), [a, b], 'summary');
    const target = createDocument('blank'); const merged = mergeWorkbook(target, source, 'branch'); const importedRoot = merged.nodes[target.rootId].children[0];
    const [newA, newB] = merged.nodes[importedRoot].children; expect(newA).not.toBe(a); expect(merged.nodes[newA].content?.link?.value).toBe(newB); expect(merged.relations[0].to).toBe(newB);
    expect(Object.keys(target.nodes)).toHaveLength(1); expect(cloneWorkbook(source).id).not.toBe(source.id);
    const workbook = mergeWorkbook(target, addCanvas(source, '第二张'), 'canvases'); expect(orderedCanvases(workbook)).toHaveLength(3); expect(validateDocument(workbook)).toEqual(workbook);
  });
  it('TC-033 加密随机值、正确解密、错密码与密文篡改隔离', async () => {
    const doc = addCanvas(createDocument()); const a = await encryptWorkbook(doc, '测试密码123456'); const b = await encryptWorkbook(doc, '测试密码123456');
    expect(a).not.toBe(b); expect(a).not.toContain('让想法'); expect(await decryptWorkbook(a, '测试密码123456', false)).toEqual(doc);
    await expect(decryptWorkbook(a, 'wrong')).rejects.toThrow('密码错误'); const bad = JSON.parse(a); bad.ciphertext = 'AAAA' + bad.ciphertext.slice(4); await expect(decryptWorkbook(JSON.stringify(bad), '测试密码123456')).rejects.toThrow();
    const parameters = JSON.parse(a); parameters.iterations = 1; await expect(decryptWorkbook(JSON.stringify(parameters), '测试密码123456')).rejects.toThrow(); await expect(encryptWorkbook(doc, '123')).rejects.toThrow('密码长度');
  });
  it('TC-034 输出范围、折叠和原文档不变', () => {
    const doc = addCanvas(createDocument()); const first = switchCanvas(doc, 'main'); first.nodes[first.rootId].collapsed = true; const snapshot = serializeDocument(first);
    const all = exportTargets(first, options); expect(all).toHaveLength(2); expect(all[0].doc.nodes[first.rootId].collapsed).toBe(false);
    expect(exportTargets(first, { ...options, scope: 'current', folded: true })[0].doc.nodes[first.rootId].collapsed).toBe(true);
    const branch = first.nodes[first.rootId].children[0]; expect(Object.keys(branchDocument(first, branch).nodes)).toHaveLength(3);
    expect(exportTargets(first, { ...options, scope: 'branches' })).toHaveLength(4); expect(serializeDocument(first)).toBe(snapshot);
  });
  it('TC-034/036 安全转义与标准内容包含中文/联系/资源', () => {
    let doc = createDocument(); const [a, b] = doc.nodes[doc.rootId].children; doc.nodes[a].text = '<script>alert("x")</script> & 中文';
    doc = addRelation(doc, a, b); doc.relations[0].text = '中文联系'; doc = setContent(doc, a, { note: '笔记 & 细节', equation: 'x^2', attachments: [{ id: 'asset1', name: '../危险.png', kind: 'image', dataUrl: 'data:image/png;base64,AQID' }] });
    const svg = diagramSvg(doc); expect(svg.text).not.toContain('<script>'); expect(svg.text).toContain('&lt;script&gt;'); expect(svg.text).toContain('中文联系'); expect(svg.text).not.toContain('笔记'); expect(svg.width).toBeGreaterThan(0);
    const outline = opml(doc); expect(outline).toContain('<opml version="2.0">'); expect(outline).toContain('&amp;'); expect(markdown(doc)).toContain('笔记');
    const assets = resourceFiles(doc); expect(assets[0].name).not.toContain('危险'); expect(assets[0].data).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('TC-038 ZIP 拒绝目录穿越，实际内容可解包', () => {
    const files = [{ name: '安全/中文.txt', data: new TextEncoder().encode('测试'), mime: 'text/plain' }]; const archive = unzipSync(zipFiles(files)); expect(strFromU8(archive['安全/中文.txt'])).toBe('测试');
    expect(() => zipFiles([{ ...files[0], name: '../outside' }])).toThrow(); expect(() => zipFiles([...files, ...files])).toThrow();
  });
});
