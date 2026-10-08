import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'
import { getTierByPoints } from '../data/tiers'
import PageMeta from '../components/PageMeta'
import QuizLanguageSelect from '../components/QuizLanguageSelect'
import HeroIllustration from '../components/HeroIllustration'

/* ────────────────────────────── Guest Header ────────────────────────────── */

function GuestHeader() {
  const { t } = useTranslation()
  // Scroll-spy: highlight the nav item for whichever section holds the
  // viewport's vertical center. "Trang chủ" wins at the top (hero), "Giới
  // thiệu" over the features grid, "Xếp hạng" over the leaderboard preview.
  const [active, setActive] = useState<'home' | 'features' | 'leaderboard'>('home')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = ['features', 'leaderboard']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    if (els.length === 0) return
    const visible: Record<string, boolean> = {}
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible[e.target.id] = e.isIntersecting
        setActive(visible.leaderboard ? 'leaderboard' : visible.features ? 'features' : 'home')
      },
      // A thin band around the viewport's vertical center. (A zero-height
      // "-50%/-50%" line makes isIntersecting flaky — zero-area intersection.)
      { rootMargin: '-45% 0px -45% 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  // Smooth-scroll to an on-page section (no id = back to top) instead of
  // routing away — the leaderboard preview lives lower on this same page.
  const scrollTo = (id?: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const navBase = 'font-body tracking-tight transition-colors duration-300'
  const navActive = 'text-bq-amberd border-b-2 border-bq-amber pb-1'
  const navIdle = 'text-bq-ink2 hover:text-bq-ink'
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 bg-bq-white/90 backdrop-blur border-b border-bq-hair shadow-bq-soft">
      <div className="flex items-center gap-4 sm:gap-8 max-w-7xl mx-auto w-full">
        <div className="text-xl sm:text-2xl font-bold tracking-tighter text-bq-amberd font-display">BibleQuiz</div>
        <div className="hidden md:flex gap-6 items-center flex-1">
          <a
            href="#"
            onClick={scrollTo()}
            className={`${navBase} ${active === 'home' ? navActive : navIdle}`}
          >
            {t('nav.home')}
          </a>
          <a
            href="#leaderboard"
            onClick={scrollTo('leaderboard')}
            className={`${navBase} ${active === 'leaderboard' ? navActive : navIdle}`}
          >
            {t('nav.leaderboard')}
          </a>
          <a
            href="#features"
            onClick={scrollTo('features')}
            className={`${navBase} ${active === 'features' ? navActive : navIdle}`}
          >
            {t('landing.about')}
          </a>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          <QuizLanguageSelect className="hidden sm:flex" />
          <Link
            to="/login"
            className="px-2 sm:px-4 py-2 text-sm font-semibold text-bq-ink2 hover:text-bq-ink transition-colors active:scale-95 whitespace-nowrap"
          >
            {t('auth.login')}
          </Link>
          <Link
            to="/login"
            className="bg-bq-action px-4 sm:px-6 py-2 rounded-xl text-bq-ink shadow-bq-action font-bold text-sm sm:text-base active:scale-95 transition-transform inline-block whitespace-nowrap"
          >
            {t('auth.register')}
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ────────────────────────────── Hero Section ────────────────────────────── */

function HeroSection() {
  const { t } = useTranslation()
  return (
    <header className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 overflow-hidden">
      {/* Lightwell atmosphere — high sun ray + jewel refraction, very faint */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-bq-amber/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-bq-sapphire/15 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Left – copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bq-amber/10 border border-bq-amber/30 text-bq-amberd text-sm font-medium tracking-wide">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            {t('landing.tagline')}
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-bq-ink">
            {t('landing.heroTitle1')}<span className="text-bq-amberd">{t('landing.heroHighlight')}</span>{t('landing.heroTitle2')}
          </h1>

          <p className="text-base sm:text-xl text-bq-ink2 leading-relaxed max-w-lg">
            {t('landing.heroDesc')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/practice"
              className="bg-bq-action px-8 py-4 rounded-xl text-bq-ink font-bold text-lg shadow-bq-action active:scale-95 transition-transform text-center"
            >
              {t('landing.tryNow')}
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 rounded-xl border border-bq-hair text-bq-ink font-bold text-lg hover:bg-bq-inset transition-colors active:scale-95 text-center"
            >
              {t('auth.login')}
            </Link>
          </div>
        </div>

        {/* Right – illustration */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-bq-amber/10 rounded-[2rem] blur-2xl group-hover:bg-bq-amber/20 transition-all" />
          <HeroIllustration />

          {/* Floating streak card */}
          <div className="absolute -bottom-6 -left-6 bg-bq-white p-6 rounded-2xl border border-bq-hair shadow-bq-soft hidden lg:block">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-bq-flame shadow-bq-flame flex items-center justify-center text-white">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  local_fire_department
                </span>
              </div>
              <div>
                <p className="text-[12.5px] text-bq-amberd font-bold">{t('landing.dailyStreak')}</p>
                <p className="text-xl font-bold text-bq-ink">{t('landing.daysStreak', { count: 15 })}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ────────────────────────────── Features Grid ───────────────────────────── */

const featureKeys = [
  { icon: 'menu_book', titleKey: 'landing.feature1Title', descKey: 'landing.feature1Desc', accent: 'text-bq-sapphire', tint: 'bg-bq-sapphire/10', edge: 'group-hover:border-bq-sapphire' },
  { icon: 'stars', titleKey: 'landing.feature2Title', descKey: 'landing.feature2Desc', accent: 'text-bq-amberd', tint: 'bg-bq-amber/10', edge: 'group-hover:border-bq-amber' },
  { icon: 'church', titleKey: 'landing.feature3Title', descKey: 'landing.feature3Desc', accent: 'text-bq-emerald', tint: 'bg-bq-emerald/10', edge: 'group-hover:border-bq-emerald' },
  { icon: 'workspace_premium', titleKey: 'landing.feature4Title', descKey: 'landing.feature4Desc', accent: 'text-bq-ruby', tint: 'bg-bq-ruby/10', edge: 'group-hover:border-bq-ruby' },
]

function FeaturesGrid() {
  const { t } = useTranslation()
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 bg-bq-paper" aria-label={t('landing.features')}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold mb-4 text-bq-ink">{t('landing.features')}</h2>
          <div className="h-1 w-20 bg-bq-spectrum mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureKeys.map((f) => (
            <div
              key={f.icon}
              className={`p-8 bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl hover:-translate-y-1 transition-all duration-300 border-b-2 ${f.edge} group`}
            >
              <div className={`w-14 h-14 rounded-xl ${f.tint} flex items-center justify-center ${f.accent} mb-6 group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-3xl">{f.icon}</span>
              </div>
              <h3 className="font-display text-xl font-bold mb-3 text-bq-ink">{t(f.titleKey)}</h3>
              <p className="text-bq-ink2">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Try Now Section ─────────────────────────── */

function TryNowSection() {
  const { t } = useTranslation()
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6" aria-label="Trải nghiệm thử thách">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Left info */}
        <div>
          <h2 className="font-display text-4xl font-bold mb-6 text-bq-ink">{t('landing.tryChallenge')}</h2>
          <p className="text-lg text-bq-ink2 mb-10 leading-relaxed">
            {t('landing.tryChallengeDesc')}
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl border-l-4 border-l-bq-amber">
              <span className="material-symbols-outlined text-bq-amberd text-3xl mt-1">verified</span>
              <div>
                <h3 className="font-bold text-lg mb-1 text-bq-ink">{t('landing.updatedRegularly')}</h3>
                <p className="text-bq-ink2 text-sm">
                  {t('landing.updatedRegularlyDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl border-l-4 border-l-bq-sapphire">
              <span className="material-symbols-outlined text-bq-sapphire text-3xl mt-1">devices</span>
              <div>
                <h3 className="font-bold text-lg mb-1 text-bq-ink">{t('landing.multiPlatform')}</h3>
                <p className="text-bq-ink2 text-sm">
                  {t('landing.multiPlatformDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right cards */}
        <div className="grid gap-6">
          {/* Daily Challenge Card */}
          <div className="bg-bq-white p-6 sm:p-8 rounded-3xl relative overflow-hidden group border border-bq-hair shadow-bq-soft">
            <span aria-hidden className="absolute top-0 inset-x-0 h-[5px] bg-bq-spectrum" />
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
              <span className="px-3 py-1 bg-bq-amber/15 text-bq-amberd text-xs font-bold rounded-full whitespace-nowrap">
                {t('landing.popular')}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold mb-2 pr-20 text-bq-ink">{t('landing.dailyChallenge')}</h3>
            <p className="text-bq-ink2 mb-6 text-sm sm:text-base">
              {t('landing.dailyChallengeDesc')}
            </p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bq-inset text-bq-ink2 text-[11px] sm:text-xs font-bold whitespace-nowrap">
                <span className="material-symbols-outlined text-[14px]">group</span>
                {t('landing.playersCount')}
              </div>
              <Link
                to="/daily"
                className="bg-bq-action px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-bq-ink shadow-bq-action font-bold text-sm sm:text-base active:scale-95 transition-transform inline-block whitespace-nowrap"
              >
                {t('gameModes.dailyBtn')}
              </Link>
            </div>
          </div>

          {/* Quick Practice Card */}
          <div className="bg-bq-white p-6 sm:p-8 rounded-3xl border border-bq-hair shadow-bq-soft hover:-translate-y-1 transition-transform">
            <h3 className="font-display text-xl sm:text-2xl font-bold mb-2 text-bq-ink">{t('landing.quickPractice')}</h3>
            <p className="text-bq-ink2 mb-6 text-sm sm:text-base">
              {t('landing.quickPracticeDesc')}
            </p>
            <Link
              to="/practice"
              className="block w-full py-3 sm:py-4 rounded-xl border border-bq-sapphire text-bq-sapphire font-bold hover:bg-bq-sapphire/10 transition-all active:scale-95 text-center"
            >
              {t('common.startNow')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Leaderboard Preview ─────────────────────── */

// Hardcoded fallback — shown only while the live board loads or when it's
// empty (also keeps the SEO-prerendered HTML non-blank). Tier keys: OLD
// religious naming per DECISIONS.md 2026-04-19 (audience-driven).
const leaderboardData = [
  { rank: '01', initials: 'AN', name: 'Nguyễn Văn An', xp: '24,500', titleKey: 'tiers.apostle', top: true },
  { rank: '02', initials: 'LH', name: 'Lê Hồng Hạnh', xp: '21,200', titleKey: 'tiers.prophet', top: false },
  { rank: '03', initials: 'TM', name: 'Trần Minh', xp: '19,850', titleKey: 'tiers.sage', top: false },
  { rank: '10', initials: 'DP', name: 'Đặng Phương', xp: '12,400', titleKey: 'tiers.disciple', top: false },
]

/** First letter of first + last name word (e.g. "Nguyễn Văn An" → "NA"). */
function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function LeaderboardPreview() {
  const { t } = useTranslation()
  // Real top-10 national board from the no-auth public endpoint. Falls back to
  // the curated sample while loading / on error so the section never looks broken.
  const { data } = useQuery({
    queryKey: ['public-leaderboard', 'all-time', 10],
    queryFn: () => api.get('/api/public/leaderboard?period=all-time&size=10').then(r => r.data).catch(() => null),
    staleTime: 60_000,
  })
  const live = Array.isArray(data) ? data : []
  const isLive = live.length > 0
  const rows = isLive
    ? live.slice(0, 10).map((e: any, i: number) => ({
        rank: String(i + 1).padStart(2, '0'),
        initials: initialsOf(e.name),
        name: e.name || 'An danh',
        xp: (e.points ?? 0).toLocaleString(),
        titleKey: getTierByPoints(e.points ?? 0).nameKey,
        top: i === 0,
      }))
    : leaderboardData
  return (
    <section id="leaderboard" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 bg-bq-paper" aria-label="Bảng xếp hạng">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block px-6 py-2 rounded-full bg-bq-action text-bq-ink shadow-bq-action font-extrabold text-lg mb-6">
            {import.meta.env.VITE_SEASON_NAME || t('landing.seasonDefault')}
          </div>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-bq-ink">{t('landing.nationalLeaderboard')}</h2>
        </div>

        <div className="bg-bq-white rounded-2xl sm:rounded-[2rem] overflow-hidden border border-bq-hair shadow-bq-soft">
          {/* Header row */}
          <div className="grid grid-cols-12 px-4 sm:px-8 py-3 sm:py-4 bg-bq-inset text-[12px] sm:text-xs font-bold text-bq-ink2">
            <div className="col-span-2">{t('landing.rank')}</div>
            <div className="col-span-7 sm:col-span-6">{t('landing.warrior')}</div>
            <div className="col-span-3 sm:col-span-2">XP</div>
            <div className="hidden sm:block sm:col-span-2 text-right">{t('landing.titleHeader')}</div>
          </div>

          <div className="divide-y divide-bq-hair">
            {rows.map((entry, idx) => (
              <div key={entry.rank}>
                <div
                  className={`grid grid-cols-12 px-4 sm:px-8 py-3 sm:py-5 items-center gap-2 ${
                    entry.top ? 'bg-bq-amber/10' : 'hover:bg-bq-inset transition-colors'
                  }`}
                >
                  <div className={`col-span-2 ${entry.top ? 'font-black text-xl sm:text-2xl text-bq-amberd' : 'font-bold text-bq-ink2'}`}>
                    {entry.rank}
                  </div>
                  <div className="col-span-7 sm:col-span-6 flex items-center gap-2 sm:gap-4 min-w-0">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-base flex-shrink-0 ${
                        entry.top
                          ? 'bg-bq-amberd text-white'
                          : 'bg-bq-sapphire/10 text-bq-sapphire'
                      }`}
                    >
                      {entry.initials}
                    </div>
                    <span className={`font-bold truncate text-sm sm:text-base text-bq-ink ${entry.top ? 'sm:text-lg' : ''}`}>{entry.name}</span>
                  </div>
                  <div className={`col-span-3 sm:col-span-2 font-mono text-xs sm:text-base ${entry.top ? 'text-bq-amberd' : 'text-bq-ink2'}`}>
                    {entry.xp}
                  </div>
                  <div
                    className={`hidden sm:block sm:col-span-2 text-right text-[9px] sm:text-xs font-bold uppercase truncate ${
                      entry.top ? 'text-bq-amberd' : idx < 3 ? 'text-bq-sapphire' : 'text-bq-ink2'
                    }`}
                  >
                    {t(entry.titleKey)}
                  </div>
                </div>

                {/* Ellipsis between rank 03 and rank 10 — fallback sample only
                    (it jumps 03→10); the live board is contiguous top-N. */}
                {!isLive && entry.rank === '03' && (
                  <div className="text-center py-4 text-bq-ink3">&bull;&bull;&bull;</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          {/* Guests see only the public teaser; the full board (with "your rank",
              tiers, seasons) needs an account, so funnel them to login rather
              than the bare guest /leaderboard view. */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-bq-amberd font-bold hover:underline"
          >
            {t('leaderboard.loginToViewBoard')}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Church Group Showcase ────────────────────── */

function ChurchGroupShowcase() {
  const { t } = useTranslation()
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative" aria-label="Nhóm hội thánh">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Image */}
        <div className="order-2 lg:order-1 relative">
          <div className="absolute -inset-10 bg-bq-emerald/10 rounded-full blur-[100px]" />
          <img
            alt="Nhóm bạn trẻ học Kinh Thánh qua trắc nghiệm"
            width={600}
            height={400}
            loading="lazy"
            className="relative rounded-[2rem] shadow-bq-soft z-10"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnm3LIt9EiyqGvjOzhF7rg8NoKMQoAjbDHWgkYgYTcjATw8YGu6nvIwD21ypU3A5cSNU5YgzZ4oStRZaYpVP37Fv9KrmqJ1yTWYyNV8MPJOP9EQDvi7dwbLUPj2GK18ZXveYRRuAkiOMNcerFyYD3JwSSOXaWoBWLHZnb1UJZSmhsA5ppJF4A78tXcbZMRiP5dnGucV58PQs__oVK1uan3IZwbSeQ1R7wfr--M3W8K2cn0zQGPw2NGpSpzUFnFsNsWkUcurItdKsw"
          />

          {/* Floating stats */}
          <div className="absolute top-10 -right-8 bg-bq-white p-6 rounded-2xl shadow-bq-soft z-20 border border-bq-hair hidden md:block">
            <div className="text-sm font-bold text-bq-emerald mb-4 uppercase tracking-widest">{t('landing.teamProgress')}</div>
            <div className="space-y-3">
              <div className="h-2 w-48 bg-bq-inset rounded-full overflow-hidden">
                <div className="h-full w-[75%] bg-bq-spectrum" />
              </div>
              <div className="h-2 w-48 bg-bq-inset rounded-full overflow-hidden">
                <div className="h-full w-[45%] bg-bq-spectrum" />
              </div>
            </div>
          </div>
        </div>

        {/* Text + features */}
        <div className="order-1 lg:order-2 space-y-8">
          <h2 className="font-display text-4xl font-bold leading-tight text-bq-ink">{t('landing.churchGroup')}</h2>
          <p className="text-lg text-bq-ink2 leading-relaxed">
            {t('landing.churchGroupDesc')}
          </p>

          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-bq-emerald">qr_code_2</span>
              <span className="text-bq-ink font-medium">{t('landing.qrJoin')}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-bq-emerald">analytics</span>
              <span className="text-bq-ink font-medium">{t('landing.weeklyReport')}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-bq-emerald">emoji_events</span>
              <span className="text-bq-ink font-medium">{t('landing.internalTournament')}</span>
            </li>
          </ul>

          <Link
            to="/groups"
            className="bg-bq-action px-8 py-4 rounded-xl text-bq-ink font-bold text-lg active:scale-95 transition-transform shadow-bq-action inline-block"
          >
            {t('landing.createFreeGroup')}
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Daily Verse ──────────────────────────────── */

function DailyVerse() {
  const { t } = useTranslation()
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-bq-paper" aria-label="Câu Kinh Thánh mỗi ngày">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-1 bg-bq-spectrum mx-auto mb-10 rounded-full" />
        <div className="relative px-12">
          <span className="material-symbols-outlined text-7xl text-bq-amber/30 absolute -top-8 -left-2 scale-x-[-1]">
            format_quote
          </span>
          <blockquote className="font-literata text-3xl md:text-4xl font-light italic leading-relaxed text-bq-ink mb-8">
            &ldquo;{t('landing.verseText')}&rdquo;
          </blockquote>
          <cite className="text-xl font-bold text-bq-amberd not-italic">{t('landing.verseRef')}</cite>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Footer CTA ───────────────────────────────── */

function FooterCTA() {
  const { t } = useTranslation()
  const handleGoogleSignup = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || ''}/oauth2/authorization/google`
  }

  return (
    <section className="py-32 px-6 relative overflow-hidden text-center" aria-label="Đăng ký miễn phí">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bq-paper to-bq-amber/10" />
      <div className="max-w-2xl mx-auto space-y-10">
        <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-bq-ink">
          {t('landing.readyToExplore')}
        </h2>
        <p className="text-bq-ink2 text-lg">
          {t('landing.joinCommunity')}
        </p>
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleGoogleSignup}
            className="flex items-center gap-3 bg-bq-ink text-white px-10 py-4 rounded-xl font-bold text-lg hover:brightness-110 transition-all active:scale-95"
          >
            <img
              alt="Google"
              width={24}
              height={24}
              loading="lazy"
              className="w-6 h-6"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcJIraLBnXjAOS0EXUCIC2rsomKCPxGvpBNYCmt4hQSQzzTt3HaTfkiLVJf9Wgb_lImqBmvVodHASMpqGU5bh1M6pMBhnDWC4ACT6pdtz__gRW5ca7GOmAoVj9qqJAfvRUSwIg27rDceLWagSU29hiYRkHKoVLfsohGVdXJWj01Kae2VDprsg2QNIbxhKzQTIsCspOQnwjByjN_-TX-4TvnQUGIy7hPsg0H5mcnRNMACynXMRatZ3R8cLaWiPG4q6Qko0ODPnYMLE"
            />
            {t('auth.loginWithGoogle')}
          </button>
          <p className="text-sm text-bq-ink3">
            {t('auth.freeNoAds')}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── Footer ───────────────────────────────────── */

function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-bq-inset border-t border-bq-hair">
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="text-lg font-bold text-bq-amberd font-display">BibleQuiz</div>
        <p className="font-body text-sm leading-relaxed text-bq-ink2">
          {t('landing.copyright')}
        </p>
      </div>
      <div className="flex gap-8">
        <a className="font-body text-sm text-bq-ink2 hover:text-bq-amberd transition-colors" href="/cau-do-kinh-thanh">
          Câu đố Kinh Thánh
        </a>
        <a className="font-body text-sm text-bq-ink2 hover:text-bq-amberd transition-colors" href="/help">
          {t('nav.help')}
        </a>
        <a className="font-body text-sm text-bq-ink2 hover:text-bq-amberd transition-colors" href="/privacy">
          {t('landing.privacy')}
        </a>
        <a className="font-body text-sm text-bq-ink2 hover:text-bq-amberd transition-colors" href="/terms">
          {t('landing.terms')}
        </a>
      </div>
      <div className="flex gap-4">
        <div className="w-8 h-8 rounded-full bg-bq-white border border-bq-hair flex items-center justify-center text-bq-ink2 hover:text-bq-amberd transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-lg">language</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-bq-white border border-bq-hair flex items-center justify-center text-bq-ink2 hover:text-bq-amberd transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-lg">share</span>
        </div>
      </div>
    </footer>
  )
}

/* ────────────────────────────── Landing Page ─────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) return null

  return (
    <div data-testid="landing-page" className="bg-bq-paper font-body text-bq-ink selection:bg-bq-amber selection:text-white min-h-dvh">
      <PageMeta
        title="Trắc Nghiệm Kinh Thánh – Câu Đố Kinh Thánh Online"
        description="Trắc nghiệm Kinh Thánh & câu đố Kinh Thánh Tin Lành online miễn phí — học Lời Chúa qua quiz tương tác, thi đấu cùng cộng đồng và nhóm hội thánh Việt Nam."
        canonicalPath="/"
      />
      <GuestHeader />
      <main>
        <HeroSection />
        <FeaturesGrid />
        <TryNowSection />
        <LeaderboardPreview />
        <ChurchGroupShowcase />
        <DailyVerse />
        <FooterCTA />
      </main>
      <Footer />
    </div>
  )
}
