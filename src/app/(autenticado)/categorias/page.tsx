"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FiEdit2, FiTrash2, FiPlus, FiTag, FiFolder } from "react-icons/fi";
import "./categorias.css";

type Categoria = {
  id: number;
  nombre: string;
};

type Etiqueta = {
  id: number;
  nombre: string;
};

// Colores e íconos predefinidos en el frontend
const CATEGORY_COLORS = [
  "#4CAF50",
  "#2196F3",
  "#FF9800",
  "#9C27B0",
  "#F44336",
  "#00BCD4",
  "#FFC107",
  "#E91E63",
  "#3F51B5",
  "#8BC34A",
];

const CATEGORY_ICONS = [
  "📚",
  "💻",
  "🔬",
  "🗣️",
  "📜",
  "🎨",
  "⚽",
  "🎵",
  "🍳",
  "✈️",
  "🏀",
  "🎮",
];

const TAG_COLORS = [
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

export default function CategoriasPage() {
  const supabase = createClient();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para formularios
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(
    null
  );
  const [editingTag, setEditingTag] = useState<Etiqueta | null>(null);

  // Estados de campos
  const [categoryName, setCategoryName] = useState("");
  const [tagName, setTagName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
    setLoading(false);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (editingCategory) {
      const { error: updateError } = await supabase
        .from("categorias")
        .update({ nombre: categoryName })
        .eq("id", editingCategory.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("Categoría actualizada correctamente");
        resetCategoryForm();
        fetchData();
      }
    } else {
      const { error: insertError } = await supabase
        .from("categorias")
        .insert({ user_id: user.id, nombre: categoryName });

      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("Categoría creada correctamente");
        resetCategoryForm();
        fetchData();
      }
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTag) {
      const { error: updateError } = await supabase
        .from("etiquetas")
        .update({ nombre: tagName })
        .eq("id", editingTag.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("Etiqueta actualizada correctamente");
        resetTagForm();
        fetchData();
      }
    } else {
      const { error: insertError } = await supabase
        .from("etiquetas")
        .insert({ user_id: user.id, nombre: tagName });

      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("Etiqueta creada correctamente");
        resetTagForm();
        fetchData();
      }
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;

    const { error: deleteError } = await supabase
      .from("categorias")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("Categoría eliminada");
      fetchData();
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta etiqueta?")) return;

    const { error: deleteError } = await supabase
      .from("etiquetas")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("Etiqueta eliminada");
      fetchData();
    }
  };

  const handleEditCategory = (cat: Categoria) => {
    setEditingCategory(cat);
    setCategoryName(cat.nombre);
    setShowCategoryForm(true);
  };

  const handleEditTag = (tag: Etiqueta) => {
    setEditingTag(tag);
    setTagName(tag.nombre);
    setShowTagForm(true);
  };

  const resetCategoryForm = () => {
    setCategoryName("");
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const resetTagForm = () => {
    setTagName("");
    setEditingTag(null);
    setShowTagForm(false);
  };

  // Función para obtener color e ícono basado en el índice
  const getCategoryColor = (index: number) =>
    CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const getCategoryIcon = (index: number) =>
    CATEGORY_ICONS[index % CATEGORY_ICONS.length];
  const getTagColor = (index: number) => TAG_COLORS[index % TAG_COLORS.length];

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando...</h2>
      </div>
    );
  }

  return (
    <div className="page-content categorias-page">
      <h1>Gestionar Categorías y Etiquetas 🏷️</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* CATEGORÍAS */}
      <section className="management-section">
        <div className="section-header">
          <h2>
            <FiFolder /> Categorías
          </h2>
          <button
            className="btn-primary"
            onClick={() => setShowCategoryForm(!showCategoryForm)}
          >
            <FiPlus /> Nueva Categoría
          </button>
        </div>

        {showCategoryForm && (
          <form onSubmit={handleSaveCategory} className="entity-form">
            <div className="form-group">
              <label>Nombre de la Categoría</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ej: Matemáticas, Programación, Historia..."
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-save">
                {editingCategory ? "Actualizar" : "Crear"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={resetCategoryForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="entities-grid">
          {categorias.map((cat, index) => (
            <div key={cat.id} className="entity-card">
              <div
                className="entity-icon"
                style={{ backgroundColor: getCategoryColor(index) }}
              >
                {getCategoryIcon(index)}
              </div>
              <div className="entity-info">
                <h3>{cat.nombre}</h3>
              </div>
              <div className="entity-actions">
                <button
                  className="btn-icon"
                  onClick={() => handleEditCategory(cat)}
                  title="Editar"
                >
                  <FiEdit2 />
                </button>
                <button
                  className="btn-icon btn-danger"
                  onClick={() => handleDeleteCategory(cat.id)}
                  title="Eliminar"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>

        {categorias.length === 0 && (
          <p className="empty-message">
            No tienes categorías aún. ¡Crea una para organizar tus exámenes!
          </p>
        )}
      </section>

      {/* ETIQUETAS */}
      <section className="management-section">
        <div className="section-header">
          <h2>
            <FiTag /> Etiquetas
          </h2>
          <button
            className="btn-primary"
            onClick={() => setShowTagForm(!showTagForm)}
          >
            <FiPlus /> Nueva Etiqueta
          </button>
        </div>

        {showTagForm && (
          <form onSubmit={handleSaveTag} className="entity-form">
            <div className="form-group">
              <label>Nombre de la Etiqueta</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Ej: Importante, Repaso, Difícil..."
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-save">
                {editingTag ? "Actualizar" : "Crear"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={resetTagForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="tags-container">
          {etiquetas.map((tag, index) => (
            <div
              key={tag.id}
              className="tag-item"
              style={{
                backgroundColor: getTagColor(index) + "20",
                borderColor: getTagColor(index),
              }}
            >
              <span style={{ color: getTagColor(index) }}>{tag.nombre}</span>
              <div className="tag-actions">
                <button
                  className="btn-icon-small"
                  onClick={() => handleEditTag(tag)}
                >
                  <FiEdit2 />
                </button>
                <button
                  className="btn-icon-small btn-danger"
                  onClick={() => handleDeleteTag(tag.id)}
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>

        {etiquetas.length === 0 && (
          <p className="empty-message">
            No tienes etiquetas aún. ¡Crea algunas para organizar mejor!
          </p>
        )}
      </section>
    </div>
  );
}
