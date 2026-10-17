import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queries/client';
import { AuthProvider } from './context/auth';
import { NotifProvider } from './context/notif';
import { RateProvider } from './context/rate';
import { Layout } from './components/Layout';
import { Toaster } from './components/Toaster';

import Login          from './pages/Login';
import AuthCallback   from './pages/AuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import Home           from './pages/Home';
import Search         from './pages/Search';
import Ranking        from './pages/Ranking';
import Notifications  from './pages/Notifications';
import Me             from './pages/Me';
import Settings       from './pages/Settings';
import Feedback       from './pages/Feedback';
import AdminFeedback  from './pages/AdminFeedback';
import Song           from './pages/Song';
import Album          from './pages/Album';
import Artist         from './pages/Artist';
import Profile        from './pages/Profile';
import SharedReview   from './pages/SharedReview';
import Policy         from './pages/Policy';

// Dev only. `import.meta.env.DEV` is a build-time constant, so the production build drops the import.
const Devtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })))
  : null;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotifProvider>
        <RateProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"           element={<Login />} />
              <Route path="/auth/callback"   element={<AuthCallback />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              {/* Public shareable review post — no auth gate */}
              <Route path="/r/:id"           element={<SharedReview />} />
              <Route path="/privacy"         element={<Policy kind="privacy" />} />
              <Route path="/cookies"         element={<Policy kind="cookies" />} />

              <Route element={<Layout />}>
                <Route path="/"              element={<Home />} />
                <Route path="/search"        element={<Search />} />
                <Route path="/ranking"       element={<Ranking />} />
                {/* backward-compat redirect */}
                <Route path="/feed"          element={<Navigate to="/ranking" replace />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/me"            element={<Me />} />
                <Route path="/settings"      element={<Settings />} />
                <Route path="/feedback"        element={<Feedback />} />
                <Route path="/admin/feedback"  element={<AdminFeedback />} />
                <Route path="/song/:id"      element={<Song />} />
                <Route path="/album/:id"     element={<Album />} />
                <Route path="/artist/:id"    element={<Artist />} />
                <Route path="/profile/:id"   element={<Profile />} />
                <Route path="*"              element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster />
        </RateProvider>
      </NotifProvider>
    </AuthProvider>
    {Devtools && <Suspense fallback={null}><Devtools initialIsOpen={false} buttonPosition="bottom-left" /></Suspense>}
    </QueryClientProvider>
  );
}
