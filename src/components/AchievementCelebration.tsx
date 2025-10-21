// src/components/AchievementCelebration.tsx
"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { FiX } from "react-icons/fi";
import "./AchievementCelebration.css";

type Logro = {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  dificultad: "fácil" | "intermedio" | "difícil";
};

type AchievementCelebrationProps = {
  logros: Logro[];
  onClose: () => void;
};

export default function AchievementCelebration({
  logros,
  onClose,
}: AchievementCelebrationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Lanzar confetti al montar el componente
    launchConfetti();

    // Confetti continuo durante los primeros 3 segundos
    const confettiInterval = setInterval(() => {
      launchConfetti();
    }, 400);

    setTimeout(() => {
      clearInterval(confettiInterval);
    }, 3000);

    return () => clearInterval(confettiInterval);
  }, []);

  useEffect(() => {
    // Auto-avanzar cada 4 segundos si hay múltiples logros
    if (logros.length > 1 && currentIndex < logros.length - 1) {
      const timer = setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        launchConfetti();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, logros.length]);

  const launchConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleNext = () => {
    if (currentIndex < logros.length - 1) {
      setCurrentIndex(currentIndex + 1);
      launchConfetti();
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentLogro = logros[currentIndex];

  const getDifficultyColor = (dificultad: string) => {
    switch (dificultad) {
      case "fácil":
        return "#28a745";
      case "intermedio":
        return "#ffc107";
      case "difícil":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getDifficultyLabel = (dificultad: string) => {
    switch (dificultad) {
      case "fácil":
        return "Fácil";
      case "intermedio":
        return "Intermedio";
      case "difícil":
        return "Difícil";
      default:
        return "";
    }
  };

  return (
    <div className={`achievement-overlay ${isExiting ? "exiting" : ""}`}>
      <div className={`achievement-modal ${isExiting ? "exiting" : ""}`}>
        <button className="achievement-close-btn" onClick={handleClose}>
          <FiX size={24} />
        </button>

        <div className="achievement-content">
          <div className="achievement-header">
            <h2 className="achievement-title">¡Logro Desbloqueado!</h2>
            {logros.length > 1 && (
              <p className="achievement-counter">
                {currentIndex + 1} de {logros.length}
              </p>
            )}
          </div>

          <div className="achievement-icon-container">
            <div className="achievement-icon-glow"></div>
            <div className="achievement-icon-wrapper">
              <span className="achievement-icon">{currentLogro.icono}</span>
            </div>
          </div>

          <div className="achievement-info">
            <h3 className="achievement-name">{currentLogro.nombre}</h3>
            <p className="achievement-description">
              {currentLogro.descripcion}
            </p>
            <span
              className="achievement-difficulty"
              style={{
                backgroundColor: getDifficultyColor(currentLogro.dificultad),
              }}
            >
              {getDifficultyLabel(currentLogro.dificultad)}
            </span>
          </div>

          {logros.length > 1 && (
            <div className="achievement-navigation">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="nav-btn prev-btn"
              >
                ← Anterior
              </button>
              <div className="achievement-dots">
                {logros.map((_, index) => (
                  <span
                    key={index}
                    className={`dot ${index === currentIndex ? "active" : ""}`}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
              <button onClick={handleNext} className="nav-btn next-btn">
                {currentIndex === logros.length - 1 ? "Cerrar" : "Siguiente →"}
              </button>
            </div>
          )}

          {logros.length === 1 && (
            <button onClick={handleClose} className="achievement-continue-btn">
              ¡Continuar!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
