import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import NewEventPage from "./pages/NewEventPage";
import DraftPage from "./pages/DraftPage";
import KnowledgePage from "./pages/KnowledgePage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="events/new" element={<NewEventPage />} />
        <Route path="events/:id/edit" element={<NewEventPage />} />
        <Route path="events/:id/draft" element={<DraftPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
