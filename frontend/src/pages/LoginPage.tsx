import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { role, token } = await api.auth.login(password);
      login(role, token);
      navigate("/", { replace: true });
    } catch {
      setError("Неверный пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#efefef] to-[#dddddd] px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-3xl font-black tracking-[0.15em] uppercase text-luxe-black mb-1">FACE</div>
          <div className="text-xs tracking-widest uppercase text-luxe-grey-mid">Gift Management</div>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label mb-2 block">Пароль</label>
            <input
              type="password"
              className="input w-full"
              placeholder="Введите пароль..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 font-medium">{error}</div>
          )}

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !password}
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="text-center text-xs text-black/30 mt-6 font-light">
          FACE Pigments © 2025
        </p>
      </div>
    </div>
  );
}
