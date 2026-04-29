import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'
import { useAuthStore } from './store/authStore'
import { ErrorProvider } from './contexts/ErrorContext'
import RequireAuth from './contexts/RequireAuth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import { HelmetProvider } from 'react-helmet-async'
import { initStorageSync } from './utils/localStorageClearDetector'
import './i18n'
import Home from './pages/Home'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Practice from './pages/Practice'
import Quiz from './pages/Quiz'
import Cosmetics from './pages/Cosmetics'
import WeeklyQuiz from './pages/WeeklyQuiz'
import MysteryMode from './pages/MysteryMode'
import SpeedRound from './pages/SpeedRound'
import Ranked from './pages/Ranked'
import BasicQuiz from './pages/BasicQuiz'
import Rooms from './pages/Rooms'
import AuthCallback from './pages/AuthCallback'
import AdminLayout from './layouts/AdminLayout'
import AppLayout from './layouts/AppLayout'
import AIQuestionGenerator from './pages/admin/AIQuestionGenerator'
import ReviewQueue from './pages/admin/ReviewQueue'
import QuestionsAdmin from './pages/admin/Questions'
import UsersAdmin from './pages/admin/Users'
import RankingsAdmin from './pages/admin/Rankings'
import EventsAdmin from './pages/admin/Events'
import FeedbackAdmin from './pages/admin/Feedback'
import AdminDashboard from './pages/admin/Dashboard'
import GroupsAdmin from './pages/admin/Groups'
import NotificationsAdmin from './pages/admin/Notifications'
import ConfigurationAdmin from './pages/admin/Configuration'
import ExportCenter from './pages/admin/ExportCenter'
import QuestionQuality from './pages/admin/QuestionQuality'
import EarlyUnlockMetrics from './pages/admin/EarlyUnlockMetrics'
import TestPanel from './pages/admin/TestPanel'
import RequireAdmin from './contexts/RequireAdmin'
import Review from './pages/Review'
import Achievements from './pages/Achievements'
import Leaderboard from './pages/Leaderboard'
import RoomLobby from './pages/RoomLobby'
import RoomQuiz from './pages/RoomQuiz'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import Multiplayer from './pages/Multiplayer'
import DailyChallenge from './pages/DailyChallenge'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import GroupAnalytics from './pages/GroupAnalytics'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import TournamentMatch from './pages/TournamentMatch'
import NotFound from './pages/NotFound'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import Onboarding from './pages/Onboarding'
import { useOnboardingStore } from './store/onboardingStore'
import OnboardingTryQuiz from './pages/OnboardingTryQuiz'
import Journey from './pages/Journey'
import Help from './pages/Help'

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

// Handle session expiry from API client — use authStore.logout() then SPA redirect
window.addEventListener('auth:session-expired', () => {
  const PUBLIC_PATHS = ['/', '/login', '/auth/callback', '/practice', '/leaderboard']
  useAuthStore.getState().logout().then(() => {
    if (!PUBLIC_PATHS.includes(window.location.pathname)) {
      window.location.href = '/login'
    }
  })
})

// Initialize auth state on app startup (replaces AuthProvider useEffect)
useAuthStore.getState().checkAuth()

/** Show LandingPage for guests, Home (inside AppLayout) for authenticated users.
 *  First-time visitors go to Onboarding instead of LandingPage. */
function HomeOrLanding() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const hasSeenOnboarding = useOnboardingStore(s => s.hasSeenOnboarding)
  if (isLoading) return null // wait for auth check
  if (!isAuthenticated) {
    if (!hasSeenOnboarding) return <Onboarding />
    return <LandingPage />
  }
  return <AppLayout />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorProvider>
            <BrowserRouter>
              <Routes>
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
                  <Route path="/review" element={<Review />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/multiplayer" element={<RequireAuth><Multiplayer /></RequireAuth>} />
                  <Route path="/rooms" element={<RequireAuth><Rooms /></RequireAuth>} />
                  <Route path="/room/create" element={<RequireAuth><CreateRoom /></RequireAuth>} />
                  <Route path="/room/join" element={<RequireAuth><JoinRoom /></RequireAuth>} />
                </Route>

                {/* Public pages (no auth) */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
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

                {/* Admin */}
                <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<UsersAdmin />} />
                  <Route path="questions" element={<QuestionsAdmin />} />
                  <Route path="feedback" element={<FeedbackAdmin />} />
                  <Route path="rankings" element={<RankingsAdmin />} />
                  <Route path="events" element={<EventsAdmin />} />
                  <Route path="ai-generator" element={<AIQuestionGenerator />} />
                  <Route path="review-queue" element={<ReviewQueue />} />
                  <Route path="groups" element={<GroupsAdmin />} />
                  <Route path="notifications" element={<NotificationsAdmin />} />
                  <Route path="config" element={<ConfigurationAdmin />} />
                  <Route path="export" element={<ExportCenter />} />
                  <Route path="question-quality" element={<QuestionQuality />} />
                  <Route path="metrics/early-unlock" element={<EarlyUnlockMetrics />} />
                  <Route path="test" element={<TestPanel />} />
                </Route>

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
        </ErrorProvider>
      </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
)


