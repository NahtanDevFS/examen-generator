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
  const [isReady, setIsReady] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkRecoveryParams = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) {
        setError("Error al verificar la sesión.");
        return;
      }

      // Si ya hay una sesión activa, probablemente el enlace ya se usó
      if (sessionData.session) {
        // Pero aún podríamos estar en el flujo de recuperación
        // Verificamos el hash manualmente
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          setIsReady(true);
          return;
        } else {
          setError("El enlace de recuperación ya fue usado o es inválido.");
          return;
        }
      }

      // Caso: no hay sesión, pero el hash tiene recovery
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        // Extraer tokens del hash
        const urlParams = new URLSearchParams(hash.replace("#", "?"));
        const accessToken = urlParams.get("access_token");
        const refreshToken = urlParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Establecer la sesión manualmente
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setError("No se pudo establecer la sesión de recuperación.");
          } else {
            setIsReady(true);
          }
        } else {
          setError("Parámetros de recuperación faltantes.");
        }
      } else {
        setError("El enlace de recuperación es inválido o ha expirado.");
      }
    };

    checkRecoveryParams();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) {
      setError("No se puede actualizar la contraseña. La sesión no es válida.");
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
      // Cerrar sesión después de actualizar (opcional pero recomendado)
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
    setLoading(false);
  };

  if (!isReady && error === null) {
    return <p className="info-message">Verificando enlace...</p>;
  }

  if (error) {
    return (
      <div className="update-password-wrapper">
        <div className="update-password-container">
          <div className="update-password-form">
            <h2>Actualizar Contraseña</h2>
            <p className="error-message">{error}</p>
            <a href="/login" className="back-to-login-link">
              Volver al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

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
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
