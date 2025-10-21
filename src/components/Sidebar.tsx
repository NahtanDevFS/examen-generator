// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startOfDay } from "date-fns";
import "./Sidebar.css";
import {
  FiHome,
  FiClock,
  FiUser,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiX,
  FiBarChart2,
  FiTag,
  FiCpu,
  FiAward,
} from "react-icons/fi";

type SidebarProps = {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  hasNewAchievements: boolean;
};

export default function Sidebar({
  isExpanded,
  setIsExpanded,
  hasNewAchievements,
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakActiveToday, setStreakActiveToday] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Obtener nombre de usuario
        const { data: userData } = await supabase
          .from("usuario")
          .select("nombre_usuario")
          .eq("id", user.id)
          .single();
        if (userData) {
          setUsername(userData.nombre_usuario);
        }

        // Calcular racha
        const { data: attemptsData } = await supabase
          .from("intentos_examen")
          .select("created_at")
          .eq("user_id", user.id);

        if (attemptsData && attemptsData.length > 0) {
          const dates = attemptsData.map((a) =>
            startOfDay(new Date(a.created_at)).getTime()
          );
          const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

          let currentStreak = 0;
          const today = startOfDay(new Date()).getTime();
          const yesterday = today - 24 * 60 * 60 * 1000;
          const oneDayMs = 24 * 60 * 60 * 1000;

          const hasYesterday = uniqueDates.includes(yesterday);
          const hasToday = uniqueDates.includes(today);

          // Verificar si la racha está activa hoy
          setStreakActiveToday(hasToday);

          if (hasYesterday || hasToday) {
            const startPoint = hasToday ? today : yesterday;

            for (let i = 0; i < uniqueDates.length; i++) {
              const expectedDate = startPoint - i * oneDayMs;
              if (uniqueDates[i] === expectedDate) {
                currentStreak++;
              } else {
                break;
              }
            }
          }

          setStreak(currentStreak);
        }
      }
    };
    fetchUserData();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("examflowUser");
    }
    router.push("/login");
  };

  const closeMobileMenu = () => setIsMobileOpen(false);

  return (
    <>
      <button className="hamburger-btn" onClick={() => setIsMobileOpen(true)}>
        <FiMenu size={24} />
      </button>

      <aside
        className={`sidebar ${isExpanded ? "" : "collapsed"} ${
          isMobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-header">
          <span className="sidebar-logo-text">ExamFlow 🚀</span>
          <button className="mobile-close-btn" onClick={closeMobileMenu}>
            <FiX size={24} />
          </button>
        </div>

        {/* --- Sección de Usuario --- */}
        <div className="sidebar-user-profile">
          <FiUser size={isExpanded ? 24 : 28} />
          {isExpanded && (
            <div className="user-info">
              <span>Bienvenido,</span>
              <strong>{username || "Usuario"}</strong>
              {streak > 0 && (
                <span
                  className={`user-streak ${
                    !streakActiveToday ? "inactive" : ""
                  }`}
                >
                  🔥 {streak} {streak === 1 ? "día" : "días"}
                </span>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <Link
            href="/"
            className={pathname === "/" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiHome size={22} />
            <span>Crear Examen</span>
          </Link>
          <Link
            href="/estadisticas"
            className={pathname === "/estadisticas" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiBarChart2 size={22} />
            <span>Estadísticas</span>
          </Link>
          <Link
            href="/categorias"
            className={pathname === "/categorias" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiTag size={22} />
            <span>Categorías</span>
          </Link>
          <Link
            href="/aprender"
            className={pathname === "/aprender" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiCpu size={22} />
            <span>Aprender y Mejorar</span>
          </Link>
          <Link
            href="/historial"
            className={pathname === "/historial" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiClock size={22} />
            <span>Historial</span>
          </Link>
          <Link
            href="/logros"
            className={pathname === "/logros" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiAward size={22} />
            <span>Logros</span>
            {hasNewAchievements && (
              <span className="notification-badge">!</span>
            )}
          </Link>
          <Link
            href="/perfil"
            className={pathname === "/perfil" ? "active" : ""}
            onClick={closeMobileMenu}
          >
            <FiUser size={22} />
            <span>Perfil</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleSignOut} className="sidebar-action-btn">
            <FiLogOut size={22} />
            <span>Cerrar Sesión</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="sidebar-toggle"
          >
            {isExpanded ? (
              <FiChevronLeft size={20} />
            ) : (
              <FiChevronRight size={20} />
            )}
          </button>
        </div>
      </aside>

      {isMobileOpen && (
        <div className="overlay" onClick={closeMobileMenu}></div>
      )}
    </>
  );
}
