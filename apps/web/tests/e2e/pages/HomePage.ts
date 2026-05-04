import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class HomePage extends BasePage {
  // ── Locators ──────────────────────────────────────────────
  readonly container: Locator
  readonly tierBadge: Locator
  readonly greeting: Locator
  readonly totalPoints: Locator
  readonly tierProgressBar: Locator
  readonly dailyMissions: Locator
  readonly leaderboardSection: Locator
  readonly leaderboardTabDaily: Locator
  readonly leaderboardTabWeekly: Locator
  readonly nextTierCard: Locator

  // GameModeGrid is a child component — locate via its known testid
  readonly gameModeGrid: Locator

  constructor(page: Page) {
    super(page)
    this.container = page.getByTestId('home-page')
    this.tierBadge = page.getByTestId('home-tier-badge')
    // HR-1: GreetingCard split greeting label and name into separate testids.
    this.greeting = page.getByTestId('home-greeting-meta')
    this.totalPoints = page.getByTestId('home-total-points')
    this.tierProgressBar = page.getByTestId('home-tier-progress-bar')
    this.dailyMissions = page.getByTestId('home-daily-missions')
    this.leaderboardSection = page.getByTestId('home-leaderboard')
    this.leaderboardTabDaily = page.getByTestId('leaderboard-tab-daily')
    this.leaderboardTabWeekly = page.getByTestId('leaderboard-tab-weekly')
    this.nextTierCard = page.getByTestId('home-next-tier-card')

    this.gameModeGrid = page.locator('[data-testid="game-mode-grid"]')
  }

  // ── Actions ───────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.waitForLoaded()
  }

  async selectLeaderboardTab(tab: 'daily' | 'weekly'): Promise<void> {
    if (tab === 'daily') {
      await this.leaderboardTabDaily.click()
    } else {
      await this.leaderboardTabWeekly.click()
    }
  }

  async clickGameMode(mode: string): Promise<void> {
    // GameModeGrid cards use data-testid="game-mode-{mode}"
    await this.page.getByTestId(`game-mode-${mode}`).click()
  }

  // ── Assertions ────────────────────────────────────────────

  async expectTierBadge(name: string): Promise<void> {
    await expect(this.tierBadge).toBeVisible()
    await expect(this.tierBadge).toContainText(name)
  }
}
