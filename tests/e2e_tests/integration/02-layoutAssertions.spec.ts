import test, { expect } from '../fixtures/fixtures';
import { selectors } from '../utils/constants';

test.describe('Layout assertions', () => {
  const navbar = '.leftFixed.leftNav';
  test.use({ storageState: 'storage.json' });

  test.describe('Overall layout and structure', () => {
    test('shows the left navigation', async ({ loggedInPage: page }) => {
      expect(await page.isVisible(`${navbar}:has-text('Dashboard')`)).toBeTruthy();
      expect(await page.isVisible(`${navbar}:has-text('Devices')`)).toBeTruthy();
      expect(await page.isVisible(`${navbar}:has-text('Releases')`)).toBeTruthy();
      expect(await page.isVisible(`${navbar}:has-text('Deployments')`)).toBeTruthy();
    });

    test('has clickable header buttons', async ({ loggedInPage: page }) => {
      expect(await page.isVisible(`${navbar}:has-text('Dashboard')`)).toBeTruthy();
      await page.click(`${navbar}:has-text('Dashboard')`);
      await page.click(`${navbar}:has-text('Devices')`);
      await page.click(`${navbar}:has-text('Releases')`);
      await page.click(`${navbar}:has-text('Deployments')`);
    });
  });

  test('can authorize a device', async ({ loggedInPage: page }) => {
    test.setTimeout(140000);
    await page.click(`.leftNav :text('Devices')`);
    let hasAcceptedDevice = false;
    try {
      hasAcceptedDevice = await page.isVisible('.deviceListItem');
    } catch (e) {
      console.log(`no accepted device present so far`);
    }
    if (!hasAcceptedDevice) {
      const pendingMessage = await page.locator(`text=/pending authorization/i`);
      await pendingMessage.waitFor({ timeout: 60000 });
      await pendingMessage.click();
      await page.click(selectors.deviceListCheckbox);
      await page.hover('.MuiSpeedDial-fab');
      await page.click('[aria-label="accept"]');
    }
    await page.locator(`input:near(:text("Status:"))`).first().click({ force: true });
    await page.click(`css=.MuiPaper-root >> text=/Accepted/i`);
    await page.waitForSelector(`css=.deviceListItem >> text=/original/`, { timeout: 60000 });
    const element = await page.textContent('.deviceListItem');
    expect(element.includes('original')).toBeTruthy();
    await page.click(`.deviceListItem div:last-child`);
    await page.waitForSelector(`text=/Device information for/i`);
    expect(await page.isVisible('text=Authentication status')).toBeTruthy();
  });

  test('can group a device', async ({ loggedInPage: page }) => {
    await page.click(`.leftNav :text('Devices')`);
    await page.click(selectors.deviceListCheckbox);
    await page.hover('.MuiSpeedDial-fab');
    await page.click('[aria-label="group-add"]');
    await page.type('#group-creation-selection', 'testgroup');
    await page.click('.MuiDialogTitle-root');
    await page.click(`:is(:text-matches('create group', 'i'), :text-matches('add to group', 'i'))`);
    expect(await page.isVisible(`.grouplist:has-text('testgroup')`)).toBeTruthy();
    await page.click(`.grouplist:has-text('All devices')`);
    await page.click(selectors.deviceListCheckbox);
    await page.click(`.grouplist:has-text('testgroup')`);
    expect(await page.locator(`css=.deviceListItem >> text=/original/`)).toBeVisible();
  });
});
