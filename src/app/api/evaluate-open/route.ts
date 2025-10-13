// src/app/api/evaluate-open/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { question, userAnswer, correctAnswer, topic } = await req.json();

    if (!question || !userAnswer || !correctAnswer) {
      return NextResponse.json(
        { error: "Faltan datos necesarios" },
        { status: 400 }
      );
    }

    const prompt = `
      Actúa como un profesor experto evaluando una respuesta abierta.
      
      Tema: ${topic || "General"}
      Pregunta: ${question}
      Respuesta modelo (ideal): ${correctAnswer}
      Respuesta del estudiante: ${userAnswer}
      
      Evalúa la respuesta del estudiante según estos criterios:
      1. Exactitud del contenido (0-40 puntos)
      2. Comprensión del concepto (0-30 puntos)
      3. Claridad y coherencia (0-20 puntos)
      4. Completitud de la respuesta (0-10 puntos)
      
      Proporciona tu evaluación en el siguiente formato JSON:
      {
        "score": [número entre 0-100],
        "feedback": "[retroalimentación constructiva de máximo 200 palabras]",
        "strengths": "[aspectos positivos de la respuesta]",
        "improvements": "[sugerencias de mejora]"
      }
      
      IMPORTANTE: Devuelve ÚNICAMENTE el JSON, sin texto adicional.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const evaluation = JSON.parse(cleanedText);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo evaluar la respuesta" },
      { status: 500 }
    );
  }
}
