"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // ✅ singleton
import { useRouter } from "next/navigation";
import "./update-password.css";

export default function UpdatePasswordPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            console.error("Error setting session:", error);
            setStatus("error");
          } else {
            setStatus("ready");
          }
        });
    } else {
      setStatus("error");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      await supabase.auth.signOut(); // 👈 importante: cerrar sesión
      router.push("/login?message=password_updated");
    }
  };

  if (status === "loading") return <p>Verificando enlace...</p>;
  if (status === "error") return <p>El enlace es inválido o ya fue usado.</p>;

  return (
    <div className="update-password-wrapper">
      <div className="update-password-container">
        <h2>Actualizar Contraseña</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="error-message">{error}</p>}
          <button type="submit">Actualizar Contraseña</button>
        </form>
      </div>
    </div>
  );
}
