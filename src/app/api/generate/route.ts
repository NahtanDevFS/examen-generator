import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // 1. Obtener 'topic' Y 'type' del cuerpo de la petición
    const { topic, type = "opcion_multiple" } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: "El tema no puede estar vacío" },
        { status: 400 }
      );
    }

    // --- LÓGICA DINÁMICA PARA EL PROMPT ---
    let instructions = "";
    let jsonExample = "";

    if (type === "verdadero_falso") {
      instructions = `
        Tu tarea es generar un examen de 10 preguntas de Verdadero o Falso sobre el tema: "${topic}".
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
      // Por defecto, es 'opcion_multiple'
      instructions = `
        Tu tarea es generar un examen de 10 preguntas de opción múltiple sobre el tema: "${topic}".
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

    // 2. Construir el prompt maestro final
    const prompt = `
      Actúa como un experto creador de exámenes.
      ${instructions}
      IMPORTANTE: Devuelve el resultado EXCLUSIVAMENTE en formato JSON, sin texto introductorio, explicaciones o acentos graves de markdown.
      El JSON debe ser un array de objetos. Cada objeto debe tener la siguiente estructura:
      ${jsonExample}
      Genera el examen completo ahora.
    `;

    // 3. Llamar a la IA (sin cambios)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Limpiar y parsear la respuesta (sin cambios)
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
