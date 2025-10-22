// src/app/(autenticado)/perfil/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import "./perfil.css";

export default function PerfilPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados para los formularios
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");

  // Estados para los mensajes de feedback
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // --- NUEVO ESTADO ---
  // Estado para los recordatorios (true = activado, false = desactivado)
  const [remindersActive, setRemindersActive] = useState(true);
  // Clave para localStorage
  const REMINDERS_STORAGE_KEY = "examen-generator-reminders";

  useEffect(() => {
    // --- LÓGICA DE RECORDATORIOS ---
    // Cargar el estado de recordatorios desde localStorage
    const storedRemindersState = localStorage.getItem(REMINDERS_STORAGE_KEY);

    // Si no existe, lo dejamos como true (valor por defecto)
    if (storedRemindersState !== null) {
      setRemindersActive(storedRemindersState === "true");
    } else {
      // Si no existe en localStorage, lo seteamos a 'true' por defecto
      localStorage.setItem(REMINDERS_STORAGE_KEY, "true");
    }
    // --- FIN LÓGICA RECORDATORIOS ---

    // Lógica existente para cargar el usuario
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setNewEmail(user?.email || "");

      if (user) {
        const { data: userData, error } = await supabase
          .from("usuario")
          .select("nombre_usuario")
          .eq("id", user.id)
          .single();

        if (userData) {
          setNewUsername(userData.nombre_usuario);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [supabase]); // Dependencia de supabase se mantiene

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(`Error al actualizar la contraseña: ${error.message}`);
    } else {
      setPasswordMessage("¡Contraseña actualizada con éxito!");
      setNewPassword("");
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailMessage("");

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      setEmailError(`Error al actualizar el email: ${error.message}`);
    } else {
      setEmailMessage(
        "Se ha enviado un enlace de confirmación a tu nuevo correo."
      );
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError("");
    setUsernameMessage("");

    if (!user) return;

    const { error } = await supabase
      .from("usuario")
      .update({ nombre_usuario: newUsername })
      .eq("id", user.id);

    if (error) {
      setUsernameError(`Error al actualizar el nombre: ${error.message}`);
    } else {
      setUsernameMessage("¡Nombre de usuario actualizado con éxito!");
    }
  };

  // --- NUEVA FUNCIÓN ---
  // Manejador para el botón de recordatorios
  const handleToggleReminders = () => {
    // Invertimos el estado actual
    const newRemindersState = !remindersActive;

    // Actualizamos el estado en React
    setRemindersActive(newRemindersState);

    // Guardamos el nuevo estado en localStorage como string
    localStorage.setItem(REMINDERS_STORAGE_KEY, String(newRemindersState));
  };
  // --- FIN NUEVA FUNCIÓN ---

  // Función para obtener la primera letra del nombre (en mayúscula)
  const getInitials = (name: string) => {
    return name ? name.trim().charAt(0).toUpperCase() : "U"; // "U" como fallback si no hay nombre
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando perfil...</h2>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="profile-header">
        <div className="profile-avatar">{getInitials(newUsername)}</div>
        <div>
          <h1>Gestionar Perfil</h1>
          <p className="page-description">
            Aquí puedes actualizar tu dirección de correo electrónico y cambiar
            tu contraseña de forma segura.
          </p>
        </div>
      </div>

      <div className="profile-forms-container">
        {/* Formulario de Nombre de Usuario */}
        <div className="profile-card">
          <h2>Actualizar Nombre</h2>
          <form onSubmit={handleUpdateUsername}>
            <div className="input-group">
              <label htmlFor="username">Nombre de Usuario</label>
              <input
                id="username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="profile-button">
              Actualizar Nombre
            </button>
            {usernameError && <p className="error-message">{usernameError}</p>}
            {usernameMessage && (
              <p className="success-message">{usernameMessage}</p>
            )}
          </form>
        </div>

        {/* Formulario de Email */}
        <div className="profile-card">
          <h2>Actualizar Correo</h2>
          <form onSubmit={handleUpdateEmail}>
            <div className="input-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="profile-button">
              Actualizar Correo
            </button>
            {emailError && <p className="error-message">{emailError}</p>}
            {emailMessage && <p className="success-message">{emailMessage}</p>}
          </form>
        </div>

        {/* Formulario de Contraseña */}
        <div className="profile-card">
          <h2>Actualizar Contraseña</h2>
          <form onSubmit={handleUpdatePassword}>
            <div className="input-group">
              <label htmlFor="new-password">Nueva contraseña</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="profile-button">
              Actualizar Contraseña
            </button>
            {passwordError && <p className="error-message">{passwordError}</p>}
            {passwordMessage && (
              <p className="success-message">{passwordMessage}</p>
            )}
          </form>
        </div>

        {/* --- NUEVO BLOQUE --- */}
        {/* Configuración de Recordatorios */}
        <div className="profile-card">
          <h2>Recordatorios de racha</h2>
          <p>
            {remindersActive
              ? "Actualmente tienes los recordatorios activados."
              : "Actualmente tienes los recordatorios desactivados."}
          </p>
          <button
            type="button"
            className="profile-button"
            onClick={handleToggleReminders}
          >
            {remindersActive
              ? "Desactivar recordatorios"
              : "Activar recordatorios"}
          </button>
        </div>
        {/* --- FIN NUEVO BLOQUE --- */}
      </div>
    </div>
  );
}
