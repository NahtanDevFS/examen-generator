// src/app/(autenticado)/ExamPageClient.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { FiUpload, FiX, FiClock, FiHelpCircle, FiImage } from "react-icons/fi";
import "./loading-screen.css";
import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

// NOTA IMPORTANTE: Se configura el worker de PDF.js para que la extracción de texto funcione.
// La ruta '/' busca el archivo directamente en la carpeta 'public' del proyecto.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

// Tipo de usuario en localStorage (detección rápida)
interface ExamflowUser {
  id: string;
  name: string;
}

type Question = {
  question: string;
  options?: string[];
  answer: string;
};

type Results = {
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
};

type OpenQuestionEvaluation = {
  score: number;
  feedback: string;
  strengths: string;
  improvements: string;
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
  { icon: "⏱️", text: "Administra bien tu tiempo si es cronometrado" },
  { icon: "✅", text: "Puedes cambiar tus respuestas antes de calificar" },
  { icon: "📊", text: "Al finalizar verás un análisis detallado" },
  { icon: "🔄", text: "Podrás repetir este examen cuando quieras" },
  { icon: "🎯", text: "Lee todas las opciones antes de responder" },
];

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Verificación de LocalStorage para proteger la ruta (solo cliente)
  useEffect(() => {
    const storedUser = localStorage.getItem("examflowUser");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    // Si hay usuario en localStorage, asumimos que la sesión es válida y cargamos la data
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Si el localStorage está, pero Supabase no tiene cookies (ej: expiró), borramos y redirigimos
        localStorage.removeItem("examflowUser");
        router.push("/login");
        return;
      }
      setSession(session);
      setLoadingSession(false);
      fetchCategoriasYEtiquetas(session.user.id);

      const examIdToLoad = searchParams.get("examId");
      if (examIdToLoad) {
        loadExam(parseInt(examIdToLoad, 10), session.user.id);
      }
    };
    fetchSession();
  }, [router, supabase, searchParams]);

  const [examType, setExamType] = useState("opcion_multiple");
  const [difficulty, setDifficulty] = useState("principiante");
  const [questionCount, setQuestionCount] = useState(10);
  const [hasTimer, setHasTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(30);

  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [gradingProgress, setGradingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [results, setResults] = useState<Results | null>(null);
  const [openEvaluations, setOpenEvaluations] = useState<{
    [key: number]: OpenQuestionEvaluation;
  }>({});

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Estados para categorías y etiquetas
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(
    null
  );
  const [selectedEtiquetas, setSelectedEtiquetas] = useState<number[]>([]);

  // Estados para explicaciones
  const [loadingExplanation, setLoadingExplanation] = useState<{
    [key: number]: boolean;
  }>({});
  const [explanations, setExplanations] = useState<{ [key: number]: string }>(
    {}
  );

  // Estados para OCR
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Timer effect
  useEffect(() => {
    if (timerActive && timeRemaining !== null && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev !== null && prev > 0) {
            return prev - 1;
          }
          return prev;
        });
        setTimeSpent((prev) => prev + 1);
      }, 1000);
    } else if (timeRemaining === 0 && timerActive) {
      setTimerActive(false);
      handleSubmitExam();
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerActive, timeRemaining]);

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

  const loadExam = async (examId: number, userId: string) => {
    setIsLoading(true);
    setLoadingProgress(30);

    const { data, error } = await supabase
      .from("examenes")
      .select("*")
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
      setHasTimer(data.has_timer || false);
      setTimerMinutes(data.timer_minutes || 30);
      setResults(null);
      setUserAnswers({});
      setOpenEvaluations({});
      setExplanations({});
      setLoadingProgress(100);

      // Iniciar timer si el examen lo tiene
      if (data.has_timer && data.timer_minutes) {
        setTimeRemaining(data.timer_minutes * 60);
        setTimerActive(true);
        setTimeSpent(0);
      }

      setTimeout(() => {
        setIsLoading(false);
        router.replace("/", { scroll: false });
      }, 500);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);

    // Verificar si es una imagen
    if (file.type.startsWith("image/")) {
      try {
        setIsProcessingOCR(true); // ✅ Pantalla de carga SOLO para OCR
        setOcrProgress(0);

        const result = await Tesseract.recognize(file, "spa", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });

        const extractedText = result.data.text;

        if (!extractedText.trim()) {
          setError(
            "No se pudo extraer texto de la imagen. Asegúrate de que la imagen contenga texto legible."
          );
          setUploadedFile(null);
        } else {
          setSourceText(extractedText.trim());
        }

        setIsProcessingOCR(false);
        setOcrProgress(0);
      } catch (err: any) {
        console.error("Error al procesar imagen con OCR:", err);
        setError(
          "Error al procesar la imagen. Asegúrate de que sea una imagen válida con texto legible."
        );
        setUploadedFile(null);
        setSourceText("");
        setIsProcessingOCR(false);
        setOcrProgress(0);
      }
    } else if (file.type === "application/pdf") {
      // ✅ PDF: Sin pantalla de carga (es relativamente rápido)
      try {
        const arrayBuffer = await new Promise<ArrayBuffer>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                resolve(event.target.result as ArrayBuffer);
              } else {
                reject(new Error("No se pudo leer el archivo."));
              }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          }
        );

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
        });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");

          fullText += pageText + "\n";
        }

        setSourceText(fullText.trim());
      } catch (err: any) {
        console.error("Error al procesar PDF:", err);
        setError(
          "Error al procesar el archivo PDF. Asegúrate de que sea un archivo de texto válido y no esté protegido."
        );
        setUploadedFile(null);
        setSourceText("");
      }
    } else {
      // ✅ TXT: Sin pantalla de carga (es instantáneo)
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        setSourceText(text);
      };
      reader.readAsText(file);
    }
  };
  const removeFile = () => {
    setUploadedFile(null);
    setSourceText("");
    setIsProcessingOCR(false);
    setOcrProgress(0);
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setError("Error de sesión. Intenta iniciar sesión nuevamente.");
      return;
    }

    if (!topic && !sourceText) {
      setError("Debes proporcionar un tema o subir/pegar texto.");
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);
    setError(null);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setCurrentExamId(null);
    setOpenEvaluations({});
    setExplanations({});

    try {
      setLoadingProgress(10);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || "Contenido proporcionado",
          type: examType,
          difficulty: difficulty,
          count: questionCount,
          sourceText: sourceText || undefined,
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
          topic: topic || "Contenido personalizado",
          questions: generatedQuestions,
          exam_type: examType,
          difficulty: difficulty,
          categoria_id: selectedCategoria,
          etiquetas: selectedEtiquetas,
          source_text: sourceText || null,
          has_timer: hasTimer,
          timer_minutes: hasTimer ? timerMinutes : null,
        })
        .select("id")
        .single();

      setLoadingProgress(90);

      if (examError)
        throw new Error(`Error al guardar el examen: ${examError.message}`);

      setQuestions(generatedQuestions);
      setCurrentExamId(examData.id);
      setLoadingProgress(100);

      // Iniciar timer si está activado
      if (hasTimer) {
        setTimeRemaining(timerMinutes * 60);
        setTimerActive(true);
        setTimeSpent(0);
      }

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

    // Detener el timer
    setTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    let correct = 0;
    let incorrect = 0;

    // Para preguntas de opción múltiple y verdadero/falso
    if (examType !== "pregunta_abierta") {
      questions.forEach((question, index) => {
        if (userAnswers[index] === question.answer) {
          correct++;
        } else {
          incorrect++;
        }
      });

      const calculatedResults = {
        score: (correct / questions.length) * 100,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
      };

      const { error: attemptError } = await supabase
        .from("intentos_examen")
        .insert({
          user_id: session.user.id,
          examen_id: currentExamId,
          score_correct: calculatedResults.correctAnswers,
          score_incorrect: calculatedResults.incorrectAnswers,
          user_answers: userAnswers,
          time_spent_seconds: timeSpent > 0 ? timeSpent : null,
        });

      if (attemptError) {
        setError(`Error al guardar tu resultado: ${attemptError.message}`);
      } else {
        // --- INICIO DE LA LÓGICA DE LOGROS ---
        // Dispara la actualización de logros en segundo plano
        fetch("/api/update-achievements", { method: "POST" });
        // --- FIN DE LA LÓGICA DE LOGROS ---
      }

      setResults(calculatedResults);
    } else {
      // Para preguntas abiertas, evaluar cada una con IA
      setIsGrading(true);
      setGradingProgress(0);

      try {
        const evaluations: { [key: number]: OpenQuestionEvaluation } = {};
        let totalScore = 0;

        for (let i = 0; i < questions.length; i++) {
          setGradingProgress(((i + 1) / questions.length) * 100);

          const response = await fetch("/api/evaluate-open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: questions[i].question,
              userAnswer: userAnswers[i] || "",
              correctAnswer: questions[i].answer,
              topic: topic,
            }),
          });

          if (response.ok) {
            const evaluation = await response.json();
            evaluations[i] = evaluation;
            totalScore += evaluation.score;

            if (evaluation.score >= 60) {
              correct++;
            } else {
              incorrect++;
            }
          }
        }

        setOpenEvaluations(evaluations);

        const avgScore = totalScore / questions.length;
        const calculatedResults = {
          score: avgScore,
          correctAnswers: correct,
          incorrectAnswers: incorrect,
        };

        const { error: attemptError } = await supabase
          .from("intentos_examen")
          .insert({
            user_id: session.user.id,
            examen_id: currentExamId,
            score_correct: calculatedResults.correctAnswers,
            score_incorrect: calculatedResults.incorrectAnswers,
            user_answers: userAnswers,
            time_spent_seconds: timeSpent,
          });

        if (attemptError) {
          setError(`Error al guardar tu resultado: ${attemptError.message}`);
        } else {
          // --- INICIO DE LA LÓGICA DE LOGROS ---
          // Dispara la actualización de logros en segundo plano
          fetch("/api/update-achievements", { method: "POST" });
          // --- FIN DE LA LÓGICA DE LOGROS ---
        }

        setResults(calculatedResults);
        setGradingProgress(100);
      } catch (err: any) {
        setError("Error al evaluar las respuestas: " + err.message);
      } finally {
        setIsGrading(false);
      }
    }
  };

  const handleAnswerSelect = (
    questionIndex: number,
    selectedOption: string
  ) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: selectedOption }));
  };

  const handleOpenAnswerChange = (questionIndex: number, value: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleExplainQuestion = async (questionIndex: number) => {
    if (loadingExplanation[questionIndex] || explanations[questionIndex])
      return;

    setLoadingExplanation((prev) => ({ ...prev, [questionIndex]: true }));

    try {
      const q = questions[questionIndex];
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          correctAnswer: q.answer,
          userAnswer: userAnswers[questionIndex],
          topic: topic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setExplanations((prev) => ({
          ...prev,
          [questionIndex]: data.explanation,
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

  const handleReset = () => {
    setTopic("");
    setSourceText("");
    setUploadedFile(null);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setCurrentExamId(null);
    setSelectedCategoria(null);
    setSelectedEtiquetas([]);
    setHasTimer(false);
    setTimerMinutes(30);
    setTimeRemaining(null);
    setTimerActive(false);
    setTimeSpent(0);
    setOpenEvaluations({});
    setExplanations({});
    setIsProcessingOCR(false);
    setOcrProgress(0);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timeRemaining === null) return "#007bff";
    if (timeRemaining > 300) return "#28a745";
    if (timeRemaining > 60) return "#ffc107";
    return "#dc3545";
  };

  if (loadingSession) {
    return <div style={{ padding: "20px" }}>Cargando sesión...</div>;
  }

  return (
    <>
      {/* PANTALLA DE CARGA - GENERACIÓN DE EXAMEN */}
      {isLoading && !isGrading && (
        <div className="loading-overlay">
          <div className="loading-particles">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="particle"></div>
            ))}
          </div>

          <div className="loading-content">
            <div className="loading-icon-container">
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="brain-icon">🧠</div>
            </div>

            <h2 className="loading-title">
              Generando tu examen<span className="dots"></span>
            </h2>
            <p className="loading-subtitle">
              La IA está creando preguntas personalizadas sobre{" "}
              {topic || "tu contenido"}
            </p>

            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>

            <div className="loading-tips">
              {LOADING_TIPS.slice(0, 3).map((tip, index) => (
                <div key={index} className="loading-tip">
                  <span className="tip-icon">{tip.icon}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>

            <p className="loading-footer">Esto puede tardar unos segundos...</p>
          </div>
        </div>
      )}

      {/* PANTALLA DE PROCESAMIENTO OCR */}
      {isProcessingOCR && (
        <div className="loading-overlay">
          <div className="loading-particles">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="particle"></div>
            ))}
          </div>

          <div className="loading-content">
            <div className="loading-icon-container">
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="pulse-ring"></div>
              <div className="brain-icon">📸</div>
            </div>

            <h2 className="loading-title">
              Extrayendo texto de la imagen<span className="dots"></span>
            </h2>
            <p className="loading-subtitle">
              Procesando la imagen con reconocimiento óptico de caracteres (OCR)
            </p>

            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${ocrProgress}%` }}
              ></div>
            </div>

            <p className="loading-footer">
              Progreso: {ocrProgress}% - Esto puede tardar unos segundos...
            </p>
          </div>
        </div>
      )}

      {/* PANTALLA DE CARGA - CALIFICACIÓN DEL EXAMEN */}
      {isGrading && (
        <div className="grading-overlay">
          <div className="grading-particles">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grading-particle"></div>
            ))}
          </div>

          <div className="grading-content">
            <div className="grading-icon-container">
              <div className="grading-spinner"></div>
              <div className="grading-icon">📊</div>
            </div>

            <h2 className="grading-title">
              Calificando tu examen<span className="dots"></span>
            </h2>
            <p className="grading-subtitle">
              La IA está evaluando tus respuestas y generando retroalimentación
            </p>

            <div className="grading-progress-container">
              <div
                className="grading-progress-bar"
                style={{ width: `${gradingProgress}%` }}
              ></div>
            </div>

            <p className="grading-counter">
              Evaluando: {Math.round(gradingProgress)}% completado
            </p>

            <div className="grading-tips">
              <div className="grading-tip">
                <span className="grading-tip-icon">✨</span>
                <span>Analizando cada respuesta cuidadosamente</span>
              </div>
              <div className="grading-tip">
                <span className="grading-tip-icon">🤖</span>
                <span>Generando retroalimentación personalizada</span>
              </div>
              <div className="grading-tip">
                <span className="grading-tip-icon">📈</span>
                <span>Calculando puntuación y recomendaciones</span>
              </div>
            </div>

            <p className="grading-footer">Un momento, esto es rápido...</p>
          </div>
        </div>
      )}

      {/* TIMER FIJO Y VISIBLE */}
      {timerActive && timeRemaining !== null && (
        <div
          className="timer-sticky-container"
          style={{ borderColor: getTimerColor() }}
        >
          <div className="timer-content">
            <FiClock size={24} style={{ color: getTimerColor() }} />
            <span className="timer-text" style={{ color: getTimerColor() }}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
      )}

      <div className={`page-content ${timerActive ? "has-timer" : ""}`}>
        <h1>Generador de Exámenes con IA 🧠</h1>
        <p className="page-description">
          Crea un nuevo examen a partir de un texto, un tema o repite uno que ya
          hayas realizado.
        </p>

        {/* FORMULARIO DE GENERACIÓN */}
        {questions.length === 0 && !results && (
          <form onSubmit={handleGenerateExam} className="generator-form">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tema del examen (ej: JavaScript, Historia)"
              disabled={isLoading || isProcessingOCR}
              className="topic-input"
            />

            {/* SUBIR ARCHIVO O TEXTO */}
            <div className="source-text-section">
              Opcionalmente puedes agregar información sobre el tema que quieras
              evaluarte.
              <label className="upload-label">
                <FiUpload /> Subir archivo, imagen o pegar texto (opcional)
              </label>
              <div className="upload-container">
                {!uploadedFile && !sourceText && (
                  <label className="file-upload-btn">
                    <input
                      type="file"
                      accept=".txt,.pdf,image/*"
                      onChange={handleFileUpload}
                      disabled={isLoading || isProcessingOCR}
                      style={{ display: "none" }}
                    />
                    Seleccionar archivo (.txt, .pdf, imagen)
                  </label>
                )}
                {uploadedFile && (
                  <div className="uploaded-file">
                    <span>
                      {uploadedFile.type.startsWith("image/") ? "🖼️" : "📄"}{" "}
                      {uploadedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="remove-file-btn"
                      disabled={isProcessingOCR}
                    >
                      <FiX />
                    </button>
                  </div>
                )}
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="O pega aquí el texto del que quieres generar el examen..."
                disabled={isLoading || isProcessingOCR}
                className="source-textarea"
                rows={4}
              />
            </div>

            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              disabled={isLoading || isProcessingOCR}
              className="type-select"
            >
              <option value="opcion_multiple">Opción Múltiple</option>
              <option value="verdadero_falso">Verdadero o Falso</option>
              <option value="pregunta_abierta">Pregunta Abierta</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={isLoading || isProcessingOCR}
              className="type-select"
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>

            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              disabled={isLoading || isProcessingOCR}
              className="type-select"
            >
              <option value={5}>5 Preguntas</option>
              <option value={10}>10 Preguntas</option>
              <option value={15}>15 Preguntas</option>
              <option value={20}>20 Preguntas</option>
            </select>

            <select
              value={selectedCategoria || ""}
              onChange={(e) =>
                setSelectedCategoria(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              disabled={isLoading || isProcessingOCR}
              className="type-select"
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>

            {/* TEMPORIZADOR */}
            <div className="timer-section">
              <label className="timer-checkbox">
                <input
                  type="checkbox"
                  checked={hasTimer}
                  onChange={(e) => setHasTimer(e.target.checked)}
                  disabled={isLoading || isProcessingOCR}
                />
                <span>Agregar límite de tiempo ⏱️</span>
              </label>
              {hasTimer && (
                <div className="timer-input-group">
                  <label>Minutos:</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                    disabled={isLoading || isProcessingOCR}
                    className="timer-input"
                  />
                </div>
              )}
            </div>

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
                      disabled={isLoading || isProcessingOCR}
                    >
                      {tag.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isProcessingOCR}
              className="generate-button"
            >
              {isLoading
                ? "Generando..."
                : isProcessingOCR
                ? "Procesando imagen..."
                : "Generar Examen"}
            </button>
          </form>
        )}

        {error && <p className="error">{error}</p>}

        {/* EXAMEN */}
        {questions.length > 0 && !results && (
          <section className="exam-container">
            <div className="exam-header">
              <h2>Examen sobre: {topic}</h2>
            </div>

            {questions.map((q, index) => (
              <article key={index} className="question-card">
                <p>
                  <strong>
                    {index + 1}. {q.question}
                  </strong>
                </p>

                {examType === "pregunta_abierta" ? (
                  <textarea
                    value={userAnswers[index] || ""}
                    onChange={(e) =>
                      handleOpenAnswerChange(index, e.target.value)
                    }
                    placeholder="Escribe tu respuesta aquí..."
                    className="open-answer-textarea"
                    rows={6}
                  />
                ) : (
                  <div className="options-container">
                    {q.options?.map((option, i) => (
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
                )}
              </article>
            ))}

            <button
              className="submit-btn"
              onClick={handleSubmitExam}
              disabled={isGrading}
            >
              {isGrading ? "Calificando..." : "Calificar Examen"}
            </button>
          </section>
        )}

        {/* RESULTADOS */}
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
            {timeSpent > 0 && (
              <p className="time-info">
                Tiempo empleado: {formatTime(timeSpent)}
              </p>
            )}
            <button className="submit-btn" onClick={handleReset}>
              Crear otro examen
            </button>

            <div className="review-section">
              <h3 className="review-title">Revisión de Respuestas</h3>
              <div className="review-container">
                {questions.map((q, index) => {
                  const userAnswer = userAnswers[index];
                  const isCorrect =
                    examType === "pregunta_abierta"
                      ? openEvaluations[index]?.score >= 60
                      : userAnswer === q.answer;

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

                          {openEvaluations[index] && (
                            <div className="ai-evaluation">
                              <div className="evaluation-score">
                                <span
                                  className={`score-badge ${
                                    openEvaluations[index].score >= 80
                                      ? "excellent"
                                      : openEvaluations[index].score >= 60
                                      ? "good"
                                      : "needs-improvement"
                                  }`}
                                >
                                  {openEvaluations[index].score}/100
                                </span>
                              </div>

                              <div className="evaluation-feedback">
                                <h4>📝 Retroalimentación:</h4>
                                <p>{openEvaluations[index].feedback}</p>
                              </div>

                              <div className="evaluation-strengths">
                                <h4>✅ Fortalezas:</h4>
                                <p>{openEvaluations[index].strengths}</p>
                              </div>

                              <div className="evaluation-improvements">
                                <h4>💡 Sugerencias de mejora:</h4>
                                <p>{openEvaluations[index].improvements}</p>
                              </div>

                              <div className="model-answer">
                                <h4>Respuesta modelo:</h4>
                                <p className="model-answer-text">{q.answer}</p>
                              </div>
                            </div>
                          )}
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
                              : explanations[index]
                              ? "Ocultar explicación"
                              : "¿Por qué esta respuesta?"}
                          </button>

                          {explanations[index] && (
                            <div className="explanation-box">
                              <h4>📚 Explicación:</h4>
                              <p>{explanations[index]}</p>
                            </div>
                          )}
                        </>
                      )}
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
