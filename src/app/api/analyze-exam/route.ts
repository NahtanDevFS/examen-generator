// src/app/api/analyze-exam/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Asegúrate de tener tu API key en las variables de entorno
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { attempt, prompt } = await req.json();

    if (!attempt || !prompt) {
      return new Response("Faltan datos del examen o el prompt.", {
        status: 400,
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Formateamos los datos del examen para que la IA los entienda mejor
    const examDataString = `
      Examen sobre: ${attempt.examenes.topic}
      Resultado: ${attempt.score_correct} correctas, ${
      attempt.score_incorrect
    } incorrectas.
      
      Preguntas y respuestas del usuario:
      ${attempt.examenes.questions
        .map(
          (q: any, index: number) => `
        Pregunta ${index + 1}: ${q.question}
        Respuesta Correcta: ${q.answer}
        Respuesta del Usuario: ${attempt.user_answers[index] || "No respondió"}
      `
        )
        .join("\n")}
    `;

    const fullPrompt = `
      Eres un tutor experto y amigable. Un estudiante te ha pedido analizar su examen.
      Aquí están los datos del examen:
      ${examDataString}

      La solicitud del estudiante es: "${prompt}"

      Por favor, proporciona una respuesta clara, útil y alentadora.
      Utiliza markdown para formatear tu respuesta (negritas, listas, etc.).
    `;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const analysis = response.text();

    return new Response(JSON.stringify({ analysis }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en la API de análisis:", error);
    return new Response("Error al procesar la solicitud.", { status: 500 });
  }
}
