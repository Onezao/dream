/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly languageToggleButton: Locator;
  readonly errorBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.emailInput = page.getByPlaceholder(/邮箱|email/i).first();
    this.passwordInput = page.getByPlaceholder(/密码|password/i).first();
    this.rememberMeCheckbox = page.locator('label.t-checkbox, .t-checkbox').first();
    this.submitButton = page.getByRole('button', { name: /立即登录|Sign In/i });
    this.registerLink = page.getByRole('link', { name: /注册新账号|Create Account/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /找回密码|Forgot Password/i });
    this.languageToggleButton = page.locator('button').filter({ hasText: /English|简体中文/ });
    this.errorBanner = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.heading).toBeVisible();
  }

  async fillCredentials(email: string, pass: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, pass: string) {
    await this.fillCredentials(email, pass);
    await this.submit();
  }

  async toggleLanguage() {
    await this.languageToggleButton.click();
  }

  async toggleRememberMe() {
    await this.rememberMeCheckbox.click();
  }
}
