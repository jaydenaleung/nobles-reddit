import { isModeratorRole } from '@commons/shared';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { PublicFrame, Shell } from './components/Layout';
import { Loading } from './components/Ui';
import { MineProvider, SpacesProvider } from './data/hooks';

const Feed = lazy(() => import('./pages/Feed'));
const Search = lazy(() => import('./pages/Feed').then((m) => ({ default: m.Search })));
const Thread = lazy(() => import('./pages/Thread'));
const NewPost = lazy(() => import('./pages/NewPost'));
const Me = lazy(() => import('./pages/Me'));
const Spaces = lazy(() => import('./pages/Me').then((m) => ({ default: m.Spaces })));
const Values = lazy(() => import('./pages/Values'));
const Mod = lazy(() => import('./pages/Mod'));
const Admin = lazy(() => import('./pages/Admin'));
const AuditLog = lazy(() => import('./pages/Admin').then((m) => ({ default: m.AuditLog })));
const SignIn = lazy(() => import('./pages/Gate').then((m) => ({ default: m.SignIn })));
const Onboarding = lazy(() => import('./pages/Gate').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/Gate').then((m) => ({ default: m.NotFound })));
// Emulator builds only. The constant is replaced at build time, so production leaves this out.
declare const __USE_EMULATORS__: boolean;
const DevEntry = __USE_EMULATORS__ ? lazy(() => import('./dev/DevEntry')) : null;

function Waiting() {
  return (
    <PublicFrame>
      <Loading />
    </PublicFrame>
  );
}

/** Everything inside is for signed-in, onboarded members of the school. */
function MembersOnly() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Waiting />;
  if (state.status === 'signedOut')
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (state.status === 'needsOnboarding') return <Navigate to="/onboarding" replace />;
  return (
    <SpacesProvider>
      <MineProvider>
        <Shell />
      </MineProvider>
    </SpacesProvider>
  );
}

/** The server checks roles on every call and in the rules. This only keeps the page from showing. */
function RoleOnly({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== 'member') return null;
  const allowed = admin ? state.role === 'admin' : isModeratorRole(state.role);
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function WithAuth() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

/** Every route except the hall screen. Loaded on demand, so /board never downloads the sign-in code. */
export default function MemberApp() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<WithAuth />}>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/values" element={<Values />} />
          <Route path="/about" element={<Navigate to="/values" replace />} />
          {DevEntry && <Route path="/dev" element={<DevEntry />} />}
          <Route element={<MembersOnly />}>
            <Route path="/" element={<Feed />} />
            <Route path="/s/:slug" element={<Feed />} />
            <Route path="/t/:postId" element={<Thread />} />
            <Route path="/new" element={<NewPost />} />
            <Route path="/me" element={<Me />} />
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/search" element={<Search />} />
            <Route
              path="/mod"
              element={
                <RoleOnly>
                  <Mod />
                </RoleOnly>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleOnly admin>
                  <Admin />
                </RoleOnly>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RoleOnly admin>
                  <AuditLog />
                </RoleOnly>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
