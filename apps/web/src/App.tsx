import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Ui';

// The Gleason TV page (/board) is public and needs no sign-in code, so it gets its own bundle.
const Board = lazy(() => import('./pages/Board'));
const MemberApp = lazy(() => import('./MemberApp'));

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
          <Route path="*" element={<MemberApp />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
