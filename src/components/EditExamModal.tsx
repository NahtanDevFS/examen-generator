// src/components/EditExamModal.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FiX } from "react-icons/fi";
import "./EditExamModal.css";

type Categoria = {
  id: number;
  nombre: string;
};

type Etiqueta = {
  id: number;
  nombre: string;
};

type EditExamModalProps = {
  examId: number;
  currentTopic: string;
  currentCategoriaId: number | null;
  currentEtiquetas: number[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditExamModal({
  examId,
  currentTopic,
  currentCategoriaId,
  currentEtiquetas,
  onClose,
  onSuccess,
}: EditExamModalProps) {
  const supabase = createClient();
  const [topic, setTopic] = useState(currentTopic);
  const [categoriaId, setCategoriaId] = useState<number | null>(
    currentCategoriaId
  );
  const [selectedEtiquetas, setSelectedEtiquetas] = useState<number[]>(
    currentEtiquetas || []
  );
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategoriasYEtiquetas();
  }, []);

  const fetchCategoriasYEtiquetas = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!topic.trim()) {
      setError("El título del examen no puede estar vacío");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("examenes")
      .update({
        topic: topic.trim(),
        categoria_id: categoriaId,
        etiquetas: selectedEtiquetas,
      })
      .eq("id", examId);

    if (updateError) {
      setError(`Error al actualizar: ${updateError.message}`);
      setLoading(false);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Editar Examen</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-exam-form">
          <div className="form-group">
            <label htmlFor="topic">Título del Examen</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Matemáticas Básicas, Historia del Arte..."
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              value={categoriaId || ""}
              onChange={(e) =>
                setCategoriaId(e.target.value ? parseInt(e.target.value) : null)
              }
              disabled={loading}
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          {etiquetas.length > 0 && (
            <div className="form-group">
              <label>Etiquetas</label>
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
                    disabled={loading}
                  >
                    {tag.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
