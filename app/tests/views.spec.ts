import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
});
test('TC-017 大纲定位折叠后代并同步编辑', async ({ page }) => {
  await page.getByRole('button', { name: '折叠 捕捉灵感', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: '节点：双击节点，开始编辑', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '导图大纲', exact: true }).click();
  const outline = page.getByRole('region', { name: '大纲视图' });
  await outline.getByRole('button', { name: '双击节点，开始编辑', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: '节点：双击节点，开始编辑', exact: true })).toBeVisible();
  await outline.getByRole('button', { name: '双击节点，开始编辑', exact: true }).dblclick();
  await page.getByRole('textbox', { name: '编辑节点文字' }).fill('从大纲编辑'); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await expect(page.getByRole('treeitem', { name: '节点：从大纲编辑', exact: true })).toBeVisible();
});

test('TC-018 分支聚焦与 ZEN 模式不修改历史', async ({ page }) => {
  await page.getByRole('treeitem', { name: '节点：捕捉灵感', exact: true }).click();
  await page.getByRole('button', { name: '仅显示该分支', exact: true }).click();
  await expect(page.getByRole('treeitem')).toHaveCount(3);
  await page.getByRole('button', { name: '返回完整导图', exact: true }).click();
  await expect(page.getByRole('treeitem')).toHaveCount(13);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'ZEN 专注模式', exact: true }).click();
  await expect(page.locator('.app-header')).toBeHidden(); await expect(page.getByRole('treeitem')).toHaveCount(13);
  await page.keyboard.press('Escape'); await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
});

test('TC-019 演说不限 5 张、键盘翻页与退出不改文档', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '主题', exact: true }).click(); await page.getByRole('textbox', { name: '编辑节点文字' }).fill(`额外分支 ${i}`); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  }
  await page.getByRole('button', { name: '开始演说', exact: true }).click();
  const presentation = page.getByRole('dialog', { name: '演说模式' });
  await expect(presentation).toContainText('1 / 7');
  await page.keyboard.press('ArrowRight'); await expect(presentation).toContainText('2 / 7');
  await expect(presentation.getByRole('heading', { level: 1 })).toHaveText('捕捉灵感');
  await page.screenshot({ path: 'test-results/presentation.png' });
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(presentation).toContainText('7 / 7'); await expect(presentation.getByRole('button', { name: '下一张' })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(presentation).toHaveCount(0); await expect(page.getByRole('treeitem')).toHaveCount(15);
});

test('标题取消不提交；在标题中 Ctrl+S 下载当前标题', async ({ page }) => {
  const title = page.getByRole('textbox', { name: '导图名称' });
  await title.fill('应取消的名称'); await title.press('Escape'); await expect(title).toHaveValue('我的第一张导图');
  await title.fill('键盘保存的标题'); const event = page.waitForEvent('download'); await title.press('Control+s');
  const download = await event; expect(download.suggestedFilename()).toBe('键盘保存的标题.mimicraft');
  await expect(title).toHaveValue('键盘保存的标题');
});

test('TC-018 标签查找与筛选不删除文档，聚焦时新增根级主题可见', async ({ page }) => {
  await page.getByRole('treeitem', { name: '节点：捕捉灵感', exact: true }).click();
  await page.getByRole('button', { name: '插入', exact: true }).click(); await page.locator('.insert-menu').getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('textbox', { name: '主题标签' }).fill('独特标签'); await page.getByRole('button', { name: '保存内容' }).click();
  await page.getByRole('textbox', { name: '查找主题' }).fill('独特标签'); await expect(page.locator('.search-match')).toHaveCount(1);
  await page.getByRole('combobox', { name: '标签筛选' }).selectOption('独特标签'); await expect(page.locator('.filter-dimmed')).toHaveCount(12);
  await expect(page.getByRole('treeitem')).toHaveCount(13);
  await page.getByRole('button', { name: '仅显示该分支', exact: true }).click();
  await page.getByRole('button', { name: '主题', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '编辑节点文字' })).toBeVisible();
  await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter'); await expect(page.getByRole('treeitem')).toHaveCount(14);
});
