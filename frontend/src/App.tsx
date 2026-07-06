import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NewEventPage from "./pages/NewEventPage";
import DraftPage from "./pages/DraftPage";
import KnowledgePage from "./pages/KnowledgePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReferencePage from "./pages/ReferencePage";
import ProposalsPage from "./pages/ProposalsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="proposals" element={<ProposalsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reference" element={<ReferencePage />} />
        {/* Admin-only */}
        <Route path="knowledge" element={<RequireAdmin><KnowledgePage /></RequireAdmin>} />
        <Route path="events/new" element={<NewEventPage />} />
        <Route path="events/:id/edit" element={<NewEventPage />} />
        <Route path="events/:id/draft" element={<DraftPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
