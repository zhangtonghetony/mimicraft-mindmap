import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { createDocument, serializeDocument, addRelation, addGroup, setContent, type MapDocument } from '../src/model';
import { addCanvas, switchCanvas } from '../src/workbook';
import { diagramSvg } from '../src/export-core';
import { encryptWorkbook } from '../src/encrypted';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lX8AAAAASUVORK5CYII=', 'base64');
function fixture(): MapDocument {
  let doc = createDocument(); doc.title = 'P4 中文验收'; const [a, b] = doc.nodes[doc.rootId].children; doc.nodes[a].text = '=1+1';
  doc = setContent(doc, a, { note: '中文笔记 & <安全>', tags: ['验收'], callout: '重要标注', equation: 'x^2', todo: 'open', task: { assignee: '自己', progress: 40, dueDate: '2026-10-25' }, attachments: [{ id: 'image1', name: '原始.png', kind: 'image', dataUrl: `data:image/png;base64,${png.toString('base64')}` }] });
  doc = addGroup(addRelation(doc, a, b), [a, b], 'summary'); doc.relations[0].text = '逻辑关联'; doc.groups[0].text = '概要中文';
  doc.presentation = { theme: 'night', fontScale: 1.2, slides: [{ id: 'intro', nodeId: doc.rootId, title: '开场中文', notes: '演说备注中文', hidden: false }, { id: 'hidden', nodeId: a, title: '', notes: '', hidden: true }] }; return doc;
}
async function boot(page: Page, doc?: MapDocument) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  if (doc) { await page.getByLabel('打开导图文件').setInputFiles({ name: '测试.mimicraft', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue(doc.title); }
}
async function capture(page: Page, button: string) { const event = page.waitForEvent('download'); await page.getByRole('button', { name: button, exact: true }).click(); const download = await event; const path = (await download.path())!; return { data: await readFile(path), path, name: download.suggestedFilename() }; }
async function openManager(page: Page, tab: string) { await page.getByRole('button', { name: '文件管理', exact: true }).click(); await page.getByRole('tab', { name: tab, exact: true }).click(); }

test('TC-031 多画布编辑、重排、删除撤销和刷新/文件恢复', async ({ page }) => {
  await boot(page); await page.getByRole('button', { name: '新增画布', exact: true }).click(); await expect(page.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('treeitem').dblclick(); await page.getByRole('textbox', { name: '编辑节点文字' }).fill('第二画布内容'); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await openManager(page, '画布管理'); await page.getByRole('textbox', { name: '画布名称 2' }).fill('第二画布'); await page.getByRole('textbox', { name: '画布名称 2' }).press('Enter');
  await page.getByRole('button', { name: '上移画布 2' }).click(); await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('tab', { name: '画布 1', exact: true }).click(); await expect(page.getByRole('treeitem')).toHaveCount(13);
  await page.getByRole('tab', { name: '第二画布', exact: true }).click(); await expect(page.getByRole('treeitem', { name: '节点：第二画布内容', exact: true })).toBeVisible();
  const file = await capture(page, '下载导图'); expect(JSON.parse(file.data.toString()).schemaVersion).toBe(4);
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('tab', { name: '第二画布' })).toHaveAttribute('aria-selected', 'true');
  await openManager(page, '画布管理'); await page.getByRole('button', { name: '删除画布 第二画布' }).click(); await page.getByRole('button', { name: '完成', exact: true }).click(); await expect(page.getByRole('tab', { name: '第二画布' })).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(page.getByRole('tab', { name: '第二画布' })).toBeVisible();
  await page.getByLabel('打开导图文件').setInputFiles(file.path); await expect(page.getByRole('treeitem', { name: '节点：第二画布内容', exact: true })).toBeVisible();
});

test('TC-032 文件副本、重命名、回收站恢复与合并全部画布', async ({ page }) => {
  await boot(page); await openManager(page, '本地文件'); await page.getByRole('textbox', { name: '文件重命名' }).fill('我的本地文件'); await page.getByRole('button', { name: '应用文件名称' }).click(); await page.getByRole('button', { name: '另存浏览器副本' }).click();
  await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue('我的本地文件 副本');
  await page.getByRole('button', { name: '移到回收站 我的本地文件', exact: true }).click(); await expect(page.getByRole('button', { name: '恢复文件 我的本地文件' })).toBeVisible(); await page.getByRole('button', { name: '恢复文件 我的本地文件' }).click(); await expect(page.getByRole('button', { name: '移到回收站 我的本地文件', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '合并文件', exact: true }).click(); const source = addCanvas(fixture(), '来源第二画布'); await page.getByLabel('选择合并文件').setInputFiles({ name: '合并.mimicraft', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(source)) });
  await page.getByRole('button', { name: '完成', exact: true }).click(); await expect(page.getByRole('tablist', { name: '导图画布' }).getByRole('tab')).toHaveCount(3);
  const result = await capture(page, '下载导图'); expect(JSON.parse(result.data.toString()).document.sheets).toHaveLength(2);
});

test('TC-033 密码文件下载、错误密码保护、正确重开及移除密码', async ({ page }) => {
  await boot(page, fixture()); await openManager(page, '文件密码'); await expect(page.getByRole('dialog', { name: '文件与画布' })).toContainText('自动保存副本不加密');
  await page.getByLabel('下载文件密码').fill('秘密password123'); await page.getByLabel('确认下载密码').fill('秘密password123'); await page.getByRole('button', { name: '启用加密下载' }).click(); await page.getByRole('button', { name: '完成', exact: true }).click();
  const encrypted = await capture(page, '下载导图'); expect(JSON.parse(encrypted.data.toString()).format).toBe('mimicraft-encrypted'); expect(encrypted.data.toString()).not.toContain('中文验收');
  await page.getByLabel('打开导图文件').setInputFiles(encrypted.path); await page.getByLabel('打开文件密码').fill('wrong'); await page.getByRole('button', { name: '解密并打开' }).click(); await expect(page.getByRole('dialog', { name: '打开密码保护文件' })).toContainText('密码错误');
  await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue('P4 中文验收'); await page.getByLabel('打开文件密码').fill('秘密password123'); await page.getByRole('button', { name: '解密并打开' }).click(); await expect(page.getByRole('dialog', { name: '打开密码保护文件' })).toHaveCount(0);
  const plain = await capture(page, '下载导图'); expect(JSON.parse(plain.data.toString()).format).toBe('mimicraft-map');
  await openManager(page, '文件密码'); await page.getByLabel('下载文件密码').fill('newPassword123'); await page.getByLabel('确认下载密码').fill('newPassword123'); await page.getByRole('button', { name: '启用加密下载' }).click(); await page.getByRole('button', { name: '移除下载密码' }).click(); await expect(page.getByRole('dialog', { name: '文件与画布' })).toContainText('未设置密码'); await page.getByRole('button', { name: '完成', exact: true }).click(); expect(JSON.parse((await capture(page, '下载导图')).data.toString()).format).toBe('mimicraft-map');
});

for (const format of ['png', 'jpeg', 'svg', 'pdf', 'markdown', 'opml', 'textbundle', 'docx', 'xlsx', 'pptx']) test(`TC-034～037 ${format} 实际文件生成与解析`, async ({ page }) => {
  test.setTimeout(90000); const doc = fixture(); await boot(page, doc); await page.getByRole('button', { name: '导出与打印' }).click(); await page.getByLabel('导出格式').selectOption(format);
  if (format === 'png') await page.getByLabel('导出倍数').selectOption('2');
  const result = await capture(page, '生成并下载');
  await writeFile(`test-results/generated-${format}.${result.name.split('.').at(-1)}`, result.data);
  if (format === 'png') { expect(result.data.subarray(1, 4).toString()).toBe('PNG'); expect(result.data.readUInt32BE(16)).toBe(diagramSvg(doc).width * 2); }
  else if (format === 'jpeg') expect(result.data.subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
  else if (format === 'svg') { expect(result.data.toString()).toContain('逻辑关联'); expect(result.data.toString()).toContain('xmlns="http://www.w3.org/2000/svg"'); const valid = await page.evaluate(text => !new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror'), result.data.toString()); expect(valid).toBe(true); }
  else if (format === 'pdf') { const pdf = await PDFDocument.load(result.data); expect(pdf.getPageCount()).toBe(1); expect(result.data.subarray(0, 4).toString()).toBe('%PDF'); }
  else {
    const archive = unzipSync(result.data); const paths = Object.keys(archive); expect(paths).toContain('manifest.json'); expect(paths.some(path => path.endsWith('.mimicraft'))).toBe(true);
    if (format === 'markdown') { const path = paths.find(path => path.endsWith('.md'))!; expect(strFromU8(archive[path])).toContain('中文笔记'); expect(paths.some(path => path.includes('/assets/'))).toBe(true); }
    if (format === 'opml') { const text = strFromU8(archive[paths.find(path => path.endsWith('.opml'))!]); expect(text).toContain('中文笔记'); expect(await page.evaluate(text => !new DOMParser().parseFromString(text, 'text/xml').querySelector('parsererror'), text)).toBe(true); }
    if (format === 'textbundle') { expect(JSON.parse(strFromU8(archive['info.json'])).type).toBe('net.daringfireball.markdown'); expect(strFromU8(archive['text.md'])).toContain('中文笔记'); expect(result.name).toMatch(/\.textpack$/); }
    if (format === 'docx') { const bytes = archive[paths.find(path => path.endsWith('.docx'))!]; await writeFile('test-results/generated-native.docx', bytes); const word = unzipSync(bytes); expect(strFromU8(word['word/document.xml'])).toContain('中文笔记'); expect(Object.keys(word).filter(path => path.startsWith('word/media/') && !path.endsWith('/')).length).toBeGreaterThanOrEqual(2); }
    if (format === 'xlsx') { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(archive[paths.find(path => path.endsWith('.xlsx'))!] as any); const sheet = workbook.worksheets[0]; const values = sheet.getColumn(4).values; expect(values).toContain('=1+1'); expect(sheet.rowCount).toBe(14); const cell = sheet.getCell('D3'); expect(cell.type).toBe(ExcelJS.ValueType.String); }
    if (format === 'pptx') { const bytes = archive[paths.find(path => path.endsWith('.pptx'))!]; await writeFile('test-results/generated-native.pptx', bytes); const ppt = unzipSync(bytes); const slides = Object.keys(ppt).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)); expect(slides).toHaveLength(5); expect(strFromU8(ppt['ppt/slides/slide1.xml'])).toContain('开场中文'); expect(strFromU8(ppt['ppt/slides/slide2.xml'])).toContain('（续）'); expect(strFromU8(ppt['ppt/notesSlides/notesSlide1.xml'])).toContain('演说备注中文'); }
  }
  await expect(page.getByRole('status').filter({ hasText: '已生成下载' })).toBeVisible(); await page.screenshot({ path: `test-results/export-${format}.png` });
});

test('TC-035 全部画布 PDF 分页与独立打印预览', async ({ page }) => {
  const doc = switchCanvas(addCanvas(fixture(), '第二页'), 'main'); await boot(page, doc); await page.getByRole('button', { name: '导出与打印' }).click(); await page.getByLabel('导出范围').selectOption('all'); await page.getByLabel('导出格式').selectOption('pdf');
  const file = await capture(page, '生成并下载'); expect((await PDFDocument.load(file.data)).getPageCount()).toBe(2);
  await page.getByRole('button', { name: '打印预览', exact: true }).click(); const frame = page.frameLocator('iframe[title="独立打印页面"]'); await expect(frame.locator('section')).toHaveCount(2); await expect(frame.getByRole('button')).toHaveCount(0); await page.screenshot({ path: 'test-results/print-preview.png' });
  await page.locator('iframe').evaluate((element: HTMLIFrameElement) => { (element.contentWindow as any).printCalled = false; element.contentWindow!.print = () => { (element.contentWindow as any).printCalled = true; }; });
  await page.getByRole('button', { name: '打开打印对话框' }).click(); await expect.poll(() => page.locator('iframe').evaluate((element: HTMLIFrameElement) => (element.contentWindow as any).printCalled)).toBe(true);
});

test('TC-034/038 主分支切图与主题图片原始字节另存', async ({ page }) => {
  await boot(page, fixture()); await page.getByRole('treeitem', { name: '节点：=1+1', exact: true }).click(); await page.getByRole('button', { name: '导出与打印' }).click(); const original = await capture(page, '另存图片 原始.png'); expect(original.data).toEqual(png);
  await page.getByLabel('导出范围').selectOption('branches'); await page.getByLabel('导出格式').selectOption('svg'); const file = await capture(page, '生成并下载'); const archive = unzipSync(file.data); expect(Object.keys(archive).filter(path => path.endsWith('.svg'))).toHaveLength(4);
});

test('TC-038 超大图像明确失败且保留文档，窄屏设置可达', async ({ page }) => {
  const doc = createDocument('blank'); doc.nodes[doc.rootId].text = '长文本'.repeat(3000); doc.nodes[doc.rootId].style = { fontSize: 48, width: 100 }; await boot(page, doc);
  await page.setViewportSize({ width: 780, height: 900 }); await page.getByRole('button', { name: '导出与打印' }).click(); await page.getByRole('button', { name: '生成并下载' }).click(); await expect(page.getByRole('dialog', { name: '导出与打印' }).getByRole('alert')).toContainText('超出');
  await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue(doc.title); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/export-narrow.png' });
});

test('TC-032 加密文件合并为分支及当前文件回收恢复', async ({ page }) => {
  await boot(page); await openManager(page, '合并文件'); await page.getByLabel('合并方式').selectOption('branch'); const source = fixture(); const encrypted = await encryptWorkbook(source, 'mergePassword123');
  await page.getByLabel('选择合并文件').setInputFiles({ name: '加密来源.mimicraft', mimeType: 'application/octet-stream', buffer: Buffer.from(encrypted) }); await page.getByLabel('合并文件密码').fill('wrong'); await page.getByRole('button', { name: '解密并合并' }).click(); await expect(page.getByRole('dialog', { name: '文件与画布' }).getByRole('alert')).toContainText('密码错误'); await expect(page.getByRole('treeitem')).toHaveCount(13);
  await page.getByLabel('合并文件密码').fill('mergePassword123'); await page.getByRole('button', { name: '解密并合并' }).click(); await expect(page.getByRole('treeitem')).toHaveCount(26); await page.getByRole('button', { name: '完成', exact: true }).click();
  const before = await capture(page, '下载导图'); const document = JSON.parse(before.data.toString()).document; expect(document.relations).toHaveLength(1); expect(document.nodes[source.rootId]).toBeUndefined();
  await openManager(page, '本地文件'); await page.getByRole('button', { name: '移到回收站 我的第一张导图', exact: true }).click(); await expect(page.getByRole('button', { name: '恢复文件 我的第一张导图' })).toBeVisible(); await page.getByRole('button', { name: '恢复文件 我的第一张导图' }).click();
  await page.locator('.managed-documents').getByRole('button', { name: /我的第一张导图.*个画布/ }).click(); await expect(page.getByRole('treeitem')).toHaveCount(26);
});

test('TC-037 长演说内容自动续页且尾部文字保留', async ({ page }) => {
  test.setTimeout(60000); const doc = fixture(); doc.nodes[doc.nodes[doc.rootId].children[0]].text = '很长的演说文字'.repeat(200) + '唯一末尾标记'; await boot(page, doc);
  await page.getByRole('button', { name: '导出与打印' }).click(); await page.getByLabel('导出格式').selectOption('pptx'); const output = await capture(page, '生成并下载'); const outer = unzipSync(output.data); const ppt = unzipSync(outer[Object.keys(outer).find(path => path.endsWith('.pptx'))!]);
  const slides = Object.entries(ppt).filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path)); expect(slides.length).toBeGreaterThan(5); const text = await page.evaluate(slides => slides.flatMap(text => [...new DOMParser().parseFromString(text, 'text/xml').getElementsByTagName('a:t')].map(element => element.textContent)).join(''), slides.map(([, value]) => strFromU8(value))); expect(text).toContain('唯一末尾标记');
});
