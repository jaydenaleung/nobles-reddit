import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Ui';

// Two bundles. The hall screen (/board) is public and needs no sign-in code,
// so it is kept apart from everything else.
const Board = lazy(() => import('./pages/Board'));
const MemberApp = lazy(() => import('./MemberApp'));
// Development only. The import is behind a build-time check, so it is left out of production builds.
const Styleguide = import.meta.env.DEV ? lazy(() => import('./pages/Styleguide')) : null;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <ToastProvider>
      <ScrollToTop />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/board" element={<Board />} />
          {Styleguide && <Route path="/styleguide" element={<Styleguide />} />}
          <Route path="*" element={<MemberApp />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
