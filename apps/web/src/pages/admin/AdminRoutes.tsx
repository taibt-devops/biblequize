// All admin routes, isolated into one lazy-loaded module so the mobile
// (Capacitor) build can drop the entire admin surface from its bundle — the
// app ships user pages only (see main.tsx VITE_TARGET guard).
//
// Mounted at `/admin/*`, so child paths here are relative (no `/admin` prefix).
import { Routes, Route } from 'react-router-dom'
import RequireAdmin from '../../contexts/RequireAdmin'
import AdminLayout from '../../layouts/AdminLayout'
import AdminDashboard from './Dashboard'
import UsersAdmin from './Users'
import QuestionsAdmin from './Questions'
import QuestionEditPage from './QuestionEditPage'
import FeedbackAdmin from './Feedback'
import RankingsAdmin from './Rankings'
import EventsAdmin from './Events'
import ReviewQueue from './ReviewQueue'
import GroupsAdmin from './Groups'
import NotificationsAdmin from './Notifications'
import QuestionQuality from './QuestionQuality'
import EarlyUnlockMetrics from './EarlyUnlockMetrics'
import TestPanel from './TestPanel'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="questions" element={<QuestionsAdmin />} />
        <Route path="questions/new" element={<QuestionEditPage />} />
        <Route path="questions/:id/edit" element={<QuestionEditPage />} />
        <Route path="feedback" element={<FeedbackAdmin />} />
        <Route path="rankings" element={<RankingsAdmin />} />
        <Route path="events" element={<EventsAdmin />} />
        <Route path="review-queue" element={<ReviewQueue />} />
        <Route path="groups" element={<GroupsAdmin />} />
        <Route path="notifications" element={<NotificationsAdmin />} />
        <Route path="question-quality" element={<QuestionQuality />} />
        <Route path="metrics/early-unlock" element={<EarlyUnlockMetrics />} />
        <Route path="test" element={<TestPanel />} />
      </Route>
    </Routes>
  )
}
