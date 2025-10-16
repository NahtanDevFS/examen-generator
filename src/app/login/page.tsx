//login/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import "./estilos_login.css";
import type { Session } from "@supabase/supabase-js";

interface ExamflowUser {
  id: string;
  name: string;
}

// Componente separado que usa useSearchParams
function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Verificamos si hay un mensaje de éxito en la URL
  useEffect(() => {
    const urlMessage = searchParams.get("message");
    if (urlMessage === "password_updated") {
      setMessage(
        "✅ ¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva contraseña."
      );
    }
  }, [searchParams]);

  const saveUserToLocalStorage = async (userId: string) => {
    const { data: userData, error: userError } = await supabase
      .from("usuario")
      .select("id, nombre_usuario")
      .eq("id", userId)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("Error fetching user profile:", userError);
      return false;
    }

    if (userData) {
      const userToStore: ExamflowUser = {
        id: userData.id,
        name: userData.nombre_usuario,
      };
      localStorage.setItem("examflowUser", JSON.stringify(userToStore));
    } else {
      const userToStore: ExamflowUser = { id: userId, name: "Usuario" };
      localStorage.setItem("examflowUser", JSON.stringify(userToStore));
    }
    return true;
  };

  const handleSuccessfulSignIn = async (session: Session | null) => {
    if (!session) {
      setLoading(false);
      return;
    }

    const success = await saveUserToLocalStorage(session.user.id);
    if (success) {
      window.location.href = "/";
    } else {
      setError("No se pudo cargar tu perfil. Por favor, intenta de nuevo.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("examflowUser");
    if (storedUser) {
      window.location.href = "/";
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSuccessfulSignIn(session);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          handleSuccessfulSignIn(session);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre_usuario: username,
          },
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage(
          "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
        );
      }
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      }
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/login`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "✅ Si la cuenta existe, se ha enviado un enlace de recuperación a tu correo."
      );
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="login-page-wrapper">
        <div className="login-container">
          <div className="login-form">
            <h2>Cargando...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <div className="login-page-wrapper">
        <div className="login-container">
          <div className="login-form">
            <h2>Recuperar Contraseña</h2>
            <p className="subtitle">
              Ingresa tu correo para recibir instrucciones.
            </p>
            <form onSubmit={handlePasswordRecovery}>
              <div className="input-group">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-button" disabled={loading}>
                Enviar Instrucciones
              </button>
            </form>
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}
            <p className="toggle-auth">
              <span onClick={() => setIsPasswordRecovery(false)}>
                Volver a Iniciar Sesión
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page-wrapper">
      <div className="login-container">
        <div className="login-form">
          <h2>{isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
          <button
            type="button"
            className="auth-button google-button"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <FcGoogle size={24} />
            {isSignUp ? "Registrarse con Google" : "Continuar con Google"}
          </button>
          <div className="separator">O</div>
          <form onSubmit={handleAuth}>
            {isSignUp && (
              <div className="input-group">
                <label htmlFor="username">Nombre de Usuario</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="input-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!isSignUp && (
              <div className="forgot-password">
                <span onClick={() => setIsPasswordRecovery(true)}>
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
            )}
            <button type="submit" className="auth-button" disabled={loading}>
              {isSignUp ? "Registrarse" : "Iniciar Sesión"}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
          <p className="toggle-auth">
            {isSignUp ? "¿Ya tienes una cuenta? " : "¿No tienes una cuenta? "}
            <span onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Inicia Sesión" : "Regístrate"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente principal con Suspense
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page-wrapper">
          <div className="login-container">
            <div className="login-form">
              <h2>Cargando...</h2>
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
