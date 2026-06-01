import { Outlet, Link, useLocation } from "react-router-dom";

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-500 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">FACE Gifts</span>
            <span className="text-brand-100 text-xs font-normal mt-0.5">Конструктор наборов</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/"
              className={`hover:text-white/80 transition-colors ${loc.pathname === "/" ? "underline" : "text-white/70"}`}
            >
              Мероприятия
            </Link>
            <Link
              to="/knowledge"
              className={`hover:text-white/80 transition-colors ${loc.pathname.startsWith("/knowledge") ? "underline" : "text-white/70"}`}
            >
              База знаний
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-200">
        FACE Pigments © 2025
      </footer>
    </div>
  );
}
