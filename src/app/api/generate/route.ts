import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa el cliente de Gemini AI con tu clave de API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // 1. Obtiene el 'topic' del cuerpo de la petición que enviará el frontend
    const { topic } = await req.json();

    // ¡Validación simple para asegurarnos de que el tema no esté vacío!
    if (!topic) {
      return NextResponse.json(
        { error: "El tema no puede estar vacío" },
        { status: 400 }
      );
    }

    // 2. EL PROMPT MAESTRO: Aquí le damos las instrucciones a la IA.
    // Este es el paso más importante para obtener un resultado consistente.
    const prompt = `
      Actúa como un experto creador de exámenes.
      Tu tarea es generar un examen de opción múltiple sobre el tema: "${topic}".
      El examen debe tener 10 preguntas.
      Cada pregunta debe tener 4 opciones.
      Una (y solo una) de las opciones debe ser la correcta.

      IMPORTANTE: Devuelve el resultado EXCLUSIVAMENTE en formato JSON, sin texto introductorio, explicaciones o acentos graves de markdown.
      El JSON debe ser un array de objetos. Cada objeto debe tener la siguiente estructura:
      {
        "question": "texto de la pregunta",
        "options": ["opción 1", "opción 2", "opción 3", "opción 4"],
        "answer": "la respuesta correcta que debe coincidir exactamente con una de las opciones"
      }

      Aquí tienes un ejemplo de la estructura esperada para una pregunta sobre "Historia":
      {
        "question": "¿En qué año cayó el Imperio Romano de Occidente?",
        "options": ["476 d.C.", "1453 d.C.", "753 a.C.", "1204 d.C."],
        "answer": "476 d.C."
      }

      Genera el examen completo ahora.
    `;

    // 3. Llama a la API de Gemini para generar el contenido
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Limpia y parsea la respuesta para asegurar que es un JSON válido
    // A veces la IA puede devolver el JSON dentro de un bloque de código markdown ```json ... ```
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "");
    const jsonResponse = JSON.parse(cleanedText);

    // 5. Devuelve el JSON con las preguntas al frontend
    return NextResponse.json(jsonResponse);
  } catch (error) {
    // Manejo de errores
    console.error(error);
    return NextResponse.json(
      { error: "Hubo un problema al generar el examen" },
      { status: 500 }
    );
  }
}
