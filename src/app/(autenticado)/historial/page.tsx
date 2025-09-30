"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FiBarChart2,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiRepeat,
  FiFileText,
  FiAward,
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./historial.css";

// Tipo actualizado para incluir los nuevos campos
type Attempt = {
  id: number;
  created_at: string;
  score_correct: number;
  score_incorrect: number;
  examen_id: number;
  examenes: {
    topic: string;
    exam_type: string;
    difficulty: string | null; // Puede ser nulo para exámenes antiguos
  } | null;
};

export default function HistorialPage() {
  const supabase = createClient();
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Consulta actualizada para traer los nuevos campos
        const { data, error } = await supabase
          .from("intentos_examen")
          .select(
            `
            id,
            created_at,
            score_correct,
            score_incorrect,
            examen_id, 
            examenes ( topic, exam_type, difficulty )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          setError("No se pudo cargar el historial.");
        } else {
          setAttempts(data as any as Attempt[]);
        }
      }
      setLoading(false);
    };
    fetchHistory();
  }, [supabase]);

  // Función para capitalizar texto (ej: "principiante" -> "Principiante")
  const capitalize = (s: string | null) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleRepeatExam = (e: React.MouseEvent, examId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?examId=${examId}`);
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando historial...</h2>
      </div>
    );
  }

  return (
    <div className="page-content">
      <h1>Historial de Exámenes 📚</h1>
      {attempts.length === 0 ? (
        <p>Aún no has completado ningún examen. ¡Crea uno para empezar!</p>
      ) : (
        <div className="history-list">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="history-item-wrapper">
              <Link
                href={`/historial/${attempt.id}`}
                className="history-item-link"
              >
                <div className="history-item">
                  <div className="item-header">
                    <h3>{attempt.examenes?.topic || "Tema Desconocido"}</h3>
                    <div className="item-score">
                      <FiBarChart2 />
                      <span>
                        {(
                          (attempt.score_correct /
                            (attempt.score_correct + attempt.score_incorrect)) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                  {/* --- NUEVA SECCIÓN DE DETALLES --- */}
                  <div className="item-details">
                    <span className="detail-tag type">
                      <FiFileText />{" "}
                      {attempt.examenes?.exam_type === "opcion_multiple"
                        ? "Opción Múltiple"
                        : "V o F"}
                    </span>
                    {attempt.examenes?.difficulty && (
                      <span
                        className={`detail-tag difficulty-${attempt.examenes.difficulty}`}
                      >
                        <FiAward /> {capitalize(attempt.examenes.difficulty)}
                      </span>
                    )}
                  </div>
                  <div className="item-body">
                    <p>
                      <FiCheckCircle className="icon correct" /> Aciertos:{" "}
                      {attempt.score_correct}
                    </p>
                    <p>
                      <FiXCircle className="icon incorrect" /> Errores:{" "}
                      {attempt.score_incorrect}
                    </p>
                  </div>
                  <div className="item-footer">
                    <FiCalendar className="icon" />
                    <span>
                      {new Date(attempt.created_at).toLocaleDateString(
                        "es-ES",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </span>
                  </div>
                </div>
              </Link>
              <button
                className="repeat-button"
                onClick={(e) => handleRepeatExam(e, attempt.examen_id)}
              >
                <FiRepeat /> Repetir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
