// src/app/update-password/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "./update-password.css";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "¡Contraseña actualizada con éxito! Serás redirigido en unos segundos."
      );
      setTimeout(() => {
        router.push("/");
      }, 3000);
    }
  };

  return (
    <div className="update-password-wrapper">
      <div className="update-password-container">
        <div className="update-password-form">
          <h2>Actualizar Contraseña</h2>
          <form onSubmit={handleUpdatePassword}>
            <div className="input-group">
              <label htmlFor="password">Nueva Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="auth-button">
              Actualizar Contraseña
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
