import axios from 'axios';
import * as https from 'https';
import jwtDecode from 'jwt-decode';

import test, { expect } from '../fixtures/fixtures';
import { selectors } from '../utils/constants';

test.describe('Login', () => {
  test.describe('works as expected', () => {
    test.beforeEach(async ({ baseUrl, page }) => {
      await page.goto(`${baseUrl}ui/`);
    });

    test('Logs in using UI', async ({ context, page, password, username }) => {
      console.log(`logging in user with username: ${username} and password: ${password}`);
      // enter valid username and password
      await page.waitForSelector(selectors.email);
      await page.click(selectors.email);
      await page.fill(selectors.email, username);
      await page.waitForSelector(selectors.password);
      await page.focus(selectors.password);
      await page.fill(selectors.password, password);
      await page.click(`:is(button:has-text('Log in'))`);
      // confirm we have logged in successfully
      await page.waitForSelector('text=License information');
      const cookies = await context.cookies();
      const token = cookies.find(cookie => cookie.name === 'JWT').value;
      const userId = jwtDecode(token).sub;
      await page.evaluate(({ userId }) => localStorage.setItem(`${userId}-onboarding`, JSON.stringify({ complete: true })), { userId });
      await context.storageState({ path: 'storage.json' });
      // now we can log out
      await page.click('.header-dropdown', { force: true });
      await page.click(`text=Log out`, { force: true });
      await page.waitForSelector(`text=Log in`, { timeout: 5000 });
      expect(await page.isVisible(`text=Log in`)).toBeTruthy();
    });

    test('does not stay logged in across sessions, after browser restart', async ({ baseUrl, page }) => {
      await page.goto(`${baseUrl}ui/`);
      const loginVisible = await page.isVisible(`:is(button:has-text('Log in'))`);
      expect(loginVisible).toBeTruthy();
    });

    test('fails to access unknown resource', async ({ baseUrl, page }) => {
      await page.goto(`${baseUrl}ui/`);
      const request = await axios({
        url: `${baseUrl}/users`,
        method: 'GET',
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      expect(request.status).toEqual(200);
      const loginVisible = await page.isVisible(`:is(button:has-text('Log in'))`);
      expect(loginVisible).toBeTruthy();
    });

    test('Does not log in with invalid password', async ({ baseUrl, page, username }) => {
      console.log(`logging in user with username: ${username} and password: lewrongpassword`);
      await page.goto(`${baseUrl}ui/`);
      // enter valid username and invalid password
      await page.waitForSelector(selectors.email);
      await page.click(selectors.email);
      await page.fill(selectors.email, username);
      await page.waitForSelector(selectors.password);
      await page.click(selectors.password);
      await page.fill(selectors.password, 'lewrongpassword');
      await page.click(`:is(button:has-text('Log in'))`);

      // still on /login page plus an error is displayed
      const loginVisible = await page.isVisible(`:is(button:has-text('Log in'))`);
      expect(loginVisible).toBeTruthy();
      await page.waitForSelector('text=There was a problem logging in');
    });

    test('Does not log in without password', async ({ baseUrl, page, username }) => {
      console.log(`logging in user with username: ${username} and without a password`);
      await page.goto(`${baseUrl}ui/`);
      // enter valid username and invalid password
      await page.waitForSelector(selectors.email);
      await page.click(selectors.email);
      await page.fill(selectors.email, username);
      expect(await page.isDisabled('button:has-text("Log in")')).toBeTruthy();
    });
  });

  test.describe('stays logged in across sessions, after browser restart if selected', () => {
    test.beforeEach(async ({ baseUrl, page }) => {
      await page.goto(`${baseUrl}ui/`);
    });

    test('pt1', async ({ context, password, page, username }) => {
      console.log(`logging in user with username: ${username} and password: ${password}`);
      // enter valid username and password
      await page.waitForSelector(selectors.email);
      await page.click(selectors.email);
      await page.fill(selectors.email, username);
      await page.waitForSelector(selectors.password);
      await page.click(selectors.password);
      await page.fill(selectors.password, password);
      await page.check('[type=checkbox]', { force: true });
      await page.click(`:is(button:has-text('Log in'))`);

      // confirm we have logged in successfully
      await page.waitForSelector('text=License information');
      const loginVisible = await page.isVisible(`:is(button:has-text('Log in'))`);
      expect(loginVisible).toBeFalsy();
      const cookies = await context.cookies();
      process.env.LOGIN_STORAGE = JSON.stringify(cookies);
    });

    test('pt2', async ({ baseUrl, context }) => {
      const cookies = JSON.parse(process.env.LOGIN_STORAGE);
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto(`${baseUrl}ui/`);
      const loginVisible = await page.isVisible(`:is(button:has-text('Log in'))`);
      await context.storageState({ path: 'storage.json' });
      expect(loginVisible).toBeFalsy();
    });
  });
});
