// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc"; // Importamos el ícono de Google
import "./estilos_login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Añadido para gestionar el estado de carga

  const router = useRouter();
  const supabase = createClient();

  // =======================================================
  // NUEVO BLOQUE CRÍTICO: Manejar la redirección de la sesión
  // =======================================================
  useEffect(() => {
    // Escucha cualquier cambio en el estado de autenticación (incluyendo OAuth y Magic Link)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Cuando el usuario ha iniciado sesión (tras el éxito del callback de la API)
        if (event === "SIGNED_IN" && session) {
          // Nota: Aquí podrías añadir lógica para guardar datos de perfil en localStorage/cookies
          // si fuera necesario para tu middleware, pero si el middleware
          // solo revisa la existencia de la sesión Supabase, esto debería bastar.

          // Redirigir al dashboard y forzar la recarga para que el middleware
          // lea la nueva cookie establecida por el Server Client en el callback.
          router.push("/");
          router.refresh();
        }
      }
    );

    // Limpia el listener al desmontar el componente
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);
  // =======================================================

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "Si existe una cuenta, se ha enviado un enlace para restablecer la contraseña a tu correo."
      );
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      // Modo Registro
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage(
          "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
        );
      }
    } else {
      // Modo Inicio de Sesión
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  // FUNCIÓN CORREGIDA: Iniciar sesión con Google OAuth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // Configuramos la URL de redirección a tu API Handler
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Usamos la ruta de tu API Handler que está en src/app/(autenticado)/auth/callback/route.ts
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      }
      // NOTA: No hacemos router.push aquí. El onAuthStateChange se encargará de la redirección
    } catch (e: any) {
      setError(`Error de autenticación: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (isPasswordRecovery) {
    return (
      <div className="login-page-wrapper">
        {/* Contenedor principal */}
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
      {" "}
      {/* Contenedor principal */}
      <div className="login-container">
        <div className="login-form">
          <h2>{isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}</h2>

          {/* BOTÓN DE GOOGLE */}
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

          {/* Formulario existente */}
          <form onSubmit={handleAuth}>
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
