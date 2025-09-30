"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import "./perfil.css"; // Crearemos este archivo a continuación

export default function PerfilPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados para los formularios
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Estados para los mensajes de feedback
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setNewEmail(user?.email || ""); // Pre-rellenamos el email actual
      setLoading(false);
    };
    fetchUser();
  }, [supabase]);

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

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando perfil...</h2>
      </div>
    );
  }

  return (
    <div className="page-content">
      <h1>Gestionar Perfil</h1>

      <div className="profile-forms-container">
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
      </div>
    </div>
  );
}
