import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { role, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`tracking-wide transition-colors whitespace-nowrap ${
        loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to))
          ? "text-white font-medium"
          : "text-white/50 hover:text-white/80"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-luxe-black text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Top row: logo + desktop nav + logout */}
          <div className="flex items-center justify-between py-3 sm:py-4">
            <Link to="/" className="flex items-baseline gap-2.5 shrink-0">
              <span className="text-lg font-black tracking-[0.1em] uppercase">FACE</span>
              <span className="text-white/40 text-xs font-light tracking-widest uppercase">Gifts</span>
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Desktop nav — hidden on mobile */}
              <nav className="hidden sm:flex items-center gap-6 text-sm">
                {navLink("/", "Мероприятия")}
                {navLink("/analytics", "Аналитика")}
                {role === "admin"    && navLink("/knowledge", "Каталог")}
                {role === "employee" && navLink("/reference", "Памятка")}
              </nav>
              <span className="hidden sm:inline text-xs text-white/30 tracking-widest uppercase">
                {role === "admin" ? "Администратор" : "Сотрудник"}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs text-white/40 hover:text-white/70 transition-colors tracking-wide"
              >
                Выйти
              </button>
            </div>
          </div>
          {/* Mobile nav — second row, hidden on sm+ */}
          <nav className="flex sm:hidden items-center gap-5 text-sm pb-3 border-t border-white/10 pt-2.5 overflow-x-auto scrollbar-none">
            {navLink("/", "Мероприятия")}
            {navLink("/analytics", "Аналитика")}
            {role === "admin"    && navLink("/knowledge", "Каталог")}
            {role === "employee" && navLink("/reference", "Памятка")}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-luxe-grey-mid py-4 tracking-widest uppercase">
        FACE Pigments © 2025
      </footer>
    </div>
  );
}
