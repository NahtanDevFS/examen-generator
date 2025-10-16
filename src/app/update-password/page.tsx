// update-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "./update-password.css";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Ahora controla la verificación inicial
  const [isValidSession, setIsValidSession] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Verifica si hay una sesión de recuperación válida (gracias al middleware)
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.error("❌ No hay una sesión de recuperación válida");
          setIsValidSession(false);
        } else {
          // Opcional: podrías verificar si el usuario tiene el rol o metadata esperada,
          // pero normalmente `getUser()` es suficiente tras un callback de recovery.
          console.log("✅ Sesión de recuperación válida detectada");
          setIsValidSession(true);
        }
      } catch (err) {
        console.error("Error al verificar la sesión:", err);
        setIsValidSession(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkRecoverySession();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error("Error al actualizar la contraseña:", updateError);
        if (
          updateError.message.includes("expired") ||
          updateError.message.includes("invalid")
        ) {
          setError(
            "El enlace ha expirado o ya fue usado. Por favor, solicita uno nuevo."
          );
        } else {
          setError(updateError.message);
        }
        setIsLoading(false);
        return;
      }

      setSuccess(true);

      // Cerrar sesión y redirigir
      await supabase.auth.signOut();
      localStorage.removeItem("examflowUser");

      setTimeout(() => {
        router.push("/login?message=password_updated");
      }, 2000);
    } catch (err: any) {
      console.error("Error inesperado:", err);
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
      setIsLoading(false);
    }
  };

  // Mientras verifica la sesión
  if (isLoading && !success) {
    return (
      <div className="update-password-wrapper">
        <div className="update-password-container">
          <div className="update-password-form">
            <h2>Verificando enlace...</h2>
            <p>Por favor espera un momento.</p>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay sesión válida (enlace inválido/expirado)
  if (!isValidSession && !success) {
    return (
      <div className="update-password-wrapper">
        <div className="update-password-container">
          <div className="update-password-form">
            <h2>❌ Enlace Inválido</h2>
            <p className="error-message">
              El enlace de recuperación es inválido o ha expirado.
            </p>
            <button
              className="auth-button"
              onClick={() => router.push("/login")}
            >
              Volver al Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Éxito
  if (success) {
    return (
      <div className="update-password-wrapper">
        <div className="update-password-container">
          <div className="update-password-form">
            <h2>✅ ¡Contraseña Actualizada!</h2>
            <p className="success-message">
              Tu contraseña se ha actualizado correctamente. Serás redirigido al
              login en unos segundos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Formulario de actualización (solo se muestra si isValidSession === true)
  return (
    <div className="update-password-wrapper">
      <div className="update-password-container">
        <div className="update-password-form">
          <h2>🔒 Actualizar Contraseña</h2>
          <p className="subtitle">Ingresa tu nueva contraseña</p>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="password">Nueva Contraseña</label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <div className="input-group">
              <label htmlFor="confirm-password">Confirmar Contraseña</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
