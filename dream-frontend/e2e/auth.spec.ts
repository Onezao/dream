/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { RegisterPage } from './pages/register.page';

test.describe('Authentication - Login Flow', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });
  });

  test('should render login page with all expected elements in zh-CN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.heading).toHaveText('欢迎登录');
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.rememberMeCheckbox).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('should toggle language between zh-CN and en-US', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Default: zh-CN -> heading: 欢迎登录
    await expect(loginPage.heading).toHaveText('欢迎登录');
    await expect(loginPage.submitButton).toHaveText(/立即登录/);

    // Switch to English
    await loginPage.toggleLanguage();
    await expect(loginPage.heading).toHaveText('Welcome Back');
    await expect(loginPage.submitButton).toHaveText(/Sign In/);

    // Switch back to 简体中文
    await loginPage.toggleLanguage();
    await expect(loginPage.heading).toHaveText('欢迎登录');
  });

  test('should show client-side validation error on empty submit', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Submit directly without entering email or password
    await loginPage.submit();

    // Check that email required error appears
    await expect(page.locator('text=请输入电子邮箱')).toBeVisible();
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.emailInput.fill('invalid-email-format');
    await loginPage.emailInput.blur();

    await expect(page.locator('text=电子邮箱格式不正确')).toBeVisible();
  });

  test('should show error alert on invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('nobody@topee.top', 'WrongPassword123!');

    // An alert banner should appear indicating login failure
    await expect(loginPage.errorBanner).toBeVisible({ timeout: 10000 });
    await expect(loginPage.errorBanner).toContainText(/邮箱或密码不正确|登录失败|Invalid credentials/i);
  });

  test('should toggle remember me checkbox', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const checkbox = page.locator('.t-checkbox').first();
    // Default is checked for 7-day session
    await expect(checkbox).toHaveClass(/t-checkbox--checked/);

    // Click to uncheck
    await checkbox.click();
    await expect(checkbox).not.toHaveClass(/t-checkbox--checked/);

    // Click to re-check
    await checkbox.click();
    await expect(checkbox).toHaveClass(/t-checkbox--checked/);
  });

  test('should navigate between login and register views', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.registerLink.click();
    await expect(page).toHaveURL(/\/register/);

    const registerPage = new RegisterPage(page);
    await expect(registerPage.heading).toBeVisible();
  });

  test('should successfully log in with superadmin credentials and store tokens', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('superadmin@topee.top', 'haha#123');

    // Upon successful login, user should be redirected to workspace
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Verify localStorage has access_token and dream_context
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const dreamContextStr = await page.evaluate(() => localStorage.getItem('dream_context'));

    expect(accessToken).toBeTruthy();
    expect(dreamContextStr).toBeTruthy();

    const dreamContext = JSON.parse(dreamContextStr!);
    expect(dreamContext.primaryRole).toBe('admin');
    expect(dreamContext.effectiveRoles).toContain('admin');
  });

  test.afterEach(async () => {
    const criticalErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes('401') &&
        !msg.includes('400') &&
        !msg.includes('404') &&
        !msg.includes('INVALID_CREDENTIALS') &&
        !msg.includes('Failed to load resource') &&
        !msg.includes('favicon')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Authentication - Register Flow', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });
  });

  test('should render register page in zh-CN with password rules checklist', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await expect(registerPage.heading).toHaveText('创建账号');
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.sendCodeButton).toBeVisible();
    await expect(registerPage.verificationCodeInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.confirmPasswordInput).toBeVisible();
    await expect(registerPage.agreementCheckbox).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();

    // Password rules should be displayed
    await expect(page.locator('text=密码需满足以下全部要求')).toBeVisible();
    await expect(page.locator('text=至少 8 个字符')).toBeVisible();
    await expect(page.locator('text=包含大写字母 (A-Z)')).toBeVisible();
    await expect(page.locator('text=包含小写字母 (a-z)')).toBeVisible();
    await expect(page.locator('text=包含数字 (0-9)')).toBeVisible();
    await expect(page.locator('text=包含特殊字符 (如 !#$%&*)')).toBeVisible();
  });

  test('should toggle register page language', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.toggleLanguage();
    await expect(registerPage.heading).toHaveText('Create Account');
    await expect(page.locator('text=Password must include all of the following')).toBeVisible();

    await registerPage.toggleLanguage();
    await expect(registerPage.heading).toHaveText('创建账号');
  });

  test('should dynamically update password strength indicators as user types', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Type a simple lowercase string
    await registerPage.passwordInput.fill('abc');
    await expect(page.locator('text=✓ 包含小写字母 (a-z)')).toBeVisible();
    await expect(page.locator('text=○ 至少 8 个字符')).toBeVisible();

    // Add digits and uppercase
    await registerPage.passwordInput.fill('Abcdef12');
    await expect(page.locator('text=✓ 包含大写字母 (A-Z)')).toBeVisible();
    await expect(page.locator('text=✓ 包含数字 (0-9)')).toBeVisible();
    await expect(page.locator('text=✓ 至少 8 个字符')).toBeVisible();
    await expect(page.locator('text=○ 包含特殊字符 (如 !#$%&*)')).toBeVisible();

    // Add special character to satisfy all rules
    await registerPage.passwordInput.fill('Abcdef12#');
    await expect(page.locator('text=✓ 包含特殊字符 (如 !#$%&*)')).toBeVisible();
  });

  test('should show error when confirm password does not match', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.passwordInput.fill('StrongPass123!');
    await registerPage.confirmPasswordInput.fill('DifferentPass456!');

    await expect(page.locator('text=两次输入的密码不一致')).toBeVisible();
  });

  test('should open and close user agreement and privacy policy dialogs', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Click User Agreement
    await registerPage.openUserAgreement();
    await expect(page.locator('.t-dialog')).toBeVisible();
    await expect(page.locator('.t-dialog h2, .t-dialog .text-base')).toContainText(/服务协议|协议/i);

    // Close Dialog
    await registerPage.closePolicyDialog();
    await expect(page.locator('.t-dialog')).not.toBeVisible();

    // Click Privacy Policy
    await registerPage.openPrivacyPolicy();
    await expect(page.locator('.t-dialog')).toBeVisible();
    await expect(page.locator('.t-dialog h2, .t-dialog .text-base')).toContainText(/隐私/i);

    // Close Dialog
    await registerPage.closePolicyDialog();
    await expect(page.locator('.t-dialog')).not.toBeVisible();
  });

  test('should enforce agreement check before form submission', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.emailInput.fill('newuser@topee.top');
    await registerPage.verificationCodeInput.fill('123456');
    await registerPage.passwordInput.fill('ValidPass#123');
    await registerPage.confirmPasswordInput.fill('ValidPass#123');

    // Click submit without checking agreement checkbox
    await registerPage.submitButton.click();

    // Should display toast prompt for agreement
    await expect(page.locator('text=请先阅读并勾选同意用户服务协议与隐私保护政策')).toBeVisible();
  });

  test.afterEach(async () => {
    const criticalErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes('401') &&
        !msg.includes('400') &&
        !msg.includes('404') &&
        !msg.includes('Failed to load resource') &&
        !msg.includes('favicon')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
