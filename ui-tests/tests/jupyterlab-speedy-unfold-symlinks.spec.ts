import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedFixtureRoot,
  createIsolatedFixtureRoot,
  createSymlinkInFixture,
  prefixPath
} from './helpers/fixture';
import { itemByPath } from './helpers/selectors';
import { ensureFolderExpanded } from './helpers/tree-ui';
import { buildLabUrl } from './helpers/urls';

const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:10888';

let fixtureRoot = '';

test.describe.serial('jupyterlab-speedy-unfold symlinks', () => {
  test.beforeEach(() => {
    fixtureRoot = createIsolatedFixtureRoot();
  });

  test.afterEach(() => {
    cleanupIsolatedFixtureRoot(fixtureRoot);
  });

  test('directory symlink appears as expandable folder', async ({ page }) => {
    createSymlinkInFixture(fixtureRoot, 'dir2', 'link-dir', 'dir');

    await page.goto(buildLabUrl(TARGET_URL));
    await page.waitForSelector('#jupyterlab-splash', { state: 'detached' });
    await page.waitForSelector('div[role="main"] >> text=Launcher');

    await page.hover(itemByPath(fixtureRoot));
    await ensureFolderExpanded(
      page,
      fixtureRoot,
      prefixPath(fixtureRoot, 'link-dir')
    );

    const linkRow = page.locator(
      itemByPath(prefixPath(fixtureRoot, 'link-dir'))
    );
    await expect(linkRow).toBeVisible();
    await expect(linkRow).toHaveAttribute('data-file-type', 'directory');
    await expect(linkRow).toHaveAttribute('data-is-symlink', 'true');
    await expect(linkRow).toHaveAttribute('title', /^→ .*\/dir2$/);

    const realDirRow = page.locator(
      itemByPath(prefixPath(fixtureRoot, 'dir2'))
    );
    await expect(realDirRow).not.toHaveAttribute('data-is-symlink', /.*/);
    await expect(realDirRow).not.toHaveAttribute('title', /^→/);

    await ensureFolderExpanded(
      page,
      prefixPath(fixtureRoot, 'link-dir'),
      prefixPath(fixtureRoot, 'link-dir/dir3')
    );
    await expect(
      page.locator(itemByPath(prefixPath(fixtureRoot, 'link-dir/dir3')))
    ).toBeVisible();
  });

  test('broken symlink stays visible, looks broken, and does not open', async ({
    page
  }) => {
    createSymlinkInFixture(
      fixtureRoot,
      'does-not-exist.txt',
      'broken-link.txt',
      'file'
    );

    await page.goto(buildLabUrl(TARGET_URL));
    await page.waitForSelector('#jupyterlab-splash', { state: 'detached' });
    await page.waitForSelector('div[role="main"] >> text=Launcher');

    await page.hover(itemByPath(fixtureRoot));
    await ensureFolderExpanded(
      page,
      fixtureRoot,
      prefixPath(fixtureRoot, 'broken-link.txt')
    );

    const linkRow = page.locator(
      itemByPath(prefixPath(fixtureRoot, 'broken-link.txt'))
    );
    await expect(linkRow).toBeVisible();
    await expect(linkRow).toHaveAttribute('data-is-symlink', 'true');
    await expect(linkRow).toHaveAttribute('data-symlink-broken', 'true');
    await expect(linkRow).toHaveAttribute('title', /^→ .*does-not-exist\.txt$/);

    const tabsBefore = await page
      .locator('.lm-DockPanel-tabBar .lm-TabBar-tab')
      .count();
    await page.dblclick(itemByPath(prefixPath(fixtureRoot, 'broken-link.txt')));
    await page.waitForTimeout(500);
    const tabsAfter = await page
      .locator('.lm-DockPanel-tabBar .lm-TabBar-tab')
      .count();
    expect(tabsAfter).toBe(tabsBefore);
  });

  test('file symlink appears as a normal file', async ({ page }) => {
    createSymlinkInFixture(
      fixtureRoot,
      'dir2/dir3/file211.txt',
      'link-file.txt',
      'file'
    );

    await page.goto(buildLabUrl(TARGET_URL));
    await page.waitForSelector('#jupyterlab-splash', { state: 'detached' });
    await page.waitForSelector('div[role="main"] >> text=Launcher');

    await page.hover(itemByPath(fixtureRoot));
    await ensureFolderExpanded(
      page,
      fixtureRoot,
      prefixPath(fixtureRoot, 'link-file.txt')
    );

    const linkRow = page.locator(
      itemByPath(prefixPath(fixtureRoot, 'link-file.txt'))
    );
    await expect(linkRow).toBeVisible();
    await expect(linkRow).toHaveAttribute('data-file-type', 'file');
    await expect(linkRow).toHaveAttribute('data-is-symlink', 'true');
    await expect(linkRow).toHaveAttribute(
      'title',
      /^→ .*\/dir2\/dir3\/file211\.txt$/
    );
  });
});
