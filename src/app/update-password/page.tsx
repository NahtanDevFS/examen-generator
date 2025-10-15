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
  const [pageStatus, setPageStatus] = useState<"verifying" | "ready" | "error">(
    "verifying"
  );

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isProcessing = false;

    const handleRecovery = () => {
      if (window.location.hash.includes("access_token") && !isProcessing) {
        isProcessing = true;
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY") {
              setPageStatus("ready");
              authListener.subscription.unsubscribe();
            }
          }
        );
      }
    };

    handleRecovery();

    const validationTimeout = setTimeout(() => {
      if (pageStatus === "verifying") {
        setError(
          "El enlace de recuperación es inválido, ha expirado o ya fue utilizado. Por favor, solicita uno nuevo."
        );
        setPageStatus("error");
      }
    }, 5000);

    return () => {
      clearTimeout(validationTimeout);
    };
  }, [supabase, pageStatus]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pageStatus !== "ready") {
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
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
    setLoading(false);
  };

  const renderContent = () => {
    if (pageStatus === "verifying") {
      return <p className="info-message">Verificando enlace...</p>;
    }

    if (pageStatus === "error") {
      return (
        <div>
          <p className="error-message">{error}</p>
          <a href="/login" className="back-to-login-link">
            Volver a la página de inicio
          </a>
        </div>
      );
    }

    return (
      <form onSubmit={handleUpdatePassword}>
        <div className="input-group">
          <label htmlFor="password">Nueva Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            // --- LÍNEA CORREGIDA ---
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Introduce tu nueva contraseña"
          />
        </div>
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar Contraseña"}
        </button>
      </form>
    );
  };

  return (
    <div className="update-password-wrapper">
      <div className="update-password-container">
        <div className="update-password-form">
          <h2>Actualizar Contraseña</h2>
          {renderContent()}
          {pageStatus === "ready" && error && (
            <p className="error-message">{error}</p>
          )}
          {message && <p className="success-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
