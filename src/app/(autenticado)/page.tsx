"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Tipos que ya teníamos
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

  // --- NUEVO ESTADO PARA EL TIPO DE EXAMEN ---
  const [examType, setExamType] = useState("opcion_multiple"); // 'opcion_multiple' o 'verdadero_falso'

  // Estado para guardar el ID del examen actual
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);

  // Estados del examen
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
    if (!session) return;

    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setCurrentExamId(null);

    try {
      // 1. Obtener preguntas de la IA
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type: examType }), // <-- AÑADIMOS EL TIPO
      });
      if (!response.ok)
        throw new Error("No se pudo generar el examen desde la IA.");
      const generatedQuestions = await response.json();

      // 2. Guardar el nuevo examen en la base de datos
      const { data: examData, error: examError } = await supabase
        .from("examenes")
        .insert({
          user_id: session.user.id,
          topic: topic,
          questions: generatedQuestions,
          exam_type: "opcion_multiple",
        })
        .select("id")
        .single();

      if (examError)
        throw new Error(`Error al guardar el examen: ${examError.message}`);

      // 3. Actualizar el estado de la aplicación
      setQuestions(generatedQuestions);
      setCurrentExamId(examData.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!session || currentExamId === null) return;

    // 1. Calcular resultados
    let correct = 0;
    questions.forEach((question, index) => {
      if (userAnswers[index] === question.answer) {
        correct++;
      }
    });

    const calculatedResults = {
      score: (correct / questions.length) * 100,
      correctAnswers: correct,
      incorrectAnswers: questions.length - correct,
    };

    // 2. Guardar el intento en la base de datos
    const { error: attemptError } = await supabase
      .from("intentos_examen")
      .insert({
        user_id: session.user.id,
        examen_id: currentExamId,
        score_correct: calculatedResults.correctAnswers,
        score_incorrect: calculatedResults.incorrectAnswers,
        user_answers: userAnswers,
      });

    if (attemptError) {
      setError(`Error al guardar tu resultado: ${attemptError.message}`);
    }

    // 3. Mostrar los resultados en la UI
    setResults(calculatedResults);
  };

  const handleAnswerSelect = (
    questionIndex: number,
    selectedOption: string
  ) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: selectedOption }));
  };

  const handleReset = () => {
    setTopic("");
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setCurrentExamId(null);
  };

  if (loadingSession) {
    return <div style={{ padding: "20px" }}>Cargando sesión...</div>;
  }

  return (
    <div className="page-content">
      <h1>Generador de Exámenes con IA 🧠</h1>

      {questions.length === 0 && !results && (
        <form onSubmit={handleGenerateExam} className="generator-form">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Escribe un tema (ej: JavaScript, Historia de Roma)"
            disabled={isLoading}
            className="topic-input"
          />
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            disabled={isLoading}
            className="type-select"
          >
            <option value="opcion_multiple">Respuesta Múltiple</option>
            <option value="verdadero_falso">Verdadero o Falso</option>
          </select>
          <button
            type="submit"
            disabled={isLoading}
            className="generate-button"
          >
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
