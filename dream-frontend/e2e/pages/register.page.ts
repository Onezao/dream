/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { Page, Locator, expect } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly sendCodeButton: Locator;
  readonly verificationCodeInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly agreementCheckbox: Locator;
  readonly userAgreementBtn: Locator;
  readonly privacyPolicyBtn: Locator;
  readonly submitButton: Locator;
  readonly languageToggleButton: Locator;
  readonly policyDialog: Locator;
  readonly policyDialogCloseBtn: Locator;
  readonly disabledNoticeAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.emailInput = page.getByPlaceholder(/常用电子邮箱|email address/i).first();
    this.sendCodeButton = page.getByRole('button', { name: /获取验证码|Send Code/i });
    this.verificationCodeInput = page.getByPlaceholder(/验证码|code/i).first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    this.agreementCheckbox = page.locator('label.t-checkbox, .t-checkbox').first();
    this.userAgreementBtn = page.getByRole('button', { name: /用户服务协议|User Agreement/i });
    this.privacyPolicyBtn = page.getByRole('button', { name: /隐私保护政策|Privacy Policy/i });
    this.submitButton = page.getByRole('button', { name: /确认注册|Create Account/i });
    this.languageToggleButton = page.locator('button').filter({ hasText: /English|简体中文/ });
    this.policyDialog = page.locator('.t-dialog');
    this.policyDialogCloseBtn = page.locator('.t-dialog button').filter({ hasText: /✕|关闭|Close/i }).or(page.locator('.t-dialog button').first());
    this.disabledNoticeAlert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/register');
    await expect(this.heading).toBeVisible();
  }

  async toggleLanguage() {
    await this.languageToggleButton.click();
  }

  async openUserAgreement() {
    await this.userAgreementBtn.click();
  }

  async openPrivacyPolicy() {
    await this.privacyPolicyBtn.click();
  }

  async closePolicyDialog() {
    await this.policyDialogCloseBtn.click();
  }
}
