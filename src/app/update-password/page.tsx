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

  // Usaremos un estado para manejar el flujo: 'verifying', 'ready', 'error'
  const [pageStatus, setPageStatus] = useState<"verifying" | "ready" | "error">(
    "verifying"
  );

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Si ya estamos en 'ready' o 'error', no hacemos nada más.
    if (pageStatus !== "verifying") return;

    // Temporizador por si el enlace es inválido y el evento nunca llega.
    const validationTimeout = setTimeout(() => {
      setError(
        "El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo."
      );
      setPageStatus("error");
    }, 5000); // Espera 5 segundos

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          // ¡El evento llegó! Cancelamos el temporizador y actualizamos el estado.
          clearTimeout(validationTimeout);
          setPageStatus("ready");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(validationTimeout); // Limpiamos el temporizador si el componente se desmonta
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
        router.push("/login"); // Es mejor redirigir al login para que inicie sesión
      }, 3000);
    }
    setLoading(false);
  };

  // Función para renderizar el contenido según el estado
  const renderContent = () => {
    if (pageStatus === "verifying") {
      return <p className="info-message">Verificando enlace...</p>;
    }

    if (pageStatus === "error") {
      return <p className="error-message">{error}</p>;
    }

    // Si pageStatus es 'ready', mostramos el formulario
    return (
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
    );
  };

  return (
    <div className="update-password-wrapper">
      <div className="update-password-container">
        <div className="update-password-form">
          <h2>Actualizar Contraseña</h2>
          {renderContent()}
          {/* Mostramos mensajes de éxito o error del envío del formulario */}
          {pageStatus === "ready" && error && (
            <p className="error-message">{error}</p>
          )}
          {message && <p className="success-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
