// src/app/(autenticado)/logros/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AchievementCelebration from "@/components/AchievementCelebration";
import "./logros.css";

type Logro = {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  dificultad: "fácil" | "intermedio" | "difícil";
  meta_requerida: number;
  progreso_logros_usuario: {
    progreso_actual: number;
    desbloqueado_en: string | null;
    visto_por_usuario: boolean;
  }[];
};

type LogrosPageProps = {
  setHasNewAchievements?: (value: boolean) => void;
};

export default function LogrosPage({ setHasNewAchievements }: LogrosPageProps) {
  const supabase = createClient();
  const [logros, setLogros] = useState<Logro[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyUnlockedLogros, setNewlyUnlockedLogros] = useState<Logro[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("examflowUser");
    if (!storedUser) {
      window.location.href = "/demo";
      return;
    }
  }, []);

  useEffect(() => {
    const fetchAndMarkLogrosAsSeen = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      // 1. Obtenemos los logros
      const { data, error } = await supabase
        .from("logros")
        .select(
          `*, progreso_logros_usuario ( progreso_actual, desbloqueado_en, visto_por_usuario )`
        )
        .eq("progreso_logros_usuario.user_id", userData.user.id);

      if (data) {
        setLogros(data as Logro[]);

        // 2. Filtrar logros nuevos (desbloqueados pero no vistos)
        const nuevosLogros = (data as Logro[]).filter(
          (logro) =>
            logro.progreso_logros_usuario[0]?.desbloqueado_en &&
            !logro.progreso_logros_usuario[0]?.visto_por_usuario
        );

        if (nuevosLogros.length > 0) {
          setNewlyUnlockedLogros(nuevosLogros);
          setShowCelebration(true);
        }
      }
      setLoading(false);

      // 3. Actualizamos la base de datos para marcar como vistos
      await supabase
        .from("progreso_logros_usuario")
        .update({ visto_por_usuario: true })
        .eq("user_id", userData.user.id)
        .eq("visto_por_usuario", false);

      // 4. Notificamos al layout para que oculte la insignia
      if (setHasNewAchievements) {
        setHasNewAchievements(false);
      }
    };

    fetchAndMarkLogrosAsSeen();
  }, [supabase, setHasNewAchievements]);

  const handleCloseCelebration = () => {
    setShowCelebration(false);
    setNewlyUnlockedLogros([]);
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando logros...</h2>
      </div>
    );
  }

  const unlockedCount = logros.filter(
    (l) => l.progreso_logros_usuario[0]?.desbloqueado_en
  ).length;

  return (
    <div className="page-content logros-page">
      <h1>Tus Logros 🏆</h1>
      <p className="page-description">
        Sigue tu progreso y desbloquea recompensas a medida que aprendes y
        mejoras.
      </p>

      <div className="summary-card">
        <h3>Progreso Total</h3>
        <p>
          Has desbloqueado <strong>{unlockedCount}</strong> de{" "}
          <strong>{logros.length}</strong> logros.
        </p>
        <div className="summary-progress-bar">
          <div
            className="summary-progress-fill"
            style={{ width: `${(unlockedCount / logros.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="logros-grid">
        {logros.map((logro) => {
          const progreso = logro.progreso_logros_usuario[0] || {
            progreso_actual: 0,
          };
          const isUnlocked =
            !!logro.progreso_logros_usuario[0]?.desbloqueado_en;
          const progressPercentage = Math.min(
            (progreso.progreso_actual / logro.meta_requerida) * 100,
            100
          );

          return (
            <div
              key={logro.id}
              className={`logro-card ${isUnlocked ? "unlocked" : ""} ${
                logro.dificultad
              }`}
            >
              <div className="logro-icon">{logro.icono}</div>
              <div className="logro-info">
                <h4>{logro.nombre}</h4>
                <p>{logro.descripcion}</p>
                <div className="logro-progress-bar">
                  <div
                    className="logro-progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <small>
                  {progreso.progreso_actual} / {logro.meta_requerida}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {/* Animación de celebración */}
      {showCelebration && newlyUnlockedLogros.length > 0 && (
        <AchievementCelebration
          logros={newlyUnlockedLogros}
          onClose={handleCloseCelebration}
        />
      )}
    </div>
  );
}
