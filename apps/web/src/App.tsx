import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const Styleguide = lazy(() => import('./pages/Styleguide'));

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>{import.meta.env.DEV && <Route path="/styleguide" element={<Styleguide />} />}</Routes>
    </Suspense>
  );
}
