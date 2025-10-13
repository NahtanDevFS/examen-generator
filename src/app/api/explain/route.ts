// src/app/api/explain/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { question, options, correctAnswer, userAnswer, topic } =
      await req.json();

    if (!question || !correctAnswer) {
      return NextResponse.json(
        { error: "Faltan datos necesarios" },
        { status: 400 }
      );
    }

    const prompt = `
      Actúa como un profesor experto en ${topic || "educación"}.
      
      Pregunta: ${question}
      ${options ? `Opciones: ${options.join(", ")}` : ""}
      Respuesta correcta: ${correctAnswer}
      ${userAnswer ? `Respuesta del estudiante: ${userAnswer}` : ""}
      
      Proporciona una explicación clara, educativa y detallada de:
      1. Por qué la respuesta correcta es "${correctAnswer}"
      2. ${
        userAnswer && userAnswer !== correctAnswer
          ? `Por qué la respuesta "${userAnswer}" es incorrecta`
          : ""
      }
      3. ${options ? `Por qué las demás opciones son incorrectas` : ""}
      4. Conceptos clave relacionados que el estudiante debe entender
      
      Tu respuesta debe ser clara, motivadora y educativa. Usa un tono amigable y pedagógico.
      Limita tu respuesta a máximo 300 palabras.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text();

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo generar la explicación" },
      { status: 500 }
    );
  }
}
