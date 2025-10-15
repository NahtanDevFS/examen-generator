import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { startOfDay } from "date-fns";

// --- TIPOS (Sin cambios) ---
type AttemptWithExam = {
  created_at: string;
  score_correct: number;
  score_incorrect: number;
  examenes: {
    topic: string | null;
    exam_type: string | null;
    difficulty: string | null;
    questions: any[] | null;
  } | null;
};

// --- LÓGICA DE ACTUALIZACIÓN (Simple y Clara) ---

// Función de utilidad para actualizar el progreso de un logro
async function updateAchievementProgress(
  supabase: any,
  userId: string,
  tipoLogro: string,
  progreso: number
) {
  const { data: achievement } = await supabase
    .from("logros")
    .select("id, meta_requerida")
    .eq("tipo_logro", tipoLogro)
    .single();

  if (!achievement) return;

  const { data: currentProgress } = await supabase
    .from("progreso_logros_usuario")
    .select("progreso_actual, desbloqueado_en")
    .eq("user_id", userId)
    .eq("logro_id", achievement.id)
    .single();

  if (currentProgress?.desbloqueado_en) {
    return;
  }

  const isUnlocked = progreso >= achievement.meta_requerida;

  await supabase.from("progreso_logros_usuario").upsert({
    user_id: userId,
    logro_id: achievement.id,
    progreso_actual: progreso,
    desbloqueado_en: isUnlocked ? new Date().toISOString() : null,
    visto_por_usuario: currentProgress?.desbloqueado_en ? true : !isUnlocked,
  });
}

// Lógica principal para verificar todos los logros
async function checkAchievements(supabase: any, userId: string) {
  const { data: attemptsData } = await supabase
    .from("intentos_examen")
    .select(
      "created_at, score_correct, score_incorrect, examenes ( topic, exam_type, difficulty, questions )"
    )
    .eq("user_id", userId);

  const attempts: AttemptWithExam[] = attemptsData || [];

  const { count: categoriesCount } = await supabase
    .from("categorias")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: tagsCount } = await supabase
    .from("etiquetas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (attempts.length === 0) return;

  // --- Cálculos de logros (uno por uno, para claridad) ---
  const totalExams = attempts.length;
  await updateAchievementProgress(
    supabase,
    userId,
    "PRIMER_EXAMEN",
    totalExams > 0 ? 1 : 0
  );
  await updateAchievementProgress(
    supabase,
    userId,
    "TOTAL_EXAMENES_10",
    totalExams
  );
  await updateAchievementProgress(
    supabase,
    userId,
    "TOTAL_EXAMENES_50",
    totalExams
  );
  await updateAchievementProgress(
    supabase,
    userId,
    "TOTAL_EXAMENES_100",
    totalExams
  );

  const mcqExams = attempts.filter(
    (a) => a.examenes?.exam_type === "opcion_multiple"
  ).length;
  await updateAchievementProgress(
    supabase,
    userId,
    "TIPO_OPCION_MULTIPLE",
    mcqExams > 0 ? 1 : 0
  );
  await updateAchievementProgress(
    supabase,
    userId,
    "TOTAL_TIPO_MULTIPLE_10",
    mcqExams
  );

  const tfExams = attempts.filter(
    (a) => a.examenes?.exam_type === "verdadero_falso"
  ).length;
  await updateAchievementProgress(
    supabase,
    userId,
    "TIPO_VERDADERO_FALSO",
    tfExams > 0 ? 1 : 0
  );

  const openExams = attempts.filter(
    (a) => a.examenes?.exam_type === "pregunta_abierta"
  ).length;
  await updateAchievementProgress(
    supabase,
    userId,
    "TIPO_PREGUNTA_ABIERTA",
    openExams > 0 ? 1 : 0
  );

  if (mcqExams > 0 && tfExams > 0 && openExams > 0) {
    await updateAchievementProgress(supabase, userId, "DIVERSIFICADO", 1);
  }

  const scoreOver80 = attempts.some(
    (a) => a.score_correct / (a.score_correct + a.score_incorrect) > 0.8
  );
  if (scoreOver80) {
    await updateAchievementProgress(
      supabase,
      userId,
      "PUNTUACION_SUPERIOR_80",
      1
    );
  }

  const perfectScoreExams = attempts.filter((a) => {
    const total = a.score_correct + a.score_incorrect;
    return (
      total > 0 &&
      a.score_correct / total === 1 &&
      a.examenes?.questions &&
      a.examenes.questions.length >= 10
    );
  });
  if (perfectScoreExams.length > 0) {
    await updateAchievementProgress(supabase, userId, "PUNTUACION_PERFECTA", 1);
  }
  await updateAchievementProgress(
    supabase,
    userId,
    "PUNTUACION_PERFECTA_3",
    perfectScoreExams.length
  );

  const longExam = attempts.some((a) => a.examenes?.questions?.length === 20);
  if (longExam) {
    await updateAchievementProgress(supabase, userId, "EXAMEN_LARGO_20", 1);
  }

  const advancedMastery = attempts.filter((a) => {
    const score = a.score_correct / (a.score_correct + a.score_incorrect);
    return a.examenes?.difficulty === "avanzado" && score > 0.85;
  }).length;
  await updateAchievementProgress(
    supabase,
    userId,
    "MAESTRO_AVANZADO",
    advancedMastery
  );

  const uniqueTopics = new Set(attempts.map((a) => a.examenes?.topic)).size;
  await updateAchievementProgress(
    supabase,
    userId,
    "TEMAS_DIFERENTES_5",
    uniqueTopics
  );
  await updateAchievementProgress(
    supabase,
    userId,
    "TEMAS_DIFERENTES_15",
    uniqueTopics
  );

  if (categoriesCount) {
    await updateAchievementProgress(
      supabase,
      userId,
      "PRIMERA_CATEGORIA",
      categoriesCount > 0 ? 1 : 0
    );
  }
  if (tagsCount) {
    await updateAchievementProgress(
      supabase,
      userId,
      "PRIMERA_ETIQUETA",
      tagsCount > 0 ? 1 : 0
    );
  }

  const uniqueDates = Array.from(
    new Set(attempts.map((a) => startOfDay(new Date(a.created_at)).getTime()))
  ).sort((a, b) => b - a);
  let streak = 0;
  if (uniqueDates.length > 0) {
    const today = startOfDay(new Date()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (uniqueDates[0] === today || uniqueDates[0] === today - oneDayMs) {
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i - 1] - uniqueDates[i] === oneDayMs) {
          streak++;
        } else {
          break;
        }
      }
    }
  }
  await updateAchievementProgress(supabase, userId, "RACHA_3_DIAS", streak);
  await updateAchievementProgress(supabase, userId, "RACHA_7_DIAS", streak);
}

// --- FUNCIÓN EXPORTADA (CORREGIDA Y SIMPLIFICADA) ---
export async function POST(req: NextRequest) {
  // Se crea el cliente de Supabase de la forma estándar
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Se obtiene la sesión del usuario. Este 'await' es crucial y
    // resuelve el problema de la lectura de cookies asíncrona.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Una vez que tenemos la sesión, ejecutamos la lógica de logros
    // y esperamos a que termine con 'await'.
    await checkAchievements(supabase, session.user.id);

    return NextResponse.json({
      message: "Procesamiento de logros completado.",
    });
  } catch (error) {
    console.error("Error en la ruta de logros:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
