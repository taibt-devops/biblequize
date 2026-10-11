import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class LoginPage extends BasePage {
  // ── Locators ──────────────────────────────────────────────
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitBtn: Locator
  readonly googleBtn: Locator
  readonly guestLink: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    super(page)
    this.emailInput = page.getByTestId('login-email-input')
    this.passwordInput = page.getByTestId('login-password-input')
    this.submitBtn = page.getByTestId('login-submit-btn')
    this.googleBtn = page.getByTestId('login-google-btn')
    this.guestLink = page.getByTestId('login-guest-link')
    this.errorMessage = page.getByTestId('login-error-msg')
  }

  // ── Actions ───────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/login')
    // Email/mật khẩu cất sau nút "Đăng nhập bằng cách khác".
    await this.page.getByTestId('login-other-methods-btn').click()
    await this.submitBtn.waitFor({ state: 'visible' })
  }

  async loginWithCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitBtn.click()
  }

  async loginWithGoogle(): Promise<void> {
    await this.googleBtn.click()
  }

  // ── Assertions ────────────────────────────────────────────

  async expectError(msg: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible()
    await expect(this.errorMessage).toContainText(msg)
  }
}
