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
      className={`tracking-wide transition-colors ${
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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="text-lg font-black tracking-[0.1em] uppercase">FACE</span>
            <span className="text-white/40 text-xs font-light tracking-widest uppercase">Gifts</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {navLink("/", "Мероприятия")}
            {navLink("/analytics", "Аналитика")}
            {/* Admin: Каталог | Employee: Памятка */}
            {role === "admin"    && navLink("/knowledge", "Каталог")}
            {role === "employee" && navLink("/reference", "Памятка")}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 tracking-widest uppercase">
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
