// src/app/(autenticado)/layout.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";
import "./globals-autenticado.css";

export default function AutenticadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasNewAchievements, setHasNewAchievements] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  const checkForNewAchievements = useCallback(async () => {
    if (pathname === "/logros") {
      if (hasNewAchievements) {
        setHasNewAchievements(false);
      }
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from("progreso_logros_usuario")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("visto_por_usuario", false);

      if (error) {
        throw error;
      }

      setHasNewAchievements((count ?? 0) > 0);
    } catch (error) {
      console.error("Polling for achievements failed:", error);
    }
  }, [pathname, supabase, hasNewAchievements]);

  useEffect(() => {
    checkForNewAchievements();
    const intervalId = setInterval(checkForNewAchievements, 5000);
    return () => clearInterval(intervalId);
  }, [checkForNewAchievements]);

  // ✅ CORRECCIÓN: Comprobamos si 'children' es un elemento válido antes de clonar.
  // Esto soluciona el error de TypeScript de forma segura.
  let pageContent = children;
  if (pathname === "/logros" && React.isValidElement(children)) {
    pageContent = React.cloneElement(
      children as React.ReactElement<{
        setHasNewAchievements?: (value: boolean) => void;
      }>,
      {
        setHasNewAchievements,
      }
    );
  }

  return (
    <div
      className={`layout-container ${isExpanded ? "expanded" : "collapsed"}`}
    >
      <Sidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        hasNewAchievements={hasNewAchievements}
      />
      <main className="main-content">{pageContent}</main>
    </div>
  );
}
