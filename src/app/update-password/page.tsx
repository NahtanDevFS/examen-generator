//update-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "./update-password.css";

export default function UpdatePasswordPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        // 👇 Primero, cierra cualquier sesión activa
        await supabase.auth.signOut();

        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const type = hashParams.get("type");

        if (type === "recovery") {
          console.log("✅ Token de recuperación detectado");
          setStatus("ready");
        } else {
          console.error("❌ No es un enlace de recuperación válido");
          setStatus("error");
        }
      } catch (err) {
        console.error("Error al verificar el token:", err);
        setStatus("error");
      }
    };

    checkRecoveryToken();
  }, []);

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

    try {
      // Actualizamos la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Error al actualizar:", updateError);

        // Si el token expiró o es inválido
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
        return;
      }

      console.log("✅ Contraseña actualizada correctamente");
      setSuccess(true);

      // Esperamos 2 segundos y cerramos sesión
      setTimeout(async () => {
        await supabase.auth.signOut();
        // Limpiamos localStorage
        localStorage.removeItem("examflowUser");
        // Redirigimos al login con mensaje de éxito
        router.push("/login?message=password_updated");
      }, 2000);
    } catch (err: any) {
      console.error("Error inesperado:", err);
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    }
  };

  if (status === "loading") {
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

  if (status === "error") {
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
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="auth-button">
              Actualizar Contraseña
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
