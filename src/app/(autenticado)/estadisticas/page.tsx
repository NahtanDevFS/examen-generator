"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FiTrendingUp,
  FiTarget,
  FiAward,
  FiClock,
  FiBarChart2,
  FiCheckCircle,
} from "react-icons/fi";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import "./estadisticas.css";

type StatsData = {
  totalExams: number;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  totalQuestions: number;
  correctAnswers: number;
  streak: number;
  favoriteType: string;
  favoriteDifficulty: string;
};

type ChartData = {
  date: string;
  score: number;
  exams: number;
};

type TopicStats = {
  topic: string;
  attempts: number;
  avgScore: number;
};

type DifficultyStats = {
  difficulty: string;
  count: number;
  avgScore: number;
};

type TypeStats = {
  type: string;
  count: number;
};

export default function EstadisticasPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    totalExams: 0,
    totalAttempts: 0,
    averageScore: 0,
    bestScore: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    streak: 0,
    favoriteType: "N/A",
    favoriteDifficulty: "N/A",
  });
  const [progressData, setProgressData] = useState<ChartData[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [typeStats, setTypeStats] = useState<TypeStats[]>([]);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "all">("30");

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Calcular fecha de inicio según el rango
    let startDate = new Date(0); // Desde el inicio
    if (timeRange === "7") {
      startDate = subDays(new Date(), 7);
    } else if (timeRange === "30") {
      startDate = subDays(new Date(), 30);
    }

    // Obtener todos los intentos con información del examen
    const { data: attempts } = await supabase
      .from("intentos_examen")
      .select(
        `
        id,
        created_at,
        score_correct,
        score_incorrect,
        examen_id,
        examenes (
          topic,
          exam_type,
          difficulty,
          questions
        )
      `
      )
      .eq("user_id", user.id)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (!attempts) {
      setLoading(false);
      return;
    }

    // Calcular estadísticas generales
    const totalAttempts = attempts.length;
    const totalCorrect = attempts.reduce(
      (sum, a) => sum + (a.score_correct || 0),
      0
    );
    const totalIncorrect = attempts.reduce(
      (sum, a) => sum + (a.score_incorrect || 0),
      0
    );
    const totalQuestions = totalCorrect + totalIncorrect;
    const averageScore =
      totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    // Calcular mejor puntuación
    const scores = attempts.map((a) => {
      const total = (a.score_correct || 0) + (a.score_incorrect || 0);
      return total > 0 ? ((a.score_correct || 0) / total) * 100 : 0;
    });
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Calcular racha (días consecutivos con al menos un intento)
    const streak = calculateStreak(attempts);

    // Obtener exámenes únicos
    const uniqueExams = new Set(attempts.map((a) => a.examen_id)).size;

    // Estadísticas por tipo
    const typeCount: { [key: string]: number } = {};
    attempts.forEach((a) => {
      const type = (a.examenes as any)?.exam_type || "N/A";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const favoriteType =
      Object.keys(typeCount).length > 0
        ? Object.keys(typeCount).reduce((a, b) =>
            typeCount[a] > typeCount[b] ? a : b
          )
        : "N/A";

    // Estadísticas por dificultad
    const diffCount: { [key: string]: number } = {};
    attempts.forEach((a) => {
      const diff = (a.examenes as any)?.difficulty || "N/A";
      diffCount[diff] = (diffCount[diff] || 0) + 1;
    });
    const favoriteDifficulty =
      Object.keys(diffCount).length > 0
        ? Object.keys(diffCount).reduce((a, b) =>
            diffCount[a] > diffCount[b] ? a : b
          )
        : "N/A";

    setStats({
      totalExams: uniqueExams,
      totalAttempts,
      averageScore,
      bestScore,
      totalQuestions,
      correctAnswers: totalCorrect,
      streak,
      favoriteType:
        favoriteType === "opcion_multiple" ? "Opción Múltiple" : "V o F",
      favoriteDifficulty:
        favoriteDifficulty.charAt(0).toUpperCase() +
        favoriteDifficulty.slice(1),
    });

    // Datos para gráfico de progreso temporal
    const progressMap = new Map<string, { score: number; count: number }>();
    attempts.forEach((a) => {
      const date = format(new Date(a.created_at), "dd/MM", { locale: es });
      const total = (a.score_correct || 0) + (a.score_incorrect || 0);
      const score = total > 0 ? ((a.score_correct || 0) / total) * 100 : 0;

      if (progressMap.has(date)) {
        const existing = progressMap.get(date)!;
        progressMap.set(date, {
          score: existing.score + score,
          count: existing.count + 1,
        });
      } else {
        progressMap.set(date, { score, count: 1 });
      }
    });

    const progressArray: ChartData[] = Array.from(progressMap.entries()).map(
      ([date, data]) => ({
        date,
        score: Math.round(data.score / data.count),
        exams: data.count,
      })
    );
    setProgressData(progressArray);

    // Estadísticas por tema
    const topicMap = new Map<
      string,
      { total: number; correct: number; attempts: number }
    >();
    attempts.forEach((a) => {
      const topic = (a.examenes as any)?.topic || "Desconocido";
      const total = (a.score_correct || 0) + (a.score_incorrect || 0);
      const correct = a.score_correct || 0;

      if (topicMap.has(topic)) {
        const existing = topicMap.get(topic)!;
        topicMap.set(topic, {
          total: existing.total + total,
          correct: existing.correct + correct,
          attempts: existing.attempts + 1,
        });
      } else {
        topicMap.set(topic, { total, correct, attempts: 1 });
      }
    });

    const topicArray: TopicStats[] = Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        attempts: data.attempts,
        avgScore: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);
    setTopicStats(topicArray);

    // Estadísticas por dificultad
    const diffMap = new Map<
      string,
      { total: number; correct: number; count: number }
    >();
    attempts.forEach((a) => {
      const diff = (a.examenes as any)?.difficulty || "N/A";
      const total = (a.score_correct || 0) + (a.score_incorrect || 0);
      const correct = a.score_correct || 0;

      if (diffMap.has(diff)) {
        const existing = diffMap.get(diff)!;
        diffMap.set(diff, {
          total: existing.total + total,
          correct: existing.correct + correct,
          count: existing.count + 1,
        });
      } else {
        diffMap.set(diff, { total, correct, count: 1 });
      }
    });

    const diffArray: DifficultyStats[] = Array.from(diffMap.entries()).map(
      ([difficulty, data]) => ({
        difficulty:
          difficulty.charAt(0).toUpperCase() + difficulty.slice(1) || "N/A",
        count: data.count,
        avgScore: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      })
    );
    setDifficultyStats(diffArray);

    // Estadísticas por tipo
    const typeArray: TypeStats[] = Object.entries(typeCount).map(
      ([type, count]) => ({
        type:
          type === "opcion_multiple"
            ? "Opción Múltiple"
            : type === "verdadero_falso"
            ? "Verdadero o Falso"
            : type,
        count,
      })
    );
    setTypeStats(typeArray);

    setLoading(false);
  };

  const calculateStreak = (attempts: any[]): number => {
    if (attempts.length === 0) return 0;

    const dates = attempts.map((a) =>
      startOfDay(new Date(a.created_at)).getTime()
    );
    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

    let streak = 0;
    const today = startOfDay(new Date()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedDate = today - i * oneDayMs;
      if (uniqueDates[i] === expectedDate) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  if (loading) {
    return (
      <div className="page-content">
        <h2>Cargando estadísticas...</h2>
      </div>
    );
  }

  return (
    <div className="page-content estadisticas-page">
      <div className="stats-header">
        <h1>Dashboard de Estadísticas 📊</h1>
        <div className="time-range-selector">
          <button
            className={timeRange === "7" ? "active" : ""}
            onClick={() => setTimeRange("7")}
          >
            7 días
          </button>
          <button
            className={timeRange === "30" ? "active" : ""}
            onClick={() => setTimeRange("30")}
          >
            30 días
          </button>
          <button
            className={timeRange === "all" ? "active" : ""}
            onClick={() => setTimeRange("all")}
          >
            Todo
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e3f2fd" }}>
            <FiBarChart2 size={28} color="#1976d2" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Exámenes Realizados</p>
            <h2 className="stat-value">{stats.totalExams}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e8f5e9" }}>
            <FiTarget size={28} color="#388e3c" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Promedio General</p>
            <h2 className="stat-value">{stats.averageScore.toFixed(1)}%</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#fff3e0" }}>
            <FiAward size={28} color="#f57c00" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Mejor Puntuación</p>
            <h2 className="stat-value">{stats.bestScore.toFixed(1)}%</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#fce4ec" }}>
            <FiClock size={28} color="#c2185b" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Racha de Días</p>
            <h2 className="stat-value">{stats.streak} 🔥</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#f3e5f5" }}>
            <FiCheckCircle size={28} color="#7b1fa2" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Preguntas Correctas</p>
            <h2 className="stat-value">
              {stats.correctAnswers}/{stats.totalQuestions}
            </h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e0f2f1" }}>
            <FiTrendingUp size={28} color="#00796b" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Intentos</p>
            <h2 className="stat-value">{stats.totalAttempts}</h2>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-container">
        {/* Gráfico de Progreso */}
        <div className="chart-card">
          <h3>📈 Progreso en el Tiempo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8884d8"
                strokeWidth={2}
                name="Puntuación (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico por Tema */}
        <div className="chart-card">
          <h3>📚 Top 5 Temas Más Practicados</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topicStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="topic" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="attempts" fill="#8884d8" name="Intentos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico por Dificultad */}
        <div className="chart-card">
          <h3>🎯 Rendimiento por Dificultad</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={difficultyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="difficulty" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="avgScore"
                fill="#82ca9d"
                name="Promedio (%)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico Circular de Tipos */}
        <div className="chart-card">
          <h3>📋 Distribución por Tipo de Examen</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.type}: ${entry.count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {typeStats.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Información Adicional */}
      <div className="info-cards">
        <div className="info-card">
          <h4>🏆 Tipo Favorito</h4>
          <p>{stats.favoriteType}</p>
        </div>
        <div className="info-card">
          <h4>⭐ Dificultad Preferida</h4>
          <p>{stats.favoriteDifficulty}</p>
        </div>
        <div className="info-card">
          <h4>💯 Tasa de Aciertos</h4>
          <p>
            {stats.totalQuestions > 0
              ? ((stats.correctAnswers / stats.totalQuestions) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
}
