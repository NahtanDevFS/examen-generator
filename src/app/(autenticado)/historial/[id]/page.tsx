"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import "./revision.css"; // Crearemos este archivo a continuación

// Tipo para las preguntas que vienen del examen original
type Question = {
  question: string;
  options: string[];
  answer: string;
};

// Tipo para los datos completos de la revisión
type ReviewData = {
  id: number;
  created_at: string;
  user_answers: { [key: number]: string };
  examenes: {
    topic: string;
    questions: Question[];
  } | null;
};

export default function RevisionPage() {
  const supabase = createClient();
  const params = useParams(); // Hook para leer parámetros de la URL, como el [id]
  const { id } = params;

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const fetchReviewData = async () => {
        const { data, error } = await supabase
          .from("intentos_examen")
          .select(
            `
            id,
            created_at,
            user_answers,
            examenes ( topic, questions )
          `
          )
          .eq("id", id) // Buscamos el intento específico por su ID
          .single(); // Esperamos solo un resultado

        if (error) {
          setError("No se pudo cargar la revisión del examen.");
          console.error(error);
        } else {
          setReviewData(data as any as ReviewData);
        }
        setLoading(false);
      };
      fetchReviewData();
    }
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando revisión...</h2>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="page-content">
        <p className="error">
          {error || "No se encontraron datos para este examen."}
        </p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Link href="/historial" className="back-link">
        <FiArrowLeft /> Volver al Historial
      </Link>
      <h1>Revisión del Examen</h1>
      <h2>Tema: {reviewData.examenes?.topic || "Desconocido"}</h2>

      <div className="review-container">
        {reviewData.examenes?.questions.map((q, index) => {
          const userAnswer = reviewData.user_answers[index];
          const isCorrect = userAnswer === q.answer;

          return (
            <div key={index} className="review-question-card">
              <p>
                <strong>
                  {index + 1}. {q.question}
                </strong>
              </p>
              <div className="review-options">
                {q.options.map((option, i) => {
                  let className = "review-option";
                  if (option === q.answer) {
                    className += " correct"; // La respuesta correcta siempre se marca
                  }
                  if (option === userAnswer && !isCorrect) {
                    className += " incorrect"; // La respuesta del usuario, si fue incorrecta
                  }

                  return (
                    <div key={i} className={className}>
                      {option}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
