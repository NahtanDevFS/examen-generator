// src/app/(autenticado)/estadisticas/page.tsx
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
  FiDownload,
  FiStar,
  FiCalendar,
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
import {
  format,
  subDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
  completedAchievements: number;
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

type GroupBy = "day" | "week" | "month" | "year";

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
    completedAchievements: 0,
  });
  const [progressData, setProgressData] = useState<ChartData[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [typeStats, setTypeStats] = useState<TypeStats[]>([]);
  const [timeRange, setTimeRange] = useState<
    "7" | "14" | "30" | "90" | "all" | "custom"
  >("30");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");

  // Estados para periodo personalizado
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDateInputs, setShowCustomDateInputs] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, [timeRange, customStartDate, customEndDate, groupBy]);

  const fetchStatistics = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Calcular fecha de inicio según el rango
    let startDate = new Date(0);

    if (timeRange === "custom") {
      if (customStartDate) {
        startDate = new Date(customStartDate);
      }
    } else if (timeRange === "7") {
      startDate = subDays(new Date(), 7);
    } else if (timeRange === "14") {
      startDate = subDays(new Date(), 14);
    } else if (timeRange === "30") {
      startDate = subDays(new Date(), 30);
    } else if (timeRange === "90") {
      startDate = subDays(new Date(), 90);
    }

    // Obtener logros completados
    const { count: achievementsCount } = await supabase
      .from("progreso_logros_usuario")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("desbloqueado_en", "is", null);

    // Construir query base
    let query = supabase
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
      .order("created_at", { ascending: true });

    // Aplicar filtros de fecha
    if (timeRange === "custom") {
      if (customStartDate) {
        query = query.gte(
          "created_at",
          new Date(customStartDate).toISOString()
        );
      }
      if (customEndDate) {
        query = query.lte(
          "created_at",
          new Date(customEndDate + "T23:59:59").toISOString()
        );
      }
    } else if (timeRange !== "all") {
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: attempts } = await query;

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
        favoriteType === "opcion_multiple"
          ? "Opción Múltiple"
          : favoriteType === "verdadero_falso"
          ? "V o F"
          : "Pregunta Abierta",
      favoriteDifficulty:
        favoriteDifficulty.charAt(0).toUpperCase() +
        favoriteDifficulty.slice(1),
      completedAchievements: achievementsCount || 0,
    });

    // Datos para gráfico de progreso temporal con agrupación
    const progressMap = new Map<string, { score: number; count: number }>();
    attempts.forEach((a) => {
      const dateKey = getDateKey(new Date(a.created_at), groupBy);
      const total = (a.score_correct || 0) + (a.score_incorrect || 0);
      const score = total > 0 ? ((a.score_correct || 0) / total) * 100 : 0;

      if (progressMap.has(dateKey)) {
        const existing = progressMap.get(dateKey)!;
        progressMap.set(dateKey, {
          score: existing.score + score,
          count: existing.count + 1,
        });
      } else {
        progressMap.set(dateKey, { score, count: 1 });
      }
    });

    const progressArray: ChartData[] = Array.from(progressMap.entries())
      .map(([date, data]) => ({
        date,
        score: Math.round(data.score / data.count),
        exams: data.count,
      }))
      .sort((a, b) => {
        // Ordenar por fecha
        const dateA = parseDateKey(a.date, groupBy);
        const dateB = parseDateKey(b.date, groupBy);
        return dateA.getTime() - dateB.getTime();
      });

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
            : "Pregunta Abierta",
        count,
      })
    );
    setTypeStats(typeArray);

    setLoading(false);
  };

  // Función para obtener la clave de fecha según el agrupamiento
  const getDateKey = (date: Date, grouping: GroupBy): string => {
    switch (grouping) {
      case "day":
        return format(date, "dd/MM/yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        return format(weekStart, "'Semana del' dd/MM/yyyy", { locale: es });
      case "month":
        return format(date, "MMMM yyyy", { locale: es });
      case "year":
        return format(date, "yyyy");
      default:
        return format(date, "dd/MM/yyyy", { locale: es });
    }
  };

  // Función para parsear la clave de fecha de vuelta a Date (para ordenar)
  const parseDateKey = (dateKey: string, grouping: GroupBy): Date => {
    switch (grouping) {
      case "day":
        const [day, month, year] = dateKey.split("/");
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      case "week":
        const weekMatch = dateKey.match(/\d{2}\/\d{2}\/\d{4}/);
        if (weekMatch) {
          const [d, m, y] = weekMatch[0].split("/");
          return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        }
        return new Date();
      case "month":
        return new Date(dateKey);
      case "year":
        return new Date(parseInt(dateKey), 0, 1);
      default:
        return new Date();
    }
  };

  const calculateStreak = (attempts: any[]): number => {
    if (attempts.length === 0) return 0;

    const dates = attempts.map((a) =>
      startOfDay(new Date(a.created_at)).getTime()
    );
    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

    let streak = 0;
    const today = startOfDay(new Date()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;

    const hasYesterday = uniqueDates.includes(yesterday);
    const hasToday = uniqueDates.includes(today);

    if (hasYesterday || hasToday) {
      const startPoint = hasToday ? today : yesterday;

      for (let i = 0; i < uniqueDates.length; i++) {
        const expectedDate = startPoint - i * oneDayMs;
        if (uniqueDates[i] === expectedDate) {
          streak++;
        } else {
          break;
        }
      }
    } else {
      streak = 0;
    }

    return streak;
  };

  const handleTimeRangeChange = (
    range: "7" | "14" | "30" | "90" | "all" | "custom"
  ) => {
    setTimeRange(range);
    if (range === "custom") {
      setShowCustomDateInputs(true);
    } else {
      setShowCustomDateInputs(false);
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Estadísticas de Exámenes", 14, 20);

    doc.setFontSize(11);
    doc.text(
      `Fecha de exportación: ${new Date().toLocaleDateString()}`,
      14,
      28
    );
    doc.text(`Rango: ${getTimeRangeLabel(timeRange)}`, 14, 34);

    let yPosition = 45;

    doc.setFontSize(13);
    doc.text("Resumen General", 14, yPosition);
    yPosition += 10;

    const summaryData = [
      ["Exámenes Realizados", stats.totalExams.toString()],
      ["Total Intentos", stats.totalAttempts.toString()],
      ["Promedio General", `${stats.averageScore.toFixed(1)}%`],
      ["Mejor Puntuación", `${stats.bestScore.toFixed(1)}%`],
      [
        "Preguntas Correctas",
        `${stats.correctAnswers}/${stats.totalQuestions}`,
      ],
      ["Racha de Días", stats.streak.toString()],
      ["Tipo Favorito", stats.favoriteType],
      ["Dificultad Preferida", stats.favoriteDifficulty],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [["Métrica", "Valor"]],
      body: summaryData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 123, 255] },
    });

    doc.save(`estadisticas_${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    const summaryData = [
      {
        Métrica: "Exámenes Realizados",
        Valor: stats.totalExams,
      },
      {
        Métrica: "Total Intentos",
        Valor: stats.totalAttempts,
      },
      {
        Métrica: "Promedio General",
        Valor: `${stats.averageScore.toFixed(1)}%`,
      },
      {
        Métrica: "Mejor Puntuación",
        Valor: `${stats.bestScore.toFixed(1)}%`,
      },
      {
        Métrica: "Preguntas Correctas",
        Valor: `${stats.correctAnswers}/${stats.totalQuestions}`,
      },
      {
        Métrica: "Racha de Días",
        Valor: stats.streak,
      },
      {
        Métrica: "Tipo Favorito",
        Valor: stats.favoriteType,
      },
      {
        Métrica: "Dificultad Preferida",
        Valor: stats.favoriteDifficulty,
      },
    ];

    const topicData = topicStats.map((topic) => ({
      Tema: topic.topic,
      Intentos: topic.attempts,
      "Promedio (%)": topic.avgScore.toFixed(1),
    }));

    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(topicData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen");
    XLSX.utils.book_append_sheet(wb, ws2, "Temas");

    ws1["!cols"] = [{ wch: 25 }, { wch: 20 }];
    ws2["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }];

    XLSX.writeFile(wb, `estadisticas_${new Date().getTime()}.xlsx`);
  };

  const getTimeRangeLabel = (range: string): string => {
    switch (range) {
      case "7":
        return "Últimos 7 días";
      case "14":
        return "Últimos 14 días";
      case "30":
        return "Últimos 30 días";
      case "90":
        return "Últimos 90 días";
      case "all":
        return "Todo el tiempo";
      case "custom":
        if (customStartDate && customEndDate) {
          return `${new Date(
            customStartDate
          ).toLocaleDateString()} - ${new Date(
            customEndDate
          ).toLocaleDateString()}`;
        } else if (customStartDate) {
          return `Desde ${new Date(customStartDate).toLocaleDateString()}`;
        } else if (customEndDate) {
          return `Hasta ${new Date(customEndDate).toLocaleDateString()}`;
        }
        return "Periodo personalizado";
      default:
        return "Desconocido";
    }
  };

  const getGroupByLabel = (group: GroupBy): string => {
    switch (group) {
      case "day":
        return "Día";
      case "week":
        return "Semana";
      case "month":
        return "Mes";
      case "year":
        return "Año";
      default:
        return "Día";
    }
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
        <p className="page-description">
          Aquí puedes visualizar tu progreso, analizar tus resultados a lo largo
          del tiempo y descubrir tus puntos fuertes.
        </p>
        <div className="stats-controls">
          <div className="time-range-selector">
            <button
              className={timeRange === "7" ? "active" : ""}
              onClick={() => handleTimeRangeChange("7")}
            >
              7 días
            </button>
            <button
              className={timeRange === "14" ? "active" : ""}
              onClick={() => handleTimeRangeChange("14")}
            >
              14 días
            </button>
            <button
              className={timeRange === "30" ? "active" : ""}
              onClick={() => handleTimeRangeChange("30")}
            >
              30 días
            </button>
            <button
              className={timeRange === "90" ? "active" : ""}
              onClick={() => handleTimeRangeChange("90")}
            >
              90 días
            </button>
            <button
              className={timeRange === "all" ? "active" : ""}
              onClick={() => handleTimeRangeChange("all")}
            >
              Todo
            </button>
            <button
              className={timeRange === "custom" ? "active" : ""}
              onClick={() => handleTimeRangeChange("custom")}
            >
              <FiCalendar /> Personalizado
            </button>
          </div>

          {showCustomDateInputs && (
            <div className="custom-date-inputs">
              <div className="date-input-group">
                <label>Desde:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate || undefined}
                />
              </div>
              <div className="date-input-group">
                <label>Hasta:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate || undefined}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          )}

          <div className="export-buttons">
            <button className="btn-export-pdf" onClick={exportToPDF}>
              <FiDownload /> PDF
            </button>
            <button className="btn-export-excel" onClick={exportToExcel}>
              <FiDownload /> Excel
            </button>
          </div>
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

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#fffde7" }}>
            <FiStar size={28} color="#fbc02d" />
          </div>
          <div className="stat-content">
            <p className="stat-label">Logros Completados</p>
            <h2 className="stat-value">{stats.completedAchievements} / 20</h2>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-container">
        {/* Gráfico de Progreso con Selector de Agrupación */}
        <div className="chart-card chart-card-full">
          <div className="chart-header">
            <h3>📈 Progreso en el Tiempo</h3>
            <div className="group-by-selector">
              <label>Agrupar por:</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="group-by-select"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Año</option>
              </select>
            </div>
          </div>
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
