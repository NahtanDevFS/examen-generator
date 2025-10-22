// src/app/demo/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiUpload } from "react-icons/fi";
import "../(autenticado)/loading-screen.css";
import "./demo.css";

export default function DemoPage() {
  const router = useRouter();
  const [overlayVisible, setOverlayVisible] = useState(false);

  const handleDemoContentClick = () => {
    if (!overlayVisible) {
      setOverlayVisible(true);
    }
  };

  const handleOverlayAction = () => {
    router.push("/login");
  };

  return (
    <>
      {overlayVisible && (
        <div className="demo-overlay" onClick={handleOverlayAction}>
          <div className="demo-message" onClick={(e) => e.stopPropagation()}>
            <div className="demo-icon">🔒</div>
            <h2>Crea una cuenta para comenzar</h2>
            <p>
              Para crear y realizar exámenes personalizados con IA, necesitas
              una cuenta gratuita.
            </p>
            <div className="demo-actions">
              <button
                className="demo-btn demo-btn-primary"
                onClick={handleOverlayAction}
              >
                Crear Cuenta
              </button>
              <button
                className="demo-btn demo-btn-secondary"
                onClick={handleOverlayAction}
              >
                Iniciar Sesión
              </button>
            </div>
            <p className="demo-footer-text">
              ✨ Acceso completo • Comienza en segundos
            </p>
          </div>
        </div>
      )}

      <div
        className={`demo-content ${overlayVisible ? "overlay-active" : ""}`}
        onClick={handleDemoContentClick}
      >
        <h1>Generador de Exámenes con IA 🧠</h1>
        <p className="page-description">
          Crea un nuevo examen a partir de un texto, un tema o repite uno que ya
          hayas realizado.
        </p>

        <form className="generator-form" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            placeholder="Tema del examen (ej: JavaScript, Historia)"
            disabled
            className="topic-input"
          />

          <div className="source-text-section">
            Opcionalmente puedes agregar información sobre el tema que quieras
            evaluarte.
            <label className="upload-label">
              <FiUpload /> Subir archivo, imagen o pegar texto (opcional)
            </label>
            <div className="upload-container">
              <label className="file-upload-btn">
                Seleccionar archivo (.txt, .pdf, imagen)
              </label>
            </div>
            <textarea
              placeholder="O pega aquí el texto del que quieres generar el examen..."
              disabled
              className="source-textarea"
              rows={4}
            />
          </div>

          <select disabled className="type-select">
            <option value="opcion_multiple">Opción Múltiple</option>
            <option value="verdadero_falso">Verdadero o Falso</option>
            <option value="pregunta_abierta">Pregunta Abierta</option>
          </select>

          <select disabled className="type-select">
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>

          <select disabled className="type-select">
            <option value={5}>5 Preguntas</option>
            <option value={10}>10 Preguntas</option>
            <option value={15}>15 Preguntas</option>
            <option value={20}>20 Preguntas</option>
          </select>

          <select disabled className="type-select">
            <option value="">Sin categoría</option>
          </select>

          <div className="timer-section">
            <label className="timer-checkbox">
              <input type="checkbox" disabled />
              <span>Agregar límite de tiempo ⏱️</span>
            </label>
          </div>

          <button type="button" disabled className="generate-button">
            Generar Examen
          </button>
        </form>

        <section className="exam-container">
          <div className="exam-header">
            <h2>Vista previa del examen</h2>
          </div>

          <article className="question-card">
            <p>
              <strong>1. Pregunta de ejemplo</strong>
            </p>
            <div className="options-container">
              <button className="option-btn" disabled>
                Opción A
              </button>
              <button className="option-btn" disabled>
                Opción B
              </button>
              <button className="option-btn" disabled>
                Opción C
              </button>
              <button className="option-btn" disabled>
                Opción D
              </button>
            </div>
          </article>

          <article className="question-card">
            <p>
              <strong>2. Otra pregunta de ejemplo</strong>
            </p>
            <div className="options-container">
              <button className="option-btn" disabled>
                Opción A
              </button>
              <button className="option-btn" disabled>
                Opción B
              </button>
              <button className="option-btn" disabled>
                Opción C
              </button>
              <button className="option-btn" disabled>
                Opción D
              </button>
            </div>
          </article>

          <button className="submit-btn" disabled>
            Calificar Examen
          </button>
        </section>
      </div>
    </>
  );
}
