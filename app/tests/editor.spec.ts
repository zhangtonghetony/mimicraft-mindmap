import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const node = (page: Page, text: string) => page.getByRole('treeitem', { name: `节点：${text}`, exact: true });
async function boot(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
}
async function newBlank(page: Page) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('button', { name: /从零开始.*空白画布/ }).click();
  await expect(node(page, '中心主题')).toBeVisible();
  await expect(page.getByRole('treeitem')).toHaveCount(1);
}
async function addChild(page: Page, parent: string, text: string) {
  await node(page, parent).click();
  await page.getByRole('button', { name: '细分主题', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑节点文字' }).fill(text);
  await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await expect(node(page, text)).toBeVisible();
}

test('TC-001/002 模板取消、节点编辑、多行、输入法提交与根级主题', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(page.getByRole('treeitem')).toHaveCount(13);
  await newBlank(page);
  await addChild(page, '中心主题', '第一层');
  await addChild(page, '第一层', '第二层');
  await page.getByRole('button', { name: '主题', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑节点文字' }).fill('新的根级分支');
  await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await node(page, '第一层').dblclick();
  await page.getByRole('textbox', { name: '编辑节点文字' }).fill('不该提交');
  await page.getByRole('textbox', { name: '编辑节点文字' }).press('Escape');
  await expect(node(page, '第一层')).toBeVisible();
  await node(page, '第一层').dblclick();
  const editor = page.getByRole('textbox', { name: '编辑节点文字' });
  await editor.fill('第一行'); await editor.press('Shift+Enter'); await editor.pressSequentially('second');
  await editor.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(editor).toBeVisible(); await editor.press('Enter');
  await expect(node(page, '第一行\nsecond')).toBeVisible();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click();
  const download = await downloadPromise; const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  const doc = file.document; const root = doc.nodes[doc.rootId];
  expect(root.children.map((id: string) => doc.nodes[id].text)).toContain('新的根级分支');
  expect(errors).toEqual([]);
});

test('TC-003/005 删除子树、仅删节点和撤销重做分叉', async ({ page }) => {
  await boot(page); await newBlank(page);
  await addChild(page, '中心主题', '父节点'); await addChild(page, '父节点', '子节点');
  await node(page, '父节点').click();
  await page.getByRole('button', { name: /仅删除此节点/ }).click();
  await expect(node(page, '父节点')).toHaveCount(0); await expect(node(page, '子节点')).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(node(page, '父节点')).toBeVisible();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(node(page, '父节点')).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await node(page, '父节点').click(); await node(page, '子节点').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await addChild(page, '中心主题', '新的操作');
  await expect(page.getByRole('button', { name: '重做', exact: true })).toBeDisabled();
  await node(page, '中心主题').click(); await expect(page.getByRole('button', { name: '删除', exact: true })).toBeDisabled();
});

test('TC-004 原生拖放、提升降级和循环目标保护', async ({ page }) => {
  await boot(page); await newBlank(page);
  await addChild(page, '中心主题', 'A'); await addChild(page, '中心主题', 'B');
  await node(page, 'B').dragTo(node(page, 'A'));
  await node(page, 'B').click(); await expect(page.getByRole('button', { name: '提升层级', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '提升层级', exact: true }).click();
  await expect(page.getByRole('button', { name: '提升层级', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '降低层级', exact: true }).click();
  await node(page, 'A').dragTo(node(page, 'B'));
  await expect(page.getByRole('alert')).toContainText('不能移入');
  await expect(page.getByRole('treeitem')).toHaveCount(3);
});

test('TC-006 自动保存刷新恢复、切换本地导图保留最后编辑', async ({ page }) => {
  await boot(page); await newBlank(page);
  await page.getByRole('textbox', { name: '导图名称' }).fill('本地恢复测试');
  await page.getByRole('textbox', { name: '导图名称' }).press('Enter');
  await addChild(page, '中心主题', '刷新后还在');
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  await page.reload(); await expect(node(page, '刷新后还在')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue('本地恢复测试');
  await node(page, '刷新后还在').dblclick();
  await page.getByRole('textbox', { name: '编辑节点文字' }).fill('立即切换前的最后一笔');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('button', { name: /有序推进.*项目计划/ }).click();
  await page.getByRole('button', { name: '本地导图', exact: true }).click();
  await page.getByRole('button', { name: /本地恢复测试/ }).click();
  await expect(node(page, '立即切换前的最后一笔')).toBeVisible();
});

test('TC-007/008 下载重开与无效文件隔离', async ({ page }) => {
  await boot(page); await newBlank(page); await addChild(page, '中心主题', '<img src=x onerror=alert(1)>');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mimicraft$/);
  const path = (await download.path())!;
  await newBlank(page); await page.getByLabel('打开导图文件').setInputFiles(path);
  await expect(node(page, '<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.locator('.map-node img')).toHaveCount(0);
  await page.getByLabel('打开导图文件').setInputFiles({ name: 'bad.mimicraft', mimeType: 'application/json', buffer: Buffer.from('{"format":"mimicraft-map","schemaVersion":999}') });
  await expect(page.getByRole('alert')).toContainText('文件版本');
  await expect(node(page, '<img src=x onerror=alert(1)>')).toBeVisible();
});

test('TC-009 保存故障可见、可下载、恢复后可重试', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restorePut: () => { IDBObjectStore.prototype.put = original; } });
    IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); };
  });
  await addChild(page, '让想法，自由生长', '仍在内存中');
  await expect(page.getByRole('button', { name: '自动保存失败 · 点击重试' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click();
  const download = await downloadPromise; expect(await download.path()).toBeTruthy();
  await page.evaluate(() => (window as unknown as { restorePut: () => void }).restorePut());
  await page.getByRole('button', { name: '自动保存失败 · 点击重试' }).click();
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  await page.reload(); await expect(node(page, '仍在内存中')).toBeVisible();
});

test('TC-009 初始读取失败保护原数据并支持临时模式', async ({ page }) => {
  await page.addInitScript(() => { indexedDB.open = () => { throw new Error('Test unavailable'); }; });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '暂时无法读取本地导图' })).toBeVisible();
  await page.getByRole('button', { name: '进入临时模式' }).click();
  await expect(page.getByRole('button', { name: '临时模式 · 请下载备份' })).toBeVisible();
  await addChild(page, '让想法，自由生长', '临时想法');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click();
  await downloadPromise;
});

test('TC-010 折叠、查找、平移缩放和快捷键焦点', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '折叠 捕捉灵感', exact: true }).click();
  await expect(node(page, '双击节点，开始编辑')).toHaveCount(0);
  await page.getByRole('button', { name: '展开 捕捉灵感', exact: true }).click();
  await expect(node(page, '双击节点，开始编辑')).toBeVisible();
  await page.getByRole('textbox', { name: '查找主题' }).fill('灵感');
  await expect(page.locator('.search-match')).toHaveCount(1);
  const undoButton = page.getByRole('button', { name: '撤销', exact: true });
  await undoButton.click(); await undoButton.click(); await expect(undoButton).toBeDisabled();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(undoButton).toBeDisabled();
  await page.getByRole('textbox', { name: '查找主题' }).press('Enter');
  await expect(page.getByRole('treeitem')).toHaveCount(13);
});

test('桌面与窄屏布局无页面横向溢出', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
  await page.screenshot({ path: 'test-results/editor-desktop.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 780, height: 900 });
  await page.getByRole('button', { name: '收起属性面板' }).click();
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/editor-narrow.png' });
});
