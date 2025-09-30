import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // 1. Obtener todos los parámetros del cuerpo de la petición
    const {
      topic,
      type = "opcion_multiple",
      difficulty = "principiante", // <-- NUEVO
      count = 10, // <-- NUEVO
    } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: "El tema no puede estar vacío" },
        { status: 400 }
      );
    }

    let instructions = "";
    let jsonExample = "";

    if (type === "verdadero_falso") {
      instructions = `
        Tu tarea es generar un examen de ${count} preguntas de Verdadero o Falso sobre el tema: "${topic}", con un nivel de dificultad "${difficulty}".
        Cada pregunta debe ser una afirmación clara que pueda ser evaluada como verdadera o falsa.
        Las opciones deben ser siempre y únicamente ["Verdadero", "Falso"].
        La respuesta correcta debe ser "Verdadero" o "Falso".
      `;
      jsonExample = `
        {
          "question": "El sol es una estrella.",
          "options": ["Verdadero", "Falso"],
          "answer": "Verdadero"
        }
      `;
    } else {
      // opcion_multiple
      instructions = `
        Tu tarea es generar un examen de ${count} preguntas de opción múltiple sobre el tema: "${topic}", con un nivel de dificultad "${difficulty}".
        Cada pregunta debe tener 4 opciones.
        Una (y solo una) de las opciones debe ser la correcta.
      `;
      jsonExample = `
        {
          "question": "¿Cuál es la capital de Francia?",
          "options": ["Berlín", "Madrid", "París", "Roma"],
          "answer": "París"
        }
      `;
    }

    const prompt = `
      Actúa como un experto creador de exámenes.
      ${instructions}
      IMPORTANTE: Devuelve el resultado EXCLUSIVAMENTE en formato JSON, sin texto introductorio, explicaciones o acentos graves de markdown.
      El JSON debe ser un array de objetos. Cada objeto debe tener la siguiente estructura:
      ${jsonExample}
      Genera el examen completo ahora.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Usamos el modelo estable
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "");
    const jsonResponse = JSON.parse(cleanedText);

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Hubo un problema al generar el examen" },
      { status: 500 }
    );
  }
}
