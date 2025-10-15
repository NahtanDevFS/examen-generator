import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { startOfDay } from "date-fns";

// --- TIPOS ---
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

// --- FUNCIÓN DE UTILIDAD ---
async function updateAchievementProgress(
  supabase: any,
  userId: string,
  tipoLogro: string,
  progreso: number
) {
  console.log(`🔍 Verificando logro: ${tipoLogro}, progreso: ${progreso}`);

  const { data: achievement, error: achievementError } = await supabase
    .from("logros")
    .select("id, meta_requerida")
    .eq("tipo_logro", tipoLogro)
    .single();

  if (achievementError) {
    console.error(`❌ Error al buscar logro ${tipoLogro}:`, achievementError);
    return;
  }

  if (!achievement) {
    console.warn(`⚠️ No se encontró el logro: ${tipoLogro}`);
    return;
  }

  console.log(
    `✅ Logro encontrado: ${tipoLogro}, meta: ${achievement.meta_requerida}`
  );

  const { data: currentProgress, error: progressError } = await supabase
    .from("progreso_logros_usuario")
    .select("progreso_actual, desbloqueado_en")
    .eq("user_id", userId)
    .eq("logro_id", achievement.id)
    .single();

  if (progressError && progressError.code !== "PGRST116") {
    console.error(
      `❌ Error al buscar progreso de ${tipoLogro}:`,
      progressError
    );
  }

  if (currentProgress?.desbloqueado_en) {
    console.log(`⏭️ Logro ${tipoLogro} ya desbloqueado, saltando...`);
    return;
  }

  const isUnlocked = progreso >= achievement.meta_requerida;

  console.log(
    `📊 ${tipoLogro}: progreso=${progreso}, meta=${achievement.meta_requerida}, desbloqueado=${isUnlocked}`
  );

  const { error: upsertError } = await supabase
    .from("progreso_logros_usuario")
    .upsert(
      {
        user_id: userId,
        logro_id: achievement.id,
        progreso_actual: progreso,
        desbloqueado_en: isUnlocked ? new Date().toISOString() : null,
        visto_por_usuario: false, // ← Cambiado: siempre false para nuevos logros
      },
      {
        onConflict: "user_id,logro_id", // ← Especificamos la constraint
      }
    );

  if (upsertError) {
    console.error(
      `❌ Error al actualizar progreso de ${tipoLogro}:`,
      upsertError
    );
  } else {
    console.log(
      `✨ ${
        isUnlocked ? "🎉 LOGRO DESBLOQUEADO" : "📈 Progreso actualizado"
      }: ${tipoLogro}`
    );
  }
}

// --- LÓGICA PRINCIPAL ---
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

  // --- Cálculos de logros ---
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

// --- FUNCIÓN EXPORTADA (USANDO @supabase/ssr) ---
export async function POST(req: NextRequest) {
  try {
    // ✅ CRÍTICO: Awaiteamos cookies() en Next.js 15+
    const cookieStore = await cookies();

    // Creamos el cliente usando @supabase/ssr (método moderno)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // En Route Handlers, setAll puede fallar si se llama después de la respuesta
            }
          },
        },
      }
    );

    // Obtenemos la sesión
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Ejecutamos la lógica de logros
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
