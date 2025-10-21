// src/app/(autenticado)/aprender/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FiChevronDown,
  FiSend,
  FiStar,
  FiSearch,
  FiX,
  FiFilter,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import "./aprender.css";

type Attempt = {
  id: number;
  created_at: string;
  examenes: {
    topic: string;
    questions: any[];
    exam_type: string;
    difficulty: string | null;
    categoria_id: number | null;
    etiquetas: number[];
  } | null;
  user_answers: any;
  score_correct: number;
  score_incorrect: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Categoria = {
  id: number;
  nombre: string;
};

type Etiqueta = {
  id: number;
  nombre: string;
};

export default function AprenderPage() {
  const supabase = createClient();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filteredAttempts, setFilteredAttempts] = useState<Attempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterEtiqueta, setFilterEtiqueta] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    fetchAttempts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [
    attempts,
    searchTerm,
    filterDifficulty,
    filterType,
    filterCategoria,
    filterEtiqueta,
    filterDateFrom,
    filterDateTo,
    sortOrder,
  ]);

  const fetchAttempts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No hay usuario autenticado");
      return;
    }

    const { data: cats } = await supabase
      .from("categorias")
      .select("*")
      .eq("user_id", user.id)
      .order("nombre");

    const { data: tags } = await supabase
      .from("etiquetas")
      .select("*")
      .eq("user_id", user.id)
      .order("nombre");

    setCategorias(cats || []);
    setEtiquetas(tags || []);

    const { data } = await supabase
      .from("intentos_examen")
      .select(
        `
        id,
        created_at,
        user_answers,
        score_correct,
        score_incorrect,
        examenes ( 
          topic, 
          questions, 
          exam_type, 
          difficulty, 
          categoria_id, 
          etiquetas 
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setAttempts((data as any) || []);
  };

  const applyFilters = () => {
    let filtered = [...attempts];

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((attempt) =>
        attempt.examenes?.topic.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (filterDifficulty) {
      filtered = filtered.filter(
        (attempt) => attempt.examenes?.difficulty === filterDifficulty
      );
    }

    if (filterType) {
      filtered = filtered.filter(
        (attempt) => attempt.examenes?.exam_type === filterType
      );
    }

    if (filterCategoria) {
      filtered = filtered.filter(
        (attempt) =>
          attempt.examenes?.categoria_id === parseInt(filterCategoria)
      );
    }

    if (filterEtiqueta) {
      filtered = filtered.filter((attempt) =>
        attempt.examenes?.etiquetas?.includes(parseInt(filterEtiqueta))
      );
    }

    if (filterDateFrom) {
      filtered = filtered.filter(
        (attempt) => new Date(attempt.created_at) >= new Date(filterDateFrom)
      );
    }

    if (filterDateTo) {
      filtered = filtered.filter(
        (attempt) =>
          new Date(attempt.created_at) <= new Date(filterDateTo + "T23:59:59")
      );
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    setFilteredAttempts(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterDifficulty("");
    setFilterType("");
    setFilterCategoria("");
    setFilterEtiqueta("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSortOrder("desc");
  };

  const hasActiveFilters = () => {
    return (
      searchTerm ||
      filterDifficulty ||
      filterType ||
      filterCategoria ||
      filterEtiqueta ||
      filterDateFrom ||
      filterDateTo ||
      sortOrder !== "desc"
    );
  };

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

  const getExamTypeLabel = (type: string) => {
    switch (type) {
      case "opcion_multiple":
        return "Opción Múltiple";
      case "verdadero_falso":
        return "Verdadero o Falso";
      case "pregunta_abierta":
        return "Pregunta Abierta";
      default:
        return type;
    }
  };

  const capitalize = (s: string | null) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getCategoriaNombre = (categoriaId: number | null) => {
    if (!categoriaId) return null;
    const cat = categorias.find((c) => c.id === categoriaId);
    return cat?.nombre;
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

      <div className="search-bar-container">
        <div className="search-bar-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar examen por nombre..."
            className="search-input"
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm("")}
              title="Limpiar búsqueda"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      <div className="filters-control">
        <button
          className={`btn-filters ${showFilters ? "active" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter />
          {showFilters ? "Ocultar Filtros" : "Filtros"}
          {hasActiveFilters() && <span className="filter-badge">●</span>}
        </button>
        {hasActiveFilters() && (
          <span className="active-filters-text">
            {filteredAttempts.length} de {attempts.length} exámenes
          </span>
        )}
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Tipo de Examen</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="opcion_multiple">Opción Múltiple</option>
                <option value="verdadero_falso">Verdadero o Falso</option>
                <option value="pregunta_abierta">Pregunta Abierta</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Dificultad</label>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Categoría</label>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
              >
                <option value="">Todas</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Etiqueta</label>
              <select
                value={filterEtiqueta}
                onChange={(e) => setFilterEtiqueta(e.target.value)}
              >
                <option value="">Todas</option>
                {etiquetas.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Desde</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                max={filterDateTo || undefined}
              />
            </div>

            <div className="filter-group">
              <label>Hasta</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                min={filterDateFrom || undefined}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="filter-group">
              <label>Ordenar por Fecha</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              >
                <option value="desc">Más reciente primero</option>
                <option value="asc">Más antiguo primero</option>
              </select>
            </div>
          </div>

          {hasActiveFilters() && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              <FiX /> Limpiar Filtros
            </button>
          )}
        </div>
      )}

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
              {filteredAttempts.length > 0 ? (
                filteredAttempts.map((att) => (
                  <div
                    key={att.id}
                    className="dropdown-item"
                    onClick={() => handleSelectAttempt(att)}
                  >
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">
                        {att.examenes?.topic}
                      </span>
                      <div className="dropdown-item-meta">
                        <small className="dropdown-item-date">
                          {new Date(att.created_at).toLocaleDateString(
                            "es-ES",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </small>
                        {att.examenes?.exam_type && (
                          <span className="dropdown-item-badge type-badge">
                            {getExamTypeLabel(att.examenes.exam_type)}
                          </span>
                        )}
                        {att.examenes?.difficulty && (
                          <span
                            className={`dropdown-item-badge difficulty-${att.examenes.difficulty}`}
                          >
                            {capitalize(att.examenes.difficulty)}
                          </span>
                        )}
                        {att.examenes?.categoria_id && (
                          <span className="dropdown-item-badge categoria-badge">
                            📁 {getCategoriaNombre(att.examenes.categoria_id)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dropdown-item disabled">
                  {hasActiveFilters()
                    ? "No se encontraron exámenes con los filtros aplicados."
                    : "No hay exámenes recientes."}
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
