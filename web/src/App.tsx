import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/auth';
import { NotifProvider } from './context/notif';
import { RateProvider } from './context/rate';
import { Layout } from './components/Layout';

import Login          from './pages/Login';
import AuthCallback   from './pages/AuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import Home           from './pages/Home';
import Search         from './pages/Search';
import Ranking        from './pages/Ranking';
import Notifications  from './pages/Notifications';
import Me             from './pages/Me';
import Feedback       from './pages/Feedback';
import AdminFeedback  from './pages/AdminFeedback';
import Song           from './pages/Song';
import Album          from './pages/Album';
import Artist         from './pages/Artist';
import Profile        from './pages/Profile';

export default function App() {
  return (
    <AuthProvider>
      <NotifProvider>
        <RateProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"           element={<Login />} />
              <Route path="/auth/callback"   element={<AuthCallback />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />

              <Route element={<Layout />}>
                <Route path="/"              element={<Home />} />
                <Route path="/search"        element={<Search />} />
                <Route path="/ranking"       element={<Ranking />} />
                {/* backward-compat redirect */}
                <Route path="/feed"          element={<Navigate to="/ranking" replace />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/me"            element={<Me />} />
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
        </RateProvider>
      </NotifProvider>
    </AuthProvider>
  );
}
