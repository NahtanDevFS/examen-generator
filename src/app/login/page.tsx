// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc"; // Importamos el ícono de Google
import "./estilos_login.css";

// Definimos el tipo de objeto que guardaremos en localStorage
interface ExamflowUser {
  id: string;
  name: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleRedirectToDashboard = () => {
    router.push("/");
    router.refresh();
  };

  // Función unificada para obtener y guardar el perfil del usuario en localStorage
  const saveUserToLocalStorage = async (userId: string) => {
    // 1. Obtener el perfil del usuario de la tabla "usuario"
    const { data: userData, error: userError } = await supabase
      .from("usuario")
      .select("id, nombre_usuario")
      .eq("id", userId)
      .single();

    if (!userError && userData) {
      const userToStore: ExamflowUser = {
        id: userData.id,
        name: userData.nombre_usuario,
      };
      localStorage.setItem("examflowUser", JSON.stringify(userToStore));
      return true;
    } else {
      console.error("Error al obtener datos de perfil del usuario:", userError);
      return false;
    }
  };

  // =======================================================
  // BUCLE CRÍTICO: Manejar la redirección y el perfil en localStorage
  // =======================================================
  useEffect(() => {
    // 1. Verificación inicial de localStorage para evitar el "flash" del dashboard
    const storedUser = localStorage.getItem("examflowUser");
    if (storedUser) {
      try {
        const user: ExamflowUser = JSON.parse(storedUser);
        if (user && user.id) {
          // Si el usuario está en localStorage, redirigimos inmediatamente.
          handleRedirectToDashboard();
          return;
        }
      } catch (e) {
        localStorage.removeItem("examflowUser");
      }
    }

    // 2. Escucha cambios en el estado (se activa después de OAuth o Magic Link)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Después de que el callback establece las cookies, el cliente detecta SIGNED_IN.
          setLoading(true); // Bloquear UI mientras procesamos

          // Guardamos el perfil en localStorage y luego redirigimos.
          const success = await saveUserToLocalStorage(session.user.id);

          if (success) {
            handleRedirectToDashboard();
          } else {
            setError("Error al cargar perfil. Intenta de nuevo.");
            setLoading(false);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);
  // =======================================================

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
        "Si existe una cuenta, se ha enviado un enlace para restablecer la contraseña a tu correo."
      );
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      // Modo Registro: Solo registramos. La verificación puede requerir un paso extra.
      const { error, data: signUpData } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre_usuario: "Nuevo Usuario" } },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage(
          "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
        );
      }
    } else {
      // Modo Inicio de Sesión: Autenticación tradicional
      const { error, data: signInData } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });
      if (error) {
        setError(error.message);
      } else if (signInData.session) {
        // Si el login es exitoso, guardamos el perfil y redirigimos
        const success = await saveUserToLocalStorage(signInData.user.id);
        if (success) {
          handleRedirectToDashboard();
        } else {
          setError("Error al cargar perfil. Intenta de nuevo.");
        }
      }
    }
    setLoading(false);
  };

  // FUNCIÓN OAuth con la ruta correcta
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // RUTA CORREGIDA: Apunta a /auth/callback (que se resuelve desde src/app/auth/callback/route.ts)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (e: any) {
      setError(`Error de autenticación: ${e.message}`);
    } finally {
      // El loading se mantendrá hasta que el onAuthStateChange redirija
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
