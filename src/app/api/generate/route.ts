// src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const {
      topic,
      type = "opcion_multiple",
      difficulty = "principiante",
      count = 10,
      sourceText,
    } = await req.json();

    if (!topic && !sourceText) {
      return NextResponse.json(
        { error: "Debes proporcionar un tema o texto base" },
        { status: 400 }
      );
    }

    let instructions = "";
    let jsonExample = "";
    let baseContext = "";

    // Si hay texto fuente, lo incluimos en el contexto
    if (sourceText) {
      baseContext = `\nGenera las preguntas basándote EXCLUSIVAMENTE en el siguiente texto:\n\n"${sourceText}"\n\n`;
    }

    if (type === "verdadero_falso") {
      instructions = `
        ${baseContext}
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
    } else if (type === "pregunta_abierta") {
      instructions = `
        ${baseContext}
        Tu tarea es generar un examen de ${count} preguntas abiertas sobre el tema: "${topic}", con un nivel de dificultad "${difficulty}".
        Cada pregunta debe requerir una respuesta escrita elaborada por el estudiante.
        Debes proporcionar una respuesta modelo ideal para cada pregunta.
        Las preguntas abiertas NO tienen options, solo question y answer.
      `;
      jsonExample = `
        {
          "question": "Explica el proceso de fotosíntesis en las plantas.",
          "answer": "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar, agua y dióxido de carbono en glucosa y oxígeno. Este proceso ocurre principalmente en los cloroplastos de las células vegetales, donde la clorofila captura la energía lumínica."
        }
      `;
    } else {
      // opcion_multiple
      instructions = `
        ${baseContext}
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
