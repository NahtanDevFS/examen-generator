"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// ... (los tipos Question y Results no cambian)
type Question = {
  question: string;
  options: string[];
  answer: string;
};
type Results = {
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
};

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
      } else {
        setSession(data.session);
      }
      setLoadingSession(false);
    };
    getSession();
  }, [supabase, router]);

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!response.ok) {
        throw new Error("No se pudo generar el examen. Inténtalo de nuevo.");
      }
      const data = await response.json();
      setQuestions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (
    questionIndex: number,
    selectedOption: string
  ) => {
    setUserAnswers((prevAnswers) => ({
      ...prevAnswers,
      [questionIndex]: selectedOption,
    }));
  };

  const handleSubmitExam = () => {
    let correctAnswers = 0;
    questions.forEach((question, index) => {
      if (userAnswers[index] === question.answer) {
        correctAnswers++;
      }
    });
    setResults({
      score: (correctAnswers / questions.length) * 100,
      correctAnswers: correctAnswers,
      incorrectAnswers: questions.length - correctAnswers,
    });
  };

  const handleReset = () => {
    setTopic("");
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
  };

  if (loadingSession) {
    // Puedes poner un spinner o un componente de carga más elaborado aquí
    return <div style={{ padding: "20px" }}>Cargando sesión...</div>;
  }

  if (!session) {
    return null; // El redirect ya está en marcha
  }

  return (
    // --- LÍNEA CORREGIDA ---
    // Quitamos la clase "container" y envolvemos el contenido en un div propio
    <div className="page-content">
      <h1>Generador de Exámenes con IA 🧠</h1>

      {questions.length === 0 && !results && (
        <form onSubmit={handleGenerateExam}>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Escribe un tema (ej: JavaScript, Historia de Roma)"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Generando..." : "Generar Examen"}
          </button>
        </form>
      )}

      {isLoading && <p>Cargando preguntas...</p>}
      {error && <p className="error">{error}</p>}

      {questions.length > 0 && !results && (
        <section className="exam-container">
          <h2>Examen sobre: {topic}</h2>
          {questions.map((q, index) => (
            <article key={index} className="question-card">
              <p>
                <strong>
                  {index + 1}. {q.question}
                </strong>
              </p>
              <div className="options-container">
                {q.options.map((option, i) => (
                  <button
                    key={i}
                    className={`option-btn ${
                      userAnswers[index] === option ? "selected" : ""
                    }`}
                    onClick={() => handleAnswerSelect(index, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </article>
          ))}
          <button className="submit-btn" onClick={handleSubmitExam}>
            Calificar Examen
          </button>
        </section>
      )}

      {results && (
        <section className="results-container">
          <h2>Resultados 📊</h2>
          <p className="score">Tu calificación: {results.score.toFixed(0)}%</p>
          <p className="correct">
            Respuestas Correctas: {results.correctAnswers}
          </p>
          <p className="incorrect">
            Respuestas Incorrectas: {results.incorrectAnswers}
          </p>
          <button className="submit-btn" onClick={handleReset}>
            Crear otro examen
          </button>
        </section>
      )}
    </div>
  );
}
