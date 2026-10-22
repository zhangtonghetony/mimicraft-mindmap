import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const node = (page: Page, text: string) => page.getByRole('treeitem', { name: `节点：${text}`, exact: true });
async function boot(page: Page) { await page.goto('/'); await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible(); }
async function menu(page: Page, label: string) { await page.getByRole('button', { name: '编辑操作', exact: true }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); }
async function insert(page: Page, label: string) { await page.getByRole('button', { name: '插入', exact: true }).click(); await page.locator('.insert-menu').getByRole('button', { name: label, exact: true }).click(); }
async function downloadData(page: Page) { const event = page.waitForEvent('download'); await page.getByRole('button', { name: '下载导图', exact: true }).click(); const download = await event; const path = (await download.path())!; return { path, data: JSON.parse(await readFile(path, 'utf8')) }; }

test('TC-021 十类结构切换、折叠与可视化布局检查', async ({ page }) => {
  await boot(page);
  for (const layout of ['mindmap', 'logic', 'brace', 'org', 'fishbone', 'timeline', 'tree', 'table', 'matrix', 'grid']) {
    await page.getByRole('combobox', { name: '导图结构', exact: true }).selectOption(layout);
    await expect(page.getByRole('treeitem')).toHaveCount(13); await page.getByRole('button', { name: '适应画布', exact: true }).click();
    if (['fishbone', 'org', 'matrix', 'grid'].includes(layout)) await page.screenshot({ path: `test-results/layout-${layout}.png` });
  }
  await page.getByRole('button', { name: '折叠 让想法，自由生长', exact: true }).click(); await expect(page.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('button', { name: '展开 让想法，自由生长', exact: true }).click(); await expect(page.getByRole('treeitem')).toHaveCount(13);
  const { data } = await downloadData(page); expect(data.document.layout).toBe('grid'); expect(data.schemaVersion).toBe(4);
});

test('TC-022 自由主题拖放、对齐、挂接和保存重开', async ({ page }) => {
  await boot(page);
  await menu(page, '插入自由主题'); await page.getByRole('textbox', { name: '编辑节点文字' }).fill('自由 A'); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await menu(page, '插入自由主题'); await page.getByRole('textbox', { name: '编辑节点文字' }).fill('自由 B'); await page.getByRole('textbox', { name: '编辑节点文字' }).press('Enter');
  await expect(page.locator('.free-node')).toHaveCount(2);
  const board = page.getByLabel('思维导图画布');
  await node(page, '自由 A').dragTo(board, { targetPosition: { x: 80, y: 80 } });
  await expect(page.locator('.free-node')).toHaveCount(2);
  await node(page, '自由 A').click(); await node(page, '自由 B').click({ modifiers: ['Shift'] });
  await menu(page, '自由主题左对齐');
  const a = await node(page, '自由 A').boundingBox(); const b = await node(page, '自由 B').boundingBox(); expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
  await node(page, '自由 A').dragTo(node(page, '捕捉灵感'));
  await expect(node(page, '自由 A')).not.toHaveClass(/free-node/);
  const saved = await downloadData(page); expect(saved.data.document.freeRoots).toHaveLength(1);
  await page.getByLabel('打开导图文件').setInputFiles(saved.path); await expect(page.locator('.free-node')).toHaveCount(1);
});

test('TC-023/024 局部富文本、整体样式、风格库与配色', async ({ page }) => {
  await boot(page); await node(page, '捕捉灵感').click(); await insert(page, '富文本');
  const editor = page.getByRole('textbox', { name: '富文本编辑区' }); await editor.fill('局部富文本'); await editor.press('Control+a');
  await page.getByRole('button', { name: '加粗文字', exact: true }).click(); await page.getByRole('button', { name: '保存内容' }).click();
  await expect(node(page, '局部富文本').locator('.node-label>span').last()).toHaveCSS('font-weight', '700');
  await page.getByRole('button', { name: '样式布局', exact: true }).click();
  await page.getByRole('spinbutton', { name: '主题字号', exact: true }).fill('24');
  await page.getByRole('combobox', { name: '主题形状', exact: true }).selectOption('pill');
  await page.getByRole('checkbox', { name: '主题固定宽度', exact: true }).check(); await page.getByRole('spinbutton', { name: '主题宽度', exact: true }).fill('240');
  await page.getByRole('tab', { name: '布局与画布', exact: true }).click(); await page.getByRole('combobox', { name: '主题编号', exact: true }).selectOption('decimal'); await page.getByRole('checkbox', { name: '手绘风格', exact: true }).check();
  await page.getByRole('tab', { name: '智能配色', exact: true }).click(); await page.getByRole('button', { name: '海岸', exact: true }).click();
  await page.getByRole('tab', { name: '我的风格', exact: true }).click(); await page.getByRole('textbox', { name: '风格保存名称' }).fill('测试风格'); await page.getByRole('button', { name: '保存为风格', exact: true }).click(); await page.getByRole('button', { name: '保存配色', exact: true }).click();
  await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await expect(node(page, '局部富文本')).toHaveCSS('font-size', '24px'); await expect(node(page, '局部富文本')).toHaveClass(/shape-pill/); await expect(page.locator('.app-shell')).toHaveClass(/hand-drawn/);
  const saved = await downloadData(page); await page.getByLabel('打开导图文件').setInputFiles(saved.path);
  await node(page, '局部富文本').click(); await page.getByRole('button', { name: '样式布局', exact: true }).click(); await page.getByRole('tab', { name: '我的风格', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除风格 测试风格' })).toBeVisible(); await expect(page.getByRole('button', { name: '删除配色 测试风格' })).toBeVisible();
  await page.screenshot({ path: 'test-results/style-library.png' });
});

test('TC-025/026 标注、标记筛选、计划任务与到期提醒', async ({ page }) => {
  await boot(page); await node(page, '捕捉灵感').click(); await insert(page, '标注');
  await page.getByRole('textbox', { name: '主题标注' }).fill('这是一条独立标注');
  await page.getByRole('tab', { name: '标记', exact: true }).click(); await page.getByRole('button', { name: '标记 flag', exact: true }).click();
  await page.getByRole('tab', { name: '计划任务', exact: true }).click();
  await page.getByLabel('任务开始日期').fill('2026-10-25'); await page.getByLabel('任务截止日期').fill('2026-10-21');
  await page.getByRole('button', { name: '保存内容', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('开始日期不能晚于');
  await page.getByLabel('任务开始日期').fill('2026-10-20'); await page.getByLabel('任务负责人').fill('自己'); await page.getByLabel('任务提醒时间').fill('2001-01-01T10:00');
  await page.getByRole('button', { name: '保存内容', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('任务提醒');
  await expect(page.getByRole('button', { name: '标注 捕捉灵感', exact: true })).toContainText('独立标注');
  await page.getByRole('combobox', { name: '标记筛选', exact: true }).selectOption('flag'); await expect(page.locator('.filter-dimmed')).toHaveCount(12);
  await page.getByRole('button', { name: '任务面板', exact: true }).click(); await expect(page.getByRole('dialog', { name: '任务与计划' })).toContainText('自己');
  await page.getByRole('button', { name: /捕捉灵感.*自己/ }).click(); await page.getByRole('slider', { name: '任务进度', exact: true }).fill('100'); await page.getByRole('button', { name: '保存内容', exact: true }).click();
  await expect(page.getByRole('button', { name: '待办 捕捉灵感', exact: true })).toContainText('完成');
});

test('TC-027/028 应用内剪贴板跨文档、剪切和样式操作', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Test denied')), readText: () => Promise.reject(new Error('Test denied')) } }));
  await node(page, '捕捉灵感').click(); await menu(page, '复制主题'); await expect(page.getByRole('alert')).toContainText('应用内剪贴板');
  await page.getByRole('button', { name: '新建', exact: true }).click(); await page.getByRole('button', { name: /从零开始.*空白画布/ }).click();
  await menu(page, '粘贴主题'); await expect(node(page, '捕捉灵感')).toBeVisible(); await expect(page.getByRole('treeitem')).toHaveCount(4);
  await node(page, '捕捉灵感').click(); await menu(page, '剪切主题'); await expect(page.getByRole('treeitem')).toHaveCount(1);
  await menu(page, '粘贴主题'); await expect(page.getByRole('treeitem')).toHaveCount(4);
  await page.getByRole('button', { name: '样式布局', exact: true }).click(); await page.getByRole('spinbutton', { name: '主题字号' }).fill('22'); await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await menu(page, '拷贝样式'); await node(page, '中心主题').click(); await menu(page, '粘贴样式'); await expect(node(page, '中心主题')).toHaveCSS('font-size', '22px');
  await menu(page, '重设样式'); await expect(node(page, '中心主题')).toHaveCSS('font-size', '20px');
  await node(page, '捕捉灵感').click(); await menu(page, '置于顶层'); const z = await node(page, '捕捉灵感').evaluate(element => Number(getComputedStyle(element).zIndex)); expect(z).toBeGreaterThan(3);
  await menu(page, '清空文本'); await expect(node(page, '空主题')).toBeVisible();
});

test('TC-029 原创图库搜索、保存并重用自定义模板', async ({ page }) => {
  await boot(page); await page.getByRole('button', { name: '模板库', exact: true }).click();
  await expect(page.locator('.template-card')).toHaveCount(11); await page.getByRole('textbox', { name: '查找模板' }).fill('鱼骨'); await expect(page.locator('.template-card')).toHaveCount(1);
  await page.getByRole('button', { name: /原因分析/ }).click(); await expect(page.getByRole('combobox', { name: '导图结构' })).toHaveValue('fishbone');
  await page.getByRole('button', { name: '模板库', exact: true }).click(); await page.getByRole('textbox', { name: '模板保存名称' }).fill('我的分析模板');
  await page.getByRole('button', { name: '保存当前导图为模板', exact: true }).click(); await expect(page.getByRole('button', { name: '删除模板 我的分析模板' })).toBeVisible();
  await page.getByRole('button', { name: /我的分析模板.*本地模板/ }).click(); await expect(page.getByRole('textbox', { name: '导图名称' })).toHaveValue('我的分析模板');
  await page.getByRole('button', { name: '模板库', exact: true }).click(); await page.getByRole('button', { name: '删除模板 我的分析模板' }).click(); await expect(page.getByRole('button', { name: '删除模板 我的分析模板' })).toHaveCount(0);
});

test('TC-030 演说编排、外观和 ZEN 设置保存', async ({ page }) => {
  await boot(page); await page.getByRole('button', { name: '演说编排', exact: true }).click();
  await page.getByRole('combobox', { name: '演说外观' }).selectOption('night'); await page.getByRole('textbox', { name: '页面标题 1', exact: true }).fill('我的开场'); await page.getByRole('textbox', { name: '页面备注 1', exact: true }).fill('让演示更清晰');
  await page.getByRole('checkbox', { name: '显示页面 5', exact: true }).uncheck(); await page.getByRole('button', { name: '保存演说设置', exact: true }).click();
  await page.getByRole('button', { name: '开始演说', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '演说模式' });
  await expect(dialog).toHaveClass(/theme-night/); await expect(dialog.getByRole('heading', { level: 1 })).toHaveText('我的开场'); await expect(dialog).toContainText('让演示更清晰'); await expect(dialog).toContainText('1 / 4');
  await page.screenshot({ path: 'test-results/presentation-night.png' }); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '样式布局', exact: true }).click(); await page.getByRole('tab', { name: '布局与画布', exact: true }).click(); await page.getByRole('combobox', { name: 'ZEN 外观' }).selectOption('night'); await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await page.getByRole('button', { name: 'ZEN 专注模式', exact: true }).click(); await expect(page.locator('.app-shell')).toHaveClass(/zen-night/); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible(); await page.reload();
  await page.getByRole('button', { name: '开始演说', exact: true }).click(); await expect(page.getByRole('heading', { name: '我的开场' })).toBeVisible();
});

test('TC-011/023 联系端点与结构元素样式修改、拒绝自联系、文件往返', async ({ page }) => {
  await boot(page); await node(page, '捕捉灵感').click(); await page.getByRole('button', { name: '联系', exact: true }).click(); await node(page, '连接思路').click();
  await page.getByRole('textbox', { name: '结构元素文字' }).fill('双向联系');
  await page.getByLabel('元素线条颜色').fill('#123456'); await page.getByLabel('元素线条粗细').fill('4'); await page.getByLabel('元素虚线').uncheck();
  await page.getByLabel('联系线型').selectOption('straight'); await page.getByLabel('联系箭头').selectOption('both');
  const options = await page.getByLabel('联系目标主题').locator('option').allTextContents(); expect(options).toContain('付诸行动');
  await page.getByLabel('联系目标主题').selectOption({ label: '捕捉灵感' }); await page.getByRole('button', { name: '保存文字' }).click();
  await expect(page.getByRole('alert')).toContainText('无法修改元素'); await expect(page.getByRole('dialog', { name: '编辑联系' })).toBeVisible();
  await page.getByLabel('联系目标主题').selectOption({ label: '付诸行动' }); await page.getByRole('button', { name: '保存文字' }).click();
  await expect(page.locator('.relation-curve')).toHaveAttribute('stroke', '#123456'); await expect(page.locator('.relation-curve')).toHaveAttribute('stroke-width', '4'); await expect(page.locator('.relation-curve')).toHaveAttribute('marker-start', /relation-arrow/);
  await node(page, '捕捉灵感').click(); await page.getByRole('button', { name: '外框', exact: true }).click();
  await page.getByLabel('元素填充颜色').fill('#eeddcc'); await page.getByLabel('元素线条颜色').fill('#445566'); await page.getByRole('button', { name: '保存文字' }).click();
  const saved = await downloadData(page); const edge = saved.data.document.relations[0]; expect(saved.data.document.nodes[edge.to].text).toBe('付诸行动'); expect(edge.style.arrow).toBe('both');
  await page.getByLabel('打开导图文件').setInputFiles(saved.path); await expect(page.locator('.group-boundary')).toHaveCSS('background-color', 'rgb(238, 221, 204)');
});

test('TC-022/023 并列样式、自由分支位置和恢复自动布局', async ({ page }) => {
  await boot(page); await node(page, '捕捉灵感').click(); await page.getByRole('button', { name: '样式布局', exact: true }).click();
  await page.getByRole('spinbutton', { name: '主题字号' }).fill('26'); await page.getByRole('button', { name: '应用当前样式到并列主题', exact: true }).click();
  await page.getByRole('tab', { name: '布局与画布', exact: true }).click(); await page.getByLabel('同级主题对齐').check(); await page.getByLabel('分支自由布局').check(); await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await expect(node(page, '连接思路')).toHaveCSS('font-size', '26px');
  await node(page, '捕捉灵感').dragTo(page.getByLabel('思维导图画布'), { targetPosition: { x: 180, y: 120 } });
  const saved = await downloadData(page); const found = Object.values(saved.data.document.nodes).find((value: any) => value.text === '捕捉灵感') as any; expect(found.position).toBeDefined();
  await page.getByLabel('打开导图文件').setInputFiles(saved.path); await node(page, '捕捉灵感').click();
  await page.getByRole('button', { name: '样式布局', exact: true }).click(); await page.getByRole('tab', { name: '布局与画布', exact: true }).click(); await page.getByRole('button', { name: '恢复自动布局', exact: true }).click(); await page.getByRole('button', { name: '应用设置', exact: true }).click();
  const reset = await downloadData(page); expect(Object.values(reset.data.document.nodes).every((value: any) => !value.position)).toBe(true); expect(reset.data.document.preferences.freeBranch).toBe(false);
});

test('TC-028 组合键复制样式、导航和文字输入边界', async ({ page }) => {
  await boot(page); await node(page, '捕捉灵感').click(); await page.getByRole('button', { name: '样式布局', exact: true }).click(); await page.getByRole('spinbutton', { name: '主题字号' }).fill('23'); await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await page.getByLabel('思维导图画布').focus(); await page.keyboard.press('Control+Alt+c'); await node(page, '连接思路').click(); await page.keyboard.press('Control+Alt+v'); await expect(node(page, '连接思路')).toHaveCSS('font-size', '23px');
  await page.keyboard.press('Control+d'); await expect(page.getByRole('treeitem')).toHaveCount(16); await expect(page.getByRole('treeitem', { name: '节点：连接思路', exact: true }).last()).toHaveCSS('font-size', '23px');
  await page.keyboard.press('Control+z'); await expect(page.getByRole('treeitem')).toHaveCount(13);
  await page.getByLabel('思维导图画布').focus(); await page.keyboard.press('Control+a'); await expect(page.locator('.map-node.selected')).toHaveCount(13);
  await node(page, '捕捉灵感').dblclick(); const input = page.getByRole('textbox', { name: '编辑节点文字' }); await input.fill('输入期间');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true }); await expect(input).toBeVisible(); await expect(input).toHaveValue('输入期间');
  await input.press('Control+a'); await input.press('Control+c'); await expect(page.getByRole('treeitem')).toHaveCount(13);
  await input.press('Escape'); await expect(node(page, '捕捉灵感')).toBeVisible();
});
