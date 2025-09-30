"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FiBarChart2,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiRepeat,
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Importa useRouter
import "./historial.css";

// --- TIPO CORREGIDO ---
// Cambiamos 'examenes' para que sea un array de objetos o un objeto simple.
// Esto maneja la inconsistencia de la respuesta de Supabase.
type Attempt = {
  id: number;
  created_at: string;
  score_correct: number;
  score_incorrect: number;
  examen_id: number; // Necesitaremos el ID del examen
  examenes:
    | {
        topic: string;
      }[]
    | {
        // Puede ser un array...
        topic: string;
      }
    | null; // ...o un objeto simple, o nulo.
};

export default function HistorialPage() {
  const supabase = createClient();
  const router = useRouter(); // Inicializa el router
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("intentos_examen")
          .select(
            `
            id,
            created_at,
            score_correct,
            score_incorrect,
            examen_id, 
            examenes ( topic )
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

  const getTopic = (exam: Attempt["examenes"]) => {
    if (!exam) return "Tema Desconocido";
    if (Array.isArray(exam)) {
      return exam[0]?.topic || "Tema Desconocido";
    }
    return exam.topic;
  };
  const handleRepeatExam = (e: React.MouseEvent, examId: number) => {
    e.preventDefault(); // Evita que el Link se active
    e.stopPropagation(); // Detiene la propagación del evento
    router.push(`/?examId=${examId}`); // Redirige a la página principal con el ID del examen
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando historial...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <p className="error">{error}</p>
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
            // --- CADA ITEM AHORA ES UN ENLACE ---
            <div key={attempt.id} className="history-item-wrapper">
              <Link
                href={`/historial/${attempt.id}`}
                key={attempt.id}
                className="history-item-link"
              >
                <div className="history-item">
                  <div className="item-header">
                    <h3>{getTopic(attempt.examenes)}</h3>
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
