// src/app/(autenticado)/page.tsx

import { Suspense } from "react";
import ExamPageClient from "./ExamPageClient";

// Un componente de carga simple para el Suspense
function LoadingFallback() {
  return (
    <div className="page-content">
      <h2>Cargando...</h2>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ExamPageClient />
    </Suspense>
  );
}
