import { Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { LoginPage } from './routes/LoginPage';
import { PlaceholderPage } from './routes/PlaceholderPage';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

function Shell() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Routes>
          <Route path="hoy" element={<PlaceholderPage title="Hoy" />} />
          <Route path="agenda" element={<PlaceholderPage title="Agenda" />} />
          <Route path="estudio" element={<PlaceholderPage title="Estudio" />} />
          <Route path="foco" element={<PlaceholderPage title="Foco" />} />
          <Route path="mas" element={<PlaceholderPage title="Más" />} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
