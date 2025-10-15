"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import "./globals-autenticado.css";
import React from "react";
import { createClient } from "@/lib/supabase/client";

export default function AutenticadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [hasNewAchievements, setHasNewAchievements] = useState(false); // <-- Estado centralizado
  const supabase = createClient();

  // Función para verificar notificaciones, ahora vive en el layout
  const checkNewAchievements = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("progreso_logros_usuario")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("visto_por_usuario", false)
      .limit(1);

    if (data && data.length > 0) {
      setHasNewAchievements(true);
    } else {
      setHasNewAchievements(false);
    }
  };

  useEffect(() => {
    checkNewAchievements();
  }, []);

  return (
    <div
      className={`layout-container ${
        isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      <Sidebar
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        hasNewAchievements={hasNewAchievements} // <-- Pasa el estado al Sidebar
      />
      <main className="main-content">
        {/* Inyectamos la función para actualizar el estado en los componentes hijos */}
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { setHasNewAchievements } as any);
          }
          return child;
        })}
      </main>
    </div>
  );
}
