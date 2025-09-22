"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./Sidebar.css";
import {
  FiHome,
  FiClock,
  FiUser,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi"; // Import icons

// Define the props the component will receive
type SidebarProps = {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
};

export default function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className={`sidebar ${isExpanded ? "" : "collapsed"}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo-text">ExamenIA 🚀</span>
      </div>

      <nav className="sidebar-nav">
        <Link href="/">
          <FiHome size={22} />
          <span>Crear Examen</span>
        </Link>
        <Link href="#">
          <FiClock size={22} />
          <span>Historial</span>
        </Link>
        <Link href="#">
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
  );
}
