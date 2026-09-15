/**
 * W-M19 — Memorize mode "Học Thuộc" (L2 Happy Path).
 *
 * Routes: /practice/memorize, /practice/memorize/add, /practice/memorize/session, /
 * Spec ref: SPEC_USER §5.1.1
 *
 * Memorize API + Bible passage are stubbed (MemorizeApiStub): the E2E DB has no
 * Bible text until the BTTHD 2011 import lands (task HT-5). Text is synthetic.
 */

import { test, expect } from '../../fixtures/auth'
import { MemorizePage } from '../../pages/MemorizePage'
import { MemorizeApiStub, fakeRangeText } from '../../helpers/memorize-api-stub'

test.describe('W-M19 Memorize — L2 Happy Path @happy @memorize', () => {
  let stub: MemorizeApiStub

  test.beforeEach(async ({ tier1Page }) => {
    stub = new MemorizeApiStub()
    await stub.install(tier1Page)
  })

  test('W-M19-L2-001: Them doan cau moi tu bo chon va thay trong danh sach @happy @memorize', async ({ tier1Page }) => {
    // SECTION 1: SETUP — empty list (stub)
    const page = tier1Page
    const memorize = new MemorizePage(page)

    // SECTION 2: ACTIONS
    await memorize.gotoAdd()
    await memorize.pickRange('John', 3, 16, 17)
    await expect(memorize.preview).toContainText('v16a')
    await memorize.submitBtn.click()

    // SECTION 3: UI ASSERTIONS
    await expect(page).toHaveURL('/practice/memorize')
    await expect(memorize.items).toHaveCount(1)
    // SECTION 4: API ASSERTIONS
    expect(stub.verses[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 })
  })

  test('W-M19-L2-002: Them doan da co bao loi trung @happy @memorize', async ({ tier1Page }) => {
    stub.addVerse({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 })
    const memorize = new MemorizePage(tier1Page)

    await memorize.gotoAdd()
    await memorize.pickRange('John', 3, 16, 17)
    await expect(memorize.preview).toBeVisible()
    await memorize.submitBtn.click()

    await expect(memorize.addError).toBeVisible()
    expect(stub.verses).toHaveLength(1)
  })

  test('W-M19-L2-003: Doan chua co noi dung thi khong cho them @happy @memorize', async ({ tier1Page }) => {
    stub.passageStatus = 404
    const memorize = new MemorizePage(tier1Page)

    await memorize.gotoAdd()
    await memorize.pickRange('John', 3, 16, 16)

    await expect(memorize.noText).toBeVisible()
    await expect(memorize.submitBtn).toBeDisabled()
  })

  test('W-M19-L2-004: On cau level 0 — sap xep cum dung thi dat @happy @memorize @critical', async ({ tier1Page }) => {
    const verse = stub.addVerse({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, masteryLevel: 0 })
    const memorize = new MemorizePage(tier1Page)

    await memorize.gotoSession()
    await expect(memorize.context).toContainText('v16a')
    await memorize.contextStartBtn.click()
    await expect(memorize.orderExercise).toBeVisible()
    await memorize.orderChunksInSequence(['v16a v16b v16c', 'v16d v16e v16f'])

    await expect(memorize.result).toHaveAttribute('data-passed', 'true')
    await memorize.nextBtn.click()
    await expect(memorize.summary).toBeVisible()
    expect(stub.reviews).toEqual([{ id: verse.id, exerciseType: 'order', passed: true }])
  })

  test('W-M19-L2-005: On cau level 2 — dien khuyet dung thi dat @happy @memorize @critical', async ({ tier1Page }) => {
    const verse = stub.addVerse({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, masteryLevel: 2 })
    const memorize = new MemorizePage(tier1Page)

    await memorize.gotoSession()
    await memorize.contextStartBtn.click()
    await expect(memorize.clozeExercise).toBeVisible()
    await memorize.fillClozeFromTokens(fakeRangeText(16, 16).split(' '))

    await expect(memorize.result).toHaveAttribute('data-passed', 'true')
    expect(stub.reviews).toEqual([{ id: verse.id, exerciseType: 'cloze', passed: true }])
  })

  test('W-M19-L2-006: Xoa cau khoi danh sach sau khi xac nhan @happy @memorize', async ({ tier1Page }) => {
    stub.addVerse({ book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1 })
    const page = tier1Page
    const memorize = new MemorizePage(page)

    await memorize.gotoList()
    await expect(memorize.items).toHaveCount(1)
    await page.getByTestId('memorize-item-delete').click()
    await page.getByTestId('memorize-item-delete-confirm').click()

    await expect(memorize.empty).toBeVisible()
    expect(stub.verses).toHaveLength(0)
  })

  test('W-M19-L2-007: Home hien the cau can on va dan vao phien on @happy @memorize', async ({ tier1Page }) => {
    stub.addVerse({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 })
    stub.addVerse({ book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1 })
    const page = tier1Page
    const memorize = new MemorizePage(page)

    await page.goto('/')
    await expect(memorize.homeDueCard).toBeVisible()
    await expect(memorize.homeDueCard).toContainText('2')
    await memorize.homeDueBtn.click()

    await expect(page).toHaveURL('/practice/memorize/session')
    await expect(memorize.sessionPage).toBeVisible()
  })
})
