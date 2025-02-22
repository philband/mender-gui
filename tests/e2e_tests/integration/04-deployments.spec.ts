import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween.js';

import test, { expect } from '../fixtures/fixtures';
import { selectors } from '../utils/constants';

dayjs.extend(isBetween);

test.describe('Deployments', () => {
  test.use({ storageState: 'storage.json' });

  test.beforeEach(async ({ baseUrl, loggedInPage: page }) => {
    await page.goto(`${baseUrl}ui/devices`);
    await page.waitForTimeout(2000);
    await page.goto(`${baseUrl}ui/releases`);
    await page.waitForTimeout(2000);
  });

  test('allows shortcut deployments', async ({ loggedInPage: page }) => {
    // create an artifact to download first
    await page.click(`.repository-list-item:has-text('mender-demo-artifact')`);
    await page.click(`a:has-text('Create deployment')`);
    await page.waitForSelector(selectors.deviceGroupSelect, { timeout: 5000 });
    await page.focus(selectors.deviceGroupSelect);
    await page.type(selectors.deviceGroupSelect, 'All');
    await page.click(`#deployment-device-group-selection-listbox li:has-text('All devices')`);
    const creationButton = await page.waitForSelector('text=/Create deployment/i');
    await creationButton.scrollIntoViewIfNeeded();
    await creationButton.click();
    await page.waitForSelector('.deployment-item', { timeout: 10000 });
    await page.click(`[role="tab"]:has-text('Finished')`);
    await page.waitForSelector('.deployment-item:not(.deployment-header-item)', { timeout: 60000 });
    const datetime = await page.getAttribute('.deployment-item:not(.deployment-header-item) time', 'datetime');
    const time = dayjs(datetime);
    const earlier = dayjs().subtract(5, 'minutes');
    const now = dayjs();
    expect(time.isBetween(earlier, now));
  });

  test('allows group deployments', async ({ loggedInPage: page }) => {
    console.log(`allows group deployments`);
    await page.click(`a:has-text('Deployments')`);
    await page.click(`button:has-text('Create a deployment')`);

    await page.waitForSelector(selectors.releaseSelect, { timeout: 5000 });
    await page.focus(selectors.releaseSelect);
    await page.type(selectors.releaseSelect, 'mender');
    await page.click(`#deployment-release-selection-listbox li:has-text('mender-demo-artifact')`);

    await page.waitForSelector(selectors.deviceGroupSelect, { timeout: 5000 });
    await page.focus(selectors.deviceGroupSelect);
    await page.type(selectors.deviceGroupSelect, 'test');
    await page.click(`#deployment-device-group-selection-listbox li:has-text('testgroup')`);
    const creationButton = await page.waitForSelector('text=/Create deployment/i');
    await creationButton.scrollIntoViewIfNeeded();
    await creationButton.click();
    await page.waitForSelector('.deployment-item', { timeout: 10000 });
    await page.click(`[role="tab"]:has-text('Finished')`);
    await page.waitForSelector('.deployment-item:not(.deployment-header-item)', { timeout: 60000 });
  });
});
