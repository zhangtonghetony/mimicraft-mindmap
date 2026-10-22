import { expect, test } from '@playwright/test';

test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });
test('TC-015 使用合成麦克风完成录音、停止、保存和重开', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '插入', exact: true }).click(); await page.locator('.insert-menu').getByRole('button', { name: '图片 / 附件 / 语音', exact: true }).click();
  await page.getByRole('button', { name: '开始录音', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止录音', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '停止录音', exact: true }).click();
  await expect(page.locator('.attachment-row audio')).toHaveCount(1);
  await expect.poll(() => page.locator('.attachment-row audio').evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByRole('button', { name: '资源 让想法，自由生长', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '已保存在此浏览器', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '资源 让想法，自由生长', exact: true }).click();
  await expect.poll(() => page.locator('.attachment-row audio').evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThan(0);
});
