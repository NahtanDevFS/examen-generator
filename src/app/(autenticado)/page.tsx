"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [examType, setExamType] = useState("opcion_multiple");
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    const getSessionAndLoadExam = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }
      setSession(data.session);
      setLoadingSession(false);

      const examIdToLoad = searchParams.get("examId");
      if (examIdToLoad) {
        loadExam(parseInt(examIdToLoad, 10));
      }
    };
    getSessionAndLoadExam();
  }, [supabase, router, searchParams]);

  const loadExam = async (examId: number) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("examenes")
      .select("id, topic, questions, exam_type")
      .eq("id", examId)
      .single();

    if (error) {
      setError("No se pudo cargar el examen para repetirlo.");
    } else if (data) {
      setTopic(data.topic);
      setQuestions(data.questions);
      setCurrentExamId(data.id);
      setExamType(data.exam_type || "opcion_multiple");
      setResults(null);
      setUserAnswers({});
      router.replace("/", { scroll: false });
    }
    setIsLoading(false);
  };

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
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type: examType }),
      });
      if (!response.ok)
        throw new Error("No se pudo generar el examen desde la IA.");
      const generatedQuestions = await response.json();

      const { data: examData, error: examError } = await supabase
        .from("examenes")
        .insert({
          user_id: session.user.id,
          topic: topic,
          questions: generatedQuestions,
          exam_type: examType,
        })
        .select("id")
        .single();

      if (examError)
        throw new Error(`Error al guardar el examen: ${examError.message}`);

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
            placeholder="Escribe un tema (ej: JavaScript)"
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
            {isLoading ? "Generando..." : "Generar"}
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

          {/* --- NUEVA SECCIÓN DE REVISIÓN --- */}
          <div className="review-section">
            <h3 className="review-title">Revisión de Respuestas</h3>
            <div className="review-container">
              {questions.map((q, index) => {
                const userAnswer = userAnswers[index];
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
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
