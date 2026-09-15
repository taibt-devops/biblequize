import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'
import './styles/tokens.css'
import { useAuthStore } from './store/authStore'
import { installSessionExpiryHandler } from './auth/sessionExpiry'
import { ErrorProvider } from './contexts/ErrorContext'
import { ToastProvider } from './contexts/ToastContext'
import RequireAuth from './contexts/RequireAuth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import { HelmetProvider } from 'react-helmet-async'
import { initStorageSync } from './utils/localStorageClearDetector'
import { i18nReady } from './i18n'
import PageLoader from './components/PageLoader'
import CapacitorBackButton from './platform/CapacitorBackButton'
import { initNative } from './platform/initNative'

// EAGER — critical / first-paint path. These render on initial load (the "/"
// dashboard or guest landing) so they belong in the entry chunk; lazy-loading
// them would add a round-trip to FCP/LCP.
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import LandingPage from './pages/LandingPage'
import Onboarding from './pages/Onboarding'

// LAZY — every other route is split into its own chunk (loaded on navigation).
// This shrinks the entry bundle from ~1.5 MB (all pages) to just the shell.
const HomeKhungSangMock = lazy(() => import('./pages/HomeKhungSangMock'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Profile = lazy(() => import('./pages/Profile'))
const Practice = lazy(() => import('./pages/Practice'))
const Quiz = lazy(() => import('./pages/Quiz'))
const Cosmetics = lazy(() => import('./pages/Cosmetics'))
const WeeklyQuiz = lazy(() => import('./pages/WeeklyQuiz'))
const MysteryMode = lazy(() => import('./pages/MysteryMode'))
const SpeedRound = lazy(() => import('./pages/SpeedRound'))
const Ranked = lazy(() => import('./pages/Ranked'))
const BasicQuiz = lazy(() => import('./pages/BasicQuiz'))
const Rooms = lazy(() => import('./pages/Rooms'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
// Admin is lazy + build-time gated: the mobile (Capacitor) build ships user
// pages only, so the constant VITE_TARGET check lets Rollup drop the whole
// admin chunk from the app bundle. The web build code-splits it as usual.
const AdminRoutes =
  import.meta.env.VITE_TARGET === 'capacitor'
    ? null
    : lazy(() => import('./pages/admin/AdminRoutes'))
const Review = lazy(() => import('./pages/Review'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const RoomLobby = lazy(() => import('./pages/RoomLobby'))
const RoomQuiz = lazy(() => import('./pages/RoomQuiz'))
const RoomQuizHost = lazy(() => import('./pages/room/RoomQuizHost'))
const RoomAnalytics = lazy(() => import('./pages/RoomAnalytics'))
const CreateRoom = lazy(() => import('./pages/CreateRoom'))
const JoinRoom = lazy(() => import('./pages/JoinRoom'))
const Multiplayer = lazy(() => import('./pages/Multiplayer'))
const DailyChallenge = lazy(() => import('./pages/DailyChallenge'))
const Groups = lazy(() => import('./pages/Groups'))
const GroupDetail = lazy(() => import('./pages/GroupDetail'))
const ScheduledQuizCreate = lazy(() => import('./pages/ScheduledQuizCreate'))
const ScheduledQuizDetail = lazy(() => import('./pages/ScheduledQuizDetail'))
const ScheduledQuizPlay = lazy(() => import('./pages/ScheduledQuizPlay'))
const JourneyBuilder = lazy(() => import('./pages/JourneyBuilder'))
const JourneyView = lazy(() => import('./pages/JourneyView'))
const GroupAnalytics = lazy(() => import('./pages/GroupAnalytics'))
const QuizSetList = lazy(() => import('./pages/group/QuizSetList'))
const QuizSetEditor = lazy(() => import('./pages/group/GroupQuizSetEditor'))
const QuizSetDetail = lazy(() => import('./pages/group/QuizSetDetail'))
const Tournaments = lazy(() => import('./pages/Tournaments'))
const TournamentDetail = lazy(() => import('./pages/TournamentDetail'))
const TournamentMatch = lazy(() => import('./pages/TournamentMatch'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const CauDoKinhThanh = lazy(() => import('./pages/CauDoKinhThanh'))
const OnboardingTryQuiz = lazy(() => import('./pages/OnboardingTryQuiz'))
const Journey = lazy(() => import('./pages/Journey'))
const Help = lazy(() => import('./pages/Help'))
const MySets = lazy(() => import('./pages/MySets'))
const PersonalQuizSetEditor = lazy(() => import('./pages/PersonalQuizSetEditor'))
const MemorizeList = lazy(() => import('./pages/memorize/MemorizeList'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Detect cross-tab localStorage changes for ranked data sync
initStorageSync()

// Handle session expiry from API client (logout + SPA redirect). Guarded
// against the re-entrant logout→sync-progress→refresh→expiry request loop.
installSessionExpiryHandler()

// Initialize auth state on app startup (replaces AuthProvider useEffect)
useAuthStore.getState().checkAuth()

/** Show the content-rich LandingPage for guests (good for SEO + first paint),
 *  Home (inside AppLayout) for authenticated users. Onboarding is no longer a
 *  blocking gate at "/": UI language is auto-detected (i18n) and switchable on
 *  the landing header; the guided flow stays reachable at /onboarding. */
function HomeOrLanding() {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return null // wait for auth check
  if (!isAuthenticated) return <LandingPage />
  return <AppLayout />
}

// Native shell setup (status bar, splash, keyboard) — no-op on web.
initNative()

// Wait for the active-language bundle before first paint so the UI never
// flashes raw i18n keys (translations now load as chunks, not inlined).
i18nReady.then(() => {
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorProvider>
          <ToastProvider>
            <BrowserRouter>
              <CapacitorBackButton />
              <Suspense fallback={<PageLoader fullScreen />}>
              <Routes>
                {/* PREVIEW-ONLY: coded mockup of the game-vibe Home redesign (v2).
                    Standalone (own chrome), no auth, no AppLayout. Remove after approval. */}
                <Route path="/home-khung-sang-preview" element={<HomeKhungSangMock />} />
                {/* "/" = LandingPage for guest, Home (with AppLayout) for authenticated */}
                <Route element={<HomeOrLanding />}>
                  <Route path="/" element={<Home />} />
                </Route>

                {/* Pages with AppLayout (sidebar + nav) — requires auth check already done */}
                <Route element={<AppLayout />}>
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                  <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
                  <Route path="/groups/:id" element={<RequireAuth><GroupDetail /></RequireAuth>} />
                  <Route path="/groups/:id/analytics" element={<RequireAuth><GroupAnalytics /></RequireAuth>} />
                  <Route path="/groups/:id/quiz-sets" element={<RequireAuth><QuizSetList /></RequireAuth>} />
                  <Route path="/groups/:id/quiz-sets/new" element={<RequireAuth><QuizSetEditor mode="create" /></RequireAuth>} />
                  <Route path="/groups/:id/quiz-sets/:setId/edit" element={<RequireAuth><QuizSetEditor mode="edit" /></RequireAuth>} />
                  <Route path="/groups/:id/quiz-sets/:setId" element={<RequireAuth><QuizSetDetail /></RequireAuth>} />
                  <Route path="/groups/:id/scheduled-quizzes/new" element={<RequireAuth><ScheduledQuizCreate /></RequireAuth>} />
                  <Route path="/groups/:id/scheduled-quizzes/:quizId" element={<RequireAuth><ScheduledQuizDetail /></RequireAuth>} />
                  <Route path="/groups/:id/scheduled-quizzes/:quizId/play" element={<RequireAuth><ScheduledQuizPlay /></RequireAuth>} />
                  <Route path="/groups/:id/journey/new" element={<RequireAuth><JourneyBuilder /></RequireAuth>} />
                  <Route path="/groups/:id/journey/:journeyId/edit" element={<RequireAuth><JourneyBuilder /></RequireAuth>} />
                  <Route path="/groups/:id/journey/:journeyId" element={<RequireAuth><JourneyView /></RequireAuth>} />
                  <Route path="/tournaments" element={<RequireAuth><Tournaments /></RequireAuth>} />
                  <Route path="/tournaments/:id" element={<RequireAuth><TournamentDetail /></RequireAuth>} />
                  <Route path="/tournaments/:id/match/:matchId" element={<RequireAuth><TournamentMatch /></RequireAuth>} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/journey" element={<Journey />} />
                  <Route path="/cosmetics" element={<RequireAuth><Cosmetics /></RequireAuth>} />
                  <Route path="/weekly-quiz" element={<RequireAuth><WeeklyQuiz /></RequireAuth>} />
                  <Route path="/mystery-mode" element={<RequireAuth><MysteryMode /></RequireAuth>} />
                  <Route path="/speed-round" element={<RequireAuth><SpeedRound /></RequireAuth>} />
                  <Route path="/ranked" element={<Ranked />} />
                  <Route path="/basic-quiz" element={<RequireAuth><BasicQuiz /></RequireAuth>} />
                  <Route path="/daily" element={<DailyChallenge />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/practice/memorize" element={<RequireAuth><MemorizeList /></RequireAuth>} />
                  <Route path="/review" element={<Review />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/multiplayer" element={<RequireAuth><Multiplayer /></RequireAuth>} />
                  <Route path="/rooms" element={<RequireAuth><Rooms /></RequireAuth>} />
                  <Route path="/room/create" element={<RequireAuth><CreateRoom /></RequireAuth>} />
                  <Route path="/room/join" element={<RequireAuth><JoinRoom /></RequireAuth>} />
                  <Route path="/my-sets" element={<RequireAuth><MySets /></RequireAuth>} />
                  <Route path="/my-sets/new" element={<RequireAuth><PersonalQuizSetEditor mode="create" /></RequireAuth>} />
                  <Route path="/my-sets/:setId/edit" element={<RequireAuth><PersonalQuizSetEditor mode="edit" /></RequireAuth>} />
                  {/* Back-compat: legacy /my-sets/:setId redirects users into the new editor. */}
                  <Route path="/my-sets/:setId" element={<RequireAuth><PersonalQuizSetEditor mode="edit" /></RequireAuth>} />
                </Route>

                {/* Public pages (no auth) */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cau-do-kinh-thanh" element={<CauDoKinhThanh />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/onboarding/try" element={<OnboardingTryQuiz />} />

                {/* Full-screen pages (no AppLayout) — immersive gameplay / auth / marketing */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/room/:roomId/lobby" element={<RequireAuth><RoomLobby /></RequireAuth>} />
                <Route path="/room/:roomId/quiz" element={<RequireAuth><RoomQuiz /></RequireAuth>} />
                {/* Sprint 4 (S4-8): Quan Tro spectator + control view. */}
                <Route path="/room/:roomId/host" element={<RequireAuth><RoomQuizHost /></RequireAuth>} />
                <Route path="/room/:roomId/analytics" element={<RequireAuth><RoomAnalytics /></RequireAuth>} />

                {/* Admin — web only; excluded from the mobile app bundle. */}
                {AdminRoutes && (
                  <Route
                    path="/admin/*"
                    element={
                      <React.Suspense fallback={null}>
                        <AdminRoutes />
                      </React.Suspense>
                    }
                  />
                )}

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </ErrorProvider>
      </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
})


