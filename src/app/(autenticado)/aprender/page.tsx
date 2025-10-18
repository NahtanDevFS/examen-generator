// src/app/(autenticado)/aprender/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FiChevronDown, FiPlus, FiSend, FiStar } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import "./aprender.css";

type Attempt = {
  id: number;
  created_at: string;
  examenes: {
    topic: string;
    questions: any[];
  } | null;
  user_answers: any;
  score_correct: number;
  score_incorrect: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AprenderPage() {
  const supabase = createClient();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAttempts = async () => {
      // ✅ CORRECCIÓN: Obtener el usuario actual primero
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No hay usuario autenticado");
        return;
      }

      // ✅ CORRECCIÓN: Filtrar por user_id
      const { data } = await supabase
        .from("intentos_examen")
        .select(
          `
          id,
          created_at,
          user_answers,
          score_correct,
          score_incorrect,
          examenes ( topic, questions )
        `
        )
        .eq("user_id", user.id) // ✅ Filtro agregado
        .order("created_at", { ascending: false })
        .limit(20);

      setAttempts((data as any) || []);
    };
    fetchAttempts();
  }, [supabase]);

  const handleSelectAttempt = (attempt: Attempt) => {
    setSelectedAttempt(attempt);
    setIsDropdownOpen(false);
    setMessages([
      {
        role: "assistant",
        content: `¡Hola! He cargado tu examen sobre **${attempt.examenes?.topic}**. ¿Qué te gustaría analizar?`,
      },
    ]);
  };

  const handleSendMessage = async (prompt?: string) => {
    const messageToSend = prompt || userInput;
    if (!messageToSend.trim() || !selectedAttempt) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: messageToSend },
    ];
    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt: selectedAttempt,
          prompt: messageToSend,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.analysis },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "Lo siento, ha ocurrido un error al analizar el examen.",
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Error de conexión. Por favor, inténtalo de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedPrompts = [
    "Identifica mis 3 puntos débiles en este examen.",
    "Sugiéreme 5 etiquetas relevantes para este examen.",
    "Dame un resumen de los temas que necesito reforzar.",
    "Explícame la pregunta #3 como si tuviera 15 años.",
  ];

  return (
    <div className="page-content aprender-page">
      <h1>Aprender y Mejorar con IA 🧠</h1>
      <p className="page-description">
        Selecciona uno de tus exámenes recientes y utiliza la inteligencia
        artificial para obtener un análisis detallado y recomendaciones.
      </p>

      <div className="selector-container">
        <div
          className="custom-dropdown"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="dropdown-selected">
            {selectedAttempt
              ? `Examen: ${selectedAttempt.examenes?.topic} (${new Date(
                  selectedAttempt.created_at
                ).toLocaleDateString()})`
              : "Selecciona un examen para analizar"}
            <FiChevronDown
              className={`dropdown-icon ${isDropdownOpen ? "open" : ""}`}
            />
          </div>
          {isDropdownOpen && (
            <div className="dropdown-options">
              {attempts.length > 0 ? (
                attempts.map((att) => (
                  <div
                    key={att.id}
                    className="dropdown-item"
                    onClick={() => handleSelectAttempt(att)}
                  >
                    <span>{att.examenes?.topic}</span>
                    <small>
                      {new Date(att.created_at).toLocaleString("es-ES")}
                    </small>
                  </div>
                ))
              ) : (
                <div className="dropdown-item disabled">
                  No hay exámenes recientes.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedAttempt && (
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}-message`}>
                <div className="message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant-message">
                <div className="message-content loading-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}
          </div>

          <div className="suggested-prompts">
            {suggestedPrompts.map((prompt, i) => (
              <button key={i} onClick={() => handleSendMessage(prompt)}>
                <FiStar /> {prompt}
              </button>
            ))}
          </div>

          <div className="chat-input-area">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Escribe tu pregunta aquí..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !userInput.trim()}
              className="send-btn"
            >
              <FiSend />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
