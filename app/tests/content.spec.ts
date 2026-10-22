import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const node = (page: Page, text: string) => page.getByRole('treeitem', { name: `节点：${text}`, exact: true });
async function setup(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新建', exact: true }).click(); await page.getByRole('button', { name: /空白画布/ }).click();
  for (const text of ['A', 'B']) {
    await page.getByRole('button', { name: '主题', exact: true }).click();
    await page.getByRole('textbox', { name: '编辑节点文字' }).fill(text); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  }
}
async function insert(page: Page, name: string) {
  await node(page, 'A').click(); await page.getByRole('button', { name: '插入', exact: true }).click();
  await page.locator('.insert-menu').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog', { name: '为想法添些细节' })).toBeVisible();
}
async function fileData(page: Page) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click();
  const download = await event; const path = (await download.path())!;
  return { path, document: JSON.parse(await readFile(path, 'utf8')).document };
}

test('TC-011/012 联系、概要、外框编辑、清理与文件往返', async ({ page }) => {
  await setup(page);
  await node(page, 'A').click(); await page.getByRole('button', { name: '联系', exact: true }).click();
  await node(page, 'A').click(); await expect(page.getByRole('alert')).toContainText('不能联系自身');
  await node(page, 'B').click(); await page.getByRole('textbox', { name: '结构元素文字' }).fill('想法之间的联系');
  await page.getByRole('button', { name: '保存文字' }).click();
  await expect(page.getByRole('button', { name: '编辑联系：想法之间的联系' })).toBeVisible();
  await node(page, 'A').click(); await node(page, 'B').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '概要', exact: true }).click();
  await page.getByRole('textbox', { name: '结构元素文字' }).fill('共同方向'); await page.getByRole('button', { name: '保存文字' }).click();
  await expect(page.getByRole('button', { name: '编辑概要：共同方向' })).toBeVisible();
  await page.getByRole('button', { name: '外框', exact: true }).click();
  await page.getByRole('textbox', { name: '结构元素文字' }).fill('第一组'); await page.getByRole('button', { name: '保存文字' }).click();
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑外框：第一组' })).toBeVisible();
  const saved = await fileData(page); expect(saved.document.relations).toHaveLength(1); expect(saved.document.groups).toHaveLength(2);
  await node(page, 'A').click(); await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑联系：想法之间的联系' })).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑联系：想法之间的联系' })).toBeVisible();
  await page.getByLabel('打开导图文件').setInputFiles(saved.path);
  await expect(page.getByRole('button', { name: '编辑概要：共同方向' })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑外框：第一组' })).toBeVisible();
});

test('TC-013/014 笔记标签待办链接方程与贴纸，草稿取消不提交', async ({ page }) => {
  await setup(page); await insert(page, '笔记');
  await page.getByRole('textbox', { name: '主题笔记' }).fill('取消这段草稿'); await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '笔记 A', exact: true })).toHaveCount(0);
  await insert(page, '笔记'); await page.getByRole('textbox', { name: '主题笔记' }).fill('这是一段笔记');
  await page.getByRole('tab', { name: '标签', exact: true }).click(); await page.getByRole('textbox', { name: '主题标签' }).fill('重要，灵感，重要');
  await page.getByRole('tab', { name: '待办', exact: true }).click(); await page.getByRole('button', { name: /待完成.*下一步/ }).click();
  await page.getByRole('tab', { name: '链接', exact: true }).click(); await page.getByRole('textbox', { name: '链接地址' }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: '保存内容' }).click(); await expect(page.getByRole('alert')).toContainText('有效网页地址');
  await page.getByRole('textbox', { name: '链接地址' }).fill('https://example.com');
  await page.getByRole('tab', { name: '方程', exact: true }).click(); await page.getByRole('textbox', { name: '方程源码' }).fill('E = mc^2');
  await expect(page.locator('.equation-area .katex')).toBeVisible();
  await page.getByRole('textbox', { name: '方程源码' }).fill('\\frac{'); await expect(page.locator('.formula-error')).toContainText('语法');
  await page.getByRole('textbox', { name: '方程源码' }).fill('E = mc^2');
  await page.getByRole('tab', { name: '贴纸与插画', exact: true }).click(); await page.getByRole('button', { name: '贴纸 💡', exact: true }).click();
  await page.getByRole('button', { name: '慢生长', exact: true }).click(); await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByRole('button', { name: '笔记 A', exact: true })).toBeVisible();
  await expect(node(page, 'A').locator('.katex')).toBeVisible();
  await page.getByRole('button', { name: '待办 A', exact: true }).click();
  const saved = await fileData(page); const content = Object.values(saved.document.nodes).find((item: unknown) => (item as { text: string }).text === 'A') as { content: { tags: string[]; todo: string; equation: string; note: string } };
  expect(content.content.tags).toEqual(['重要', '灵感']); expect(content.content.todo).toBe('done'); expect(content.content.note).toBe('这是一段笔记');
  await page.reload(); await expect(node(page, 'A').locator('.katex')).toBeVisible();
});

test('TC-015 图片和附件自包含重开、超限拒绝、麦克风拒绝后仍可保存', async ({ page }) => {
  await setup(page); await insert(page, '图片 / 附件 / 语音');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lX8AAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('添加图片文件').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.attachment-row')).toHaveCount(1);
  await page.getByLabel('添加附件文件').setInputFiles({ name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('可随文件带走的附件') });
  await expect(page.locator('.attachment-row')).toHaveCount(2);
  await page.getByLabel('添加附件文件').setInputFiles({ name: 'too-big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('最多 2 MB');
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Test denied')); });
  await page.getByRole('button', { name: '开始录音', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('无法使用麦克风');
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(node(page, 'A').getByRole('img', { name: '主题图片' })).toBeVisible();
  const saved = await fileData(page); await page.getByLabel('打开导图文件').setInputFiles(saved.path);
  await page.getByRole('button', { name: '资源 A', exact: true }).click();
  await expect(page.locator('.attachment-row')).toHaveCount(2);
  await expect(page.getByRole('link', { name: '下载此资源', exact: true })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/content-dialog.png' });
});
