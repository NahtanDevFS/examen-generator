"use client"; // This layout now needs to be a client component to manage state

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import "./globals-autenticado.css";

export default function AutenticadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    // Add a class to the container based on the sidebar state
    <div
      className={`layout-container ${
        isExpanded ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <main className="main-content">{children}</main>
    </div>
  );
}
