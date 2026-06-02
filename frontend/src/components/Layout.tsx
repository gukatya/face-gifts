import { Outlet, Link, useLocation } from "react-router-dom";

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-luxe-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="text-lg font-black tracking-[0.1em] uppercase">FACE</span>
            <span className="text-white/40 text-xs font-light tracking-widest uppercase">Gifts</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              to="/"
              className={`tracking-wide transition-colors ${
                loc.pathname === "/"
                  ? "text-white font-medium"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Мероприятия
            </Link>
            <Link
              to="/analytics"
              className={`tracking-wide transition-colors ${
                loc.pathname.startsWith("/analytics")
                  ? "text-white font-medium"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Аналитика
            </Link>
            <Link
              to="/knowledge"
              className={`tracking-wide transition-colors ${
                loc.pathname.startsWith("/knowledge")
                  ? "text-white font-medium"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              База знаний
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-luxe-grey-mid py-4 tracking-widest uppercase">
        FACE Pigments © 2025
      </footer>
    </div>
  );
}
