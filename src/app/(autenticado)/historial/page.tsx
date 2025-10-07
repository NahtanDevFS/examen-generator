"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FiBarChart2,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiRepeat,
  FiFileText,
  FiAward,
  FiDownload,
  FiFilter,
  FiX,
  FiTrash2,
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import "./historial.css";

type Attempt = {
  id: number;
  created_at: string;
  score_correct: number;
  score_incorrect: number;
  examen_id: number;
  examenes: {
    topic: string;
    exam_type: string;
    difficulty: string | null;
    categoria_id: number | null;
    etiquetas: number[];
  } | null;
};

type Categoria = {
  id: number;
  nombre: string;
};

type Etiqueta = {
  id: number;
  nombre: string;
};

export default function HistorialPage() {
  const supabase = createClient();
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filteredAttempts, setFilteredAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados para categorías y etiquetas
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  // Estados para filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterEtiqueta, setFilterEtiqueta] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Estados para selección múltiple de exportación y eliminación
  const [selectedAttempts, setSelectedAttempts] = useState<number[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [
    attempts,
    filterDifficulty,
    filterType,
    filterCategoria,
    filterEtiqueta,
    filterDateFrom,
    filterDateTo,
  ]);

  // Auto-ocultar mensajes después de 5 segundos
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const fetchHistory = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Cargar categorías y etiquetas
      const { data: cats } = await supabase
        .from("categorias")
        .select("*")
        .eq("user_id", user.id);

      const { data: tags } = await supabase
        .from("etiquetas")
        .select("*")
        .eq("user_id", user.id);

      setCategorias(cats || []);
      setEtiquetas(tags || []);

      // Cargar historial con relaciones
      const { data, error } = await supabase
        .from("intentos_examen")
        .select(
          `
            id,
            created_at,
            score_correct,
            score_incorrect,
            examen_id, 
            examenes ( topic, exam_type, difficulty, categoria_id, etiquetas )
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

  const applyFilters = () => {
    let filtered = [...attempts];

    if (filterDifficulty) {
      filtered = filtered.filter(
        (a) => a.examenes?.difficulty === filterDifficulty
      );
    }

    if (filterType) {
      filtered = filtered.filter((a) => a.examenes?.exam_type === filterType);
    }

    if (filterCategoria) {
      filtered = filtered.filter(
        (a) => a.examenes?.categoria_id === parseInt(filterCategoria)
      );
    }

    if (filterEtiqueta) {
      filtered = filtered.filter((a) =>
        a.examenes?.etiquetas?.includes(parseInt(filterEtiqueta))
      );
    }

    if (filterDateFrom) {
      filtered = filtered.filter(
        (a) => new Date(a.created_at) >= new Date(filterDateFrom)
      );
    }

    if (filterDateTo) {
      filtered = filtered.filter(
        (a) => new Date(a.created_at) <= new Date(filterDateTo + "T23:59:59")
      );
    }

    setFilteredAttempts(filtered);
  };

  const clearFilters = () => {
    setFilterDifficulty("");
    setFilterType("");
    setFilterCategoria("");
    setFilterEtiqueta("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = () => {
    return (
      filterDifficulty ||
      filterType ||
      filterCategoria ||
      filterEtiqueta ||
      filterDateFrom ||
      filterDateTo
    );
  };

  const capitalize = (s: string | null) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleRepeatExam = (e: React.MouseEvent, examId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?examId=${examId}`);
  };

  const toggleSelectAttempt = (attemptId: number) => {
    setSelectedAttempts((prev) =>
      prev.includes(attemptId)
        ? prev.filter((id) => id !== attemptId)
        : [...prev, attemptId]
    );
  };

  const selectAll = () => {
    setSelectedAttempts(filteredAttempts.map((a) => a.id));
  };

  const deselectAll = () => {
    setSelectedAttempts([]);
  };

  const getCategoriaNombre = (categoriaId: number | null) => {
    if (!categoriaId) return "Sin categoría";
    const cat = categorias.find((c) => c.id === categoriaId);
    return cat ? cat.nombre : "Desconocida";
  };

  const getEtiquetasNombres = (etiquetasIds: number[]) => {
    if (!etiquetasIds || etiquetasIds.length === 0) return [];
    return etiquetas
      .filter((e) => etiquetasIds.includes(e.id))
      .map((e) => e.nombre);
  };

  // FUNCIONES DE ELIMINACIÓN
  const handleDeleteSingle = async (e: React.MouseEvent, attemptId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("¿Estás seguro de que deseas eliminar este registro?")) {
      return;
    }

    const { error } = await supabase
      .from("intentos_examen")
      .delete()
      .eq("id", attemptId);

    if (error) {
      setError(`Error al eliminar: ${error.message}`);
    } else {
      setSuccessMessage("Registro eliminado correctamente");
      fetchHistory();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedAttempts.length === 0) {
      setError("No hay elementos seleccionados para eliminar");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar ${selectedAttempts.length} registro(s)?`
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("intentos_examen")
      .delete()
      .in("id", selectedAttempts);

    if (error) {
      setError(`Error al eliminar: ${error.message}`);
    } else {
      setSuccessMessage(
        `${selectedAttempts.length} registro(s) eliminado(s) correctamente`
      );
      setSelectedAttempts([]);
      setDeleteMode(false);
      fetchHistory();
    }
  };

  const toggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectMode(false);
    setSelectedAttempts([]);
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setDeleteMode(false);
    setSelectedAttempts([]);
  };

  // EXPORTAR A PDF
  const exportToPDF = () => {
    const attemptsToExport = selectMode
      ? filteredAttempts.filter((a) => selectedAttempts.includes(a.id))
      : filteredAttempts;

    if (attemptsToExport.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Historial de Exámenes", 14, 20);

    doc.setFontSize(11);
    doc.text(
      `Fecha de exportación: ${new Date().toLocaleDateString()}`,
      14,
      28
    );
    doc.text(`Total de registros: ${attemptsToExport.length}`, 14, 34);

    const tableData = attemptsToExport.map((attempt) => {
      const total = attempt.score_correct + attempt.score_incorrect;
      const percentage =
        total > 0 ? ((attempt.score_correct / total) * 100).toFixed(1) : "0";

      return [
        new Date(attempt.created_at).toLocaleDateString(),
        attempt.examenes?.topic || "N/A",
        attempt.examenes?.exam_type === "opcion_multiple"
          ? "Múltiple"
          : "V o F",
        capitalize(attempt.examenes?.difficulty ?? null),
        getCategoriaNombre(attempt.examenes?.categoria_id || null),
        `${percentage}%`,
        attempt.score_correct.toString(),
        attempt.score_incorrect.toString(),
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [
        [
          "Fecha",
          "Tema",
          "Tipo",
          "Dificultad",
          "Categoría",
          "Puntuación",
          "Correctas",
          "Incorrectas",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save(`historial_examenes_${new Date().getTime()}.pdf`);

    if (selectMode) {
      setSelectMode(false);
      setSelectedAttempts([]);
    }
  };

  // EXPORTAR A EXCEL
  const exportToExcel = () => {
    const attemptsToExport = selectMode
      ? filteredAttempts.filter((a) => selectedAttempts.includes(a.id))
      : filteredAttempts;

    if (attemptsToExport.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const excelData = attemptsToExport.map((attempt) => {
      const total = attempt.score_correct + attempt.score_incorrect;
      const percentage =
        total > 0 ? ((attempt.score_correct / total) * 100).toFixed(1) : "0";

      return {
        Fecha: new Date(attempt.created_at).toLocaleDateString(),
        Tema: attempt.examenes?.topic || "N/A",
        Tipo:
          attempt.examenes?.exam_type === "opcion_multiple"
            ? "Múltiple"
            : "V o F",
        Dificultad: capitalize(attempt.examenes?.difficulty ?? null),
        Categoría: getCategoriaNombre(attempt.examenes?.categoria_id || null),
        Etiquetas: getEtiquetasNombres(attempt.examenes?.etiquetas || []).join(
          ", "
        ),
        "Puntuación (%)": percentage,
        "Respuestas Correctas": attempt.score_correct,
        "Respuestas Incorrectas": attempt.score_incorrect,
        "Total Preguntas": total,
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");

    const wscols = [
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 15 },
    ];
    ws["!cols"] = wscols;

    XLSX.writeFile(wb, `historial_examenes_${new Date().getTime()}.xlsx`);

    if (selectMode) {
      setSelectMode(false);
      setSelectedAttempts([]);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando historial...</h2>
      </div>
    );
  }

  return (
    <div className="page-content historial-page-container">
      {/* MENSAJES DE ALERTA */}
      {error && (
        <div className="alert alert-error">
          <FiX className="alert-icon" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success">
          <FiCheckCircle className="alert-icon" />
          {successMessage}
        </div>
      )}

      <div className="historial-header">
        <h1>Historial de Exámenes 📚</h1>
        <div className="header-actions">
          <button
            className="btn-filter"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Filtros
            {hasActiveFilters() && <span className="filter-badge">●</span>}
          </button>
          <button className="btn-export" onClick={toggleSelectMode}>
            <FiDownload /> {selectMode ? "Cancelar" : "Exportar"}
          </button>
          <button
            className={`btn-delete ${deleteMode ? "active" : ""}`}
            onClick={toggleDeleteMode}
          >
            <FiTrash2 /> {deleteMode ? "Cancelar" : "Eliminar"}
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS */}
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
              />
            </div>

            <div className="filter-group">
              <label>Hasta</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters() && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              <FiX /> Limpiar Filtros
            </button>
          )}
        </div>
      )}

      {/* MODO SELECCIÓN PARA EXPORTAR */}
      {selectMode && (
        <div className="selection-bar">
          <div className="selection-info">
            <span>
              {selectedAttempts.length} de {filteredAttempts.length}{" "}
              seleccionados
            </span>
          </div>
          <div className="selection-actions">
            <button className="btn-select-action" onClick={selectAll}>
              Seleccionar Todos
            </button>
            <button className="btn-select-action" onClick={deselectAll}>
              Deseleccionar Todos
            </button>
            <button
              className="btn-export-pdf"
              onClick={exportToPDF}
              disabled={selectedAttempts.length === 0}
            >
              <FiDownload /> Exportar a PDF
            </button>
            <button
              className="btn-export-excel"
              onClick={exportToExcel}
              disabled={selectedAttempts.length === 0}
            >
              <FiDownload /> Exportar a Excel
            </button>
          </div>
        </div>
      )}

      {/* MODO ELIMINACIÓN */}
      {deleteMode && (
        <div className="selection-bar delete-bar">
          <div className="selection-info">
            <span>
              {selectedAttempts.length} de {filteredAttempts.length}{" "}
              seleccionados para eliminar
            </span>
          </div>
          <div className="selection-actions">
            <button className="btn-select-action" onClick={selectAll}>
              Seleccionar Todos
            </button>
            <button className="btn-select-action" onClick={deselectAll}>
              Deseleccionar Todos
            </button>
            <button
              className="btn-delete-selected"
              onClick={handleDeleteSelected}
              disabled={selectedAttempts.length === 0}
            >
              <FiTrash2 /> Eliminar Seleccionados ({selectedAttempts.length})
            </button>
          </div>
        </div>
      )}

      {/* CONTADOR DE RESULTADOS */}
      <div className="results-counter">
        Mostrando {filteredAttempts.length} de {attempts.length} registros
      </div>

      {/* LISTA DE EXÁMENES */}
      {filteredAttempts.length === 0 ? (
        <p className="empty-state">
          {hasActiveFilters()
            ? "No se encontraron resultados con los filtros aplicados."
            : "Aún no has completado ningún examen. ¡Crea uno para empezar!"}
        </p>
      ) : (
        <div className="history-list">
          {filteredAttempts.map((attempt) => (
            <div key={attempt.id} className="history-item-wrapper">
              {(selectMode || deleteMode) && (
                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={selectedAttempts.includes(attempt.id)}
                    onChange={() => toggleSelectAttempt(attempt.id)}
                    className="select-checkbox"
                  />
                </div>
              )}
              <Link
                href={`/historial/${attempt.id}`}
                className="history-item-link"
              >
                <div className="history-item">
                  <div className="item-header">
                    <h3>{attempt.examenes?.topic || "Tema Desconocido"}</h3>
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

                  <div className="item-details">
                    <span className="detail-tag type">
                      <FiFileText />{" "}
                      {attempt.examenes?.exam_type === "opcion_multiple"
                        ? "Opción Múltiple"
                        : "V o F"}
                    </span>
                    {attempt.examenes?.difficulty && (
                      <span
                        className={`detail-tag difficulty-${attempt.examenes.difficulty}`}
                      >
                        <FiAward /> {capitalize(attempt.examenes.difficulty)}
                      </span>
                    )}
                    {attempt.examenes?.categoria_id && (
                      <span className="detail-tag categoria">
                        📁 {getCategoriaNombre(attempt.examenes.categoria_id)}
                      </span>
                    )}
                  </div>

                  {attempt.examenes?.etiquetas &&
                    attempt.examenes.etiquetas.length > 0 && (
                      <div className="item-tags">
                        {getEtiquetasNombres(attempt.examenes.etiquetas).map(
                          (tagName, idx) => (
                            <span key={idx} className="item-tag">
                              🏷️ {tagName}
                            </span>
                          )
                        )}
                      </div>
                    )}

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
              <div className="item-actions-bar">
                <button
                  className="repeat-button"
                  onClick={(e) => handleRepeatExam(e, attempt.examen_id)}
                >
                  <FiRepeat /> Repetir
                </button>
                {!selectMode && !deleteMode && (
                  <button
                    className="delete-single-button"
                    onClick={(e) => handleDeleteSingle(e, attempt.id)}
                    title="Eliminar"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BOTONES DE EXPORTACIÓN RÁPIDA */}
      {!selectMode && !deleteMode && filteredAttempts.length > 0 && (
        <div className="quick-export">
          <button className="btn-quick-export" onClick={exportToPDF}>
            <FiDownload /> Exportar Todo a PDF
          </button>
          <button className="btn-quick-export" onClick={exportToExcel}>
            <FiDownload /> Exportar Todo a Excel
          </button>
        </div>
      )}
    </div>
  );
}
