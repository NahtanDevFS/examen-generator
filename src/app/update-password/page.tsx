// src/app/update-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "./update-password.css";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false); // Estado clave
  const router = useRouter();
  const supabase = createClient();

  // Escuchamos el evento de recuperación para asegurarnos de que la sesión esté lista
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsSessionReady(true); // La sesión está lista, podemos habilitar el formulario
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSessionReady) {
      setError(
        "La sesión de recuperación no es válida. Solicita un nuevo enlace."
      );
      return;
    }

    setLoading(true);
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
        router.push("/"); // Redirige al dashboard o página principal
      }, 3000);
    }
    setLoading(false);
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
                placeholder="Introduce tu nueva contraseña"
              />
            </div>
            <button
              type="submit"
              className="auth-button"
              disabled={loading || !isSessionReady}
            >
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
          {!isSessionReady && !error && (
            <p className="info-message">Verificando enlace...</p>
          )}
        </div>
      </div>
    </div>
  );
}
