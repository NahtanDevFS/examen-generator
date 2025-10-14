//historial/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiHelpCircle } from "react-icons/fi";
import "./revision.css";

type Question = {
  question: string;
  options?: string[];
  answer: string;
};

type ReviewData = {
  id: number;
  created_at: string;
  user_answers: { [key: number]: string };
  time_spent_seconds: number | null;
  examenes: {
    topic: string;
    questions: Question[];
    exam_type: string;
    has_timer: boolean | null;
    timer_minutes: number | null;
  } | null;
};

// Función para convertir markdown a HTML
const markdownToHtml = (text: string): string => {
  const html = text
    // Negritas: **texto** → <strong>texto</strong>
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Cursiva: *texto* → <em>texto</em>
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Listas de viñetas: * item → <li>item</li>
    .replace(/^\* (.+)$/gm, "<li>$1</li>")
    // Saltos de línea
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Envolver listas en <ul>
  html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  return `<p>${html}</p>`;
};

export default function RevisionPage() {
  const supabase = createClient();
  const params = useParams();
  const { id } = params;

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<{
    [key: number]: boolean;
  }>({});
  const [explanations, setExplanations] = useState<{ [key: number]: string }>(
    {}
  );
  const [visibleExplanations, setVisibleExplanations] = useState<{
    [key: number]: boolean;
  }>({});

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
            time_spent_seconds,
            examenes ( topic, questions, exam_type, has_timer, timer_minutes )
          `
          )
          .eq("id", id)
          .single();

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

  const handleExplainQuestion = async (questionIndex: number) => {
    // Si ya existe la explicación, simplemente toggle la visibilidad
    if (explanations[questionIndex]) {
      setVisibleExplanations((prev) => ({
        ...prev,
        [questionIndex]: !prev[questionIndex],
      }));
      return;
    }

    // Si no existe, cargarla
    if (!reviewData || loadingExplanation[questionIndex]) return;

    setLoadingExplanation((prev) => ({ ...prev, [questionIndex]: true }));

    try {
      const q = reviewData.examenes!.questions[questionIndex];
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          correctAnswer: q.answer,
          userAnswer: reviewData.user_answers[questionIndex],
          topic: reviewData.examenes!.topic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setExplanations((prev) => ({
          ...prev,
          [questionIndex]: data.explanation,
        }));
        setVisibleExplanations((prev) => ({
          ...prev,
          [questionIndex]: true,
        }));
      } else {
        setError("No se pudo cargar la explicación");
      }
    } catch (err) {
      setError("Error al obtener la explicación");
    } finally {
      setLoadingExplanation((prev) => ({ ...prev, [questionIndex]: false }));
    }
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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

  const examType = reviewData.examenes?.exam_type || "opcion_multiple";

  return (
    <div className="page-content">
      <Link href="/historial" className="back-link">
        <FiArrowLeft /> Volver al Historial
      </Link>
      <h1>Revisión del Examen</h1>
      <div className="exam-info-header">
        <h2>Tema: {reviewData.examenes?.topic || "Desconocido"}</h2>
        <div className="exam-meta">
          {reviewData.time_spent_seconds && (
            <span className="meta-badge">
              ⏱️ Tiempo: {formatTime(reviewData.time_spent_seconds)}
            </span>
          )}
          {reviewData.examenes?.has_timer && (
            <span className="meta-badge timer-badge">
              ⏰ Límite: {reviewData.examenes.timer_minutes} min
            </span>
          )}
        </div>
      </div>

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

              {examType === "pregunta_abierta" ? (
                <div className="open-answer-review">
                  <div className="user-answer-section">
                    <h4>Tu respuesta:</h4>
                    <p className="user-answer-text">
                      {userAnswer || "Sin respuesta"}
                    </p>
                  </div>
                  <div className="model-answer">
                    <h4>Respuesta modelo:</h4>
                    <p className="model-answer-text">{q.answer}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="review-options">
                    {q.options?.map((option, i) => {
                      let className = "review-option";
                      if (option === q.answer) {
                        className += " correct";
                      }
                      if (option === userAnswer && !isCorrect) {
                        className += " incorrect";
                      }
                      return (
                        <div key={i} className={className}>
                          {option}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="explain-btn"
                    onClick={() => handleExplainQuestion(index)}
                    disabled={loadingExplanation[index]}
                  >
                    <FiHelpCircle />
                    {loadingExplanation[index]
                      ? "Cargando..."
                      : visibleExplanations[index]
                      ? "Ocultar explicación"
                      : "¿Por qué esta respuesta?"}
                  </button>

                  {visibleExplanations[index] && explanations[index] && (
                    <div className="explanation-box">
                      <h4>📚 Explicación:</h4>
                      <div
                        className="explanation-content"
                        dangerouslySetInnerHTML={{
                          __html: markdownToHtml(explanations[index]),
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
