"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import "./loading-screen.css";

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

type Categoria = {
  id: number;
  nombre: string;
};

type Etiqueta = {
  id: number;
  nombre: string;
};

const LOADING_TIPS = [
  { icon: "💡", text: "Concéntrate y lee cada pregunta cuidadosamente" },
  { icon: "⏱️", text: "No hay límite de tiempo, tómate el que necesites" },
  { icon: "✅", text: "Puedes cambiar tus respuestas antes de calificar" },
  { icon: "📊", text: "Al finalizar verás un análisis detallado" },
  { icon: "🔄", text: "Podrás repetir este examen cuando quieras" },
  { icon: "🎯", text: "Cada pregunta tiene solo una respuesta correcta" },
];

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [examType, setExamType] = useState("opcion_multiple");
  const [difficulty, setDifficulty] = useState("principiante");
  const [questionCount, setQuestionCount] = useState(10);

  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [results, setResults] = useState<Results | null>(null);

  // Estados para categorías y etiquetas
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(
    null
  );
  const [selectedEtiquetas, setSelectedEtiquetas] = useState<number[]>([]);

  useEffect(() => {
    const getSessionAndLoadExam = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }
      setSession(data.session);
      setLoadingSession(false);

      // Cargar categorías y etiquetas
      fetchCategoriasYEtiquetas(data.session.user.id);

      const examIdToLoad = searchParams.get("examId");
      if (examIdToLoad) {
        loadExam(parseInt(examIdToLoad, 10));
      }
    };
    getSessionAndLoadExam();
  }, [supabase, router, searchParams]);

  const fetchCategoriasYEtiquetas = async (userId: string) => {
    const { data: cats } = await supabase
      .from("categorias")
      .select("*")
      .eq("user_id", userId)
      .order("nombre");

    const { data: tags } = await supabase
      .from("etiquetas")
      .select("*")
      .eq("user_id", userId)
      .order("nombre");

    setCategorias(cats || []);
    setEtiquetas(tags || []);
  };

  const loadExam = async (examId: number) => {
    setIsLoading(true);
    setLoadingProgress(30);

    const { data, error } = await supabase
      .from("examenes")
      .select(
        "id, topic, questions, exam_type, difficulty, categoria_id, etiquetas"
      )
      .eq("id", examId)
      .single();

    setLoadingProgress(70);

    if (error) {
      setError("No se pudo cargar el examen para repetirlo.");
      setIsLoading(false);
    } else if (data) {
      setTopic(data.topic);
      setQuestions(data.questions);
      setCurrentExamId(data.id);
      setExamType(data.exam_type || "opcion_multiple");
      setDifficulty(data.difficulty || "principiante");
      setSelectedCategoria(data.categoria_id);
      setSelectedEtiquetas(data.etiquetas || []);
      setResults(null);
      setUserAnswers({});
      setLoadingProgress(100);

      setTimeout(() => {
        setIsLoading(false);
        router.replace("/", { scroll: false });
      }, 500);
    }
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsLoading(true);
    setLoadingProgress(0);
    setError(null);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setCurrentExamId(null);

    try {
      // Simular progreso inicial
      setLoadingProgress(10);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          type: examType,
          difficulty: difficulty,
          count: questionCount,
        }),
      });

      setLoadingProgress(50);

      if (!response.ok)
        throw new Error("No se pudo generar el examen desde la IA.");

      const generatedQuestions = await response.json();

      setLoadingProgress(70);

      const { data: examData, error: examError } = await supabase
        .from("examenes")
        .insert({
          user_id: session.user.id,
          topic: topic,
          questions: generatedQuestions,
          exam_type: examType,
          difficulty: difficulty,
          categoria_id: selectedCategoria,
          etiquetas: selectedEtiquetas,
        })
        .select("id")
        .single();

      setLoadingProgress(90);

      if (examError)
        throw new Error(`Error al guardar el examen: ${examError.message}`);

      setQuestions(generatedQuestions);
      setCurrentExamId(examData.id);
      setLoadingProgress(100);

      // Pequeña pausa antes de cerrar la pantalla de carga
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      setLoadingProgress(0);
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
    setSelectedCategoria(null);
    setSelectedEtiquetas([]);
  };

  const toggleEtiqueta = (etiquetaId: number) => {
    setSelectedEtiquetas((prev) =>
      prev.includes(etiquetaId)
        ? prev.filter((id) => id !== etiquetaId)
        : [...prev, etiquetaId]
    );
  };

  const getTagColor = (index: number) => {
    const colors = [
      "#6c757d",
      "#007bff",
      "#28a745",
      "#dc3545",
      "#ffc107",
      "#17a2b8",
      "#e83e8c",
      "#6610f2",
      "#fd7e14",
      "#20c997",
    ];
    return colors[index % colors.length];
  };

  if (loadingSession) {
    return <div style={{ padding: "20px" }}>Cargando sesión...</div>;
  }

  return (
    <>
      {/* PANTALLA DE CARGA INMERSIVA */}
      {isLoading && (
        <div className="loading-overlay">
          {/* Partículas de fondo */}
          <div className="loading-particles">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="particle"></div>
            ))}
          </div>

          <div className="loading-content">
            {/* Ícono animado */}
            <div className="loading-icon-container">
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="brain-icon">🧠</div>
            </div>

            {/* Título y subtítulo */}
            <h2 className="loading-title">
              Generando tu examen<span className="dots"></span>
            </h2>
            <p className="loading-subtitle">
              La IA está creando preguntas personalizadas sobre {topic}
            </p>

            {/* Barra de progreso */}
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>

            {/* Tips útiles */}
            <div className="loading-tips">
              {LOADING_TIPS.slice(0, 3).map((tip, index) => (
                <div key={index} className="loading-tip">
                  <span className="tip-icon">{tip.icon}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p className="loading-footer">Esto puede tardar unos segundos...</p>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
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
              <option value="opcion_multiple">Múltiple</option>
              <option value="verdadero_falso">V o F</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={isLoading}
              className="type-select"
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>

            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              disabled={isLoading}
              className="type-select"
            >
              <option value={5}>5 Preguntas</option>
              <option value={10}>10 Preguntas</option>
              <option value={15}>15 Preguntas</option>
              <option value={20}>20 Preguntas</option>
            </select>

            {/* SELECTOR DE CATEGORÍA */}
            <select
              value={selectedCategoria || ""}
              onChange={(e) =>
                setSelectedCategoria(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              disabled={isLoading}
              className="type-select"
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>

            {/* SELECTOR DE ETIQUETAS */}
            {etiquetas.length > 0 && (
              <div className="etiquetas-selector">
                <label>Etiquetas (opcional):</label>
                <div className="etiquetas-list">
                  {etiquetas.map((tag, index) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`etiqueta-btn ${
                        selectedEtiquetas.includes(tag.id) ? "selected" : ""
                      }`}
                      style={{
                        backgroundColor: selectedEtiquetas.includes(tag.id)
                          ? getTagColor(index)
                          : "transparent",
                        borderColor: getTagColor(index),
                        color: selectedEtiquetas.includes(tag.id)
                          ? "white"
                          : getTagColor(index),
                      }}
                      onClick={() => toggleEtiqueta(tag.id)}
                      disabled={isLoading}
                    >
                      {tag.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="generate-button"
            >
              {isLoading ? "Generando..." : "Generar"}
            </button>
          </form>
        )}

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
            <p className="score">
              Tu calificación: {results.score.toFixed(0)}%
            </p>
            <p className="correct">
              Respuestas Correctas: {results.correctAnswers}
            </p>
            <p className="incorrect">
              Respuestas Incorrectas: {results.incorrectAnswers}
            </p>
            <button className="submit-btn" onClick={handleReset}>
              Crear otro examen
            </button>
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
    </>
  );
}
