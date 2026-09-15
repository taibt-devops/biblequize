import { type Page, type Locator } from '@playwright/test'
import { BasePage } from './BasePage'

/** W-M19 Memorize mode — /practice/memorize, /practice/memorize/add, /practice/memorize/session. */
export class MemorizePage extends BasePage {
  // Entry points
  readonly entryCard: Locator
  readonly entryBtn: Locator
  readonly homeDueCard: Locator
  readonly homeDueBtn: Locator

  // List
  readonly listPage: Locator
  readonly empty: Locator
  readonly items: Locator
  readonly addBtn: Locator
  readonly startReviewBtn: Locator

  // Add
  readonly addPage: Locator
  readonly bookSelect: Locator
  readonly chapterSelect: Locator
  readonly verseFromSelect: Locator
  readonly verseToSelect: Locator
  readonly preview: Locator
  readonly noText: Locator
  readonly submitBtn: Locator
  readonly addError: Locator

  // Session
  readonly sessionPage: Locator
  readonly context: Locator
  readonly contextStartBtn: Locator
  readonly orderExercise: Locator
  readonly orderChunks: Locator
  readonly clozeExercise: Locator
  readonly clozeBlanks: Locator
  readonly clozeWords: Locator
  readonly result: Locator
  readonly nextBtn: Locator
  readonly summary: Locator

  constructor(page: Page) {
    super(page)
    this.entryCard = page.getByTestId('memorize-entry-card')
    this.entryBtn = page.getByTestId('memorize-entry-btn')
    this.homeDueCard = page.getByTestId('home-memory-due-card')
    this.homeDueBtn = page.getByTestId('home-memory-due-btn')

    this.listPage = page.getByTestId('memorize-list-page')
    this.empty = page.getByTestId('memorize-empty')
    this.items = page.getByTestId('memorize-item')
    this.addBtn = page.getByTestId('memorize-add-btn')
    this.startReviewBtn = page.getByTestId('memorize-start-review-btn')

    this.addPage = page.getByTestId('memorize-add-page')
    this.bookSelect = page.getByTestId('memorize-add-book')
    this.chapterSelect = page.getByTestId('memorize-add-chapter')
    this.verseFromSelect = page.getByTestId('memorize-add-verse-from')
    this.verseToSelect = page.getByTestId('memorize-add-verse-to')
    this.preview = page.getByTestId('memorize-add-preview')
    this.noText = page.getByTestId('memorize-add-no-text')
    this.submitBtn = page.getByTestId('memorize-add-submit')
    this.addError = page.getByTestId('memorize-add-error')

    this.sessionPage = page.getByTestId('memorize-session-page')
    this.context = page.getByTestId('memorize-context')
    this.contextStartBtn = page.getByTestId('memorize-context-start')
    this.orderExercise = page.getByTestId('memorize-order-exercise')
    this.orderChunks = page.getByTestId('memorize-order-chunk')
    this.clozeExercise = page.getByTestId('memorize-cloze-exercise')
    this.clozeBlanks = page.getByTestId('memorize-cloze-blank')
    this.clozeWords = page.getByTestId('memorize-cloze-word')
    this.result = page.getByTestId('memorize-result')
    this.nextBtn = page.getByTestId('memorize-next-btn')
    this.summary = page.getByTestId('memorize-summary')
  }

  async gotoList(): Promise<void> {
    await this.page.goto('/practice/memorize')
    await this.listPage.waitFor({ state: 'visible' })
  }

  async gotoAdd(): Promise<void> {
    await this.page.goto('/practice/memorize/add')
    await this.addPage.waitFor({ state: 'visible' })
  }

  async gotoSession(): Promise<void> {
    await this.page.goto('/practice/memorize/session')
    await this.sessionPage.waitFor({ state: 'visible' })
  }

  async pickRange(book: string, chapter: number, from: number, to: number): Promise<void> {
    await this.bookSelect.selectOption(book)
    await this.chapterSelect.selectOption(String(chapter))
    await this.verseFromSelect.selectOption(String(from))
    await this.verseToSelect.selectOption(String(to))
  }

  /** Tap phrase chunks in the given order (exact chunk text). */
  async orderChunksInSequence(chunks: string[]): Promise<void> {
    for (const text of chunks) {
      await this.orderChunks.filter({ hasText: new RegExp(`^${text}$`) }).first().click()
    }
  }

  /** Fill every cloze blank using `tokens[data-index]` as the answer. */
  async fillClozeFromTokens(tokens: string[]): Promise<void> {
    const indices = await this.clozeBlanks.evaluateAll(els => els.map(e => Number(e.getAttribute('data-index'))))
    for (const idx of indices) {
      await this.clozeWords.filter({ hasText: new RegExp(`^${tokens[idx]}$`) }).first().click()
    }
  }
}
