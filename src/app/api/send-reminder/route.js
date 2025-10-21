import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  const { userEmail, userName, streakDays } = await request.json();

  // Configura el transportador de Nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_FROM,
      pass: process.env.GMAIL_APP_PASSWORD, // Usa una Contraseña de Aplicación, no tu contraseña normal
    },
  });

  try {
    await transporter.sendMail({
      from: '"ExamFlow" <tu.email@gmail.com>',
      to: userEmail,
      subject: `¡Mantén tu racha activa! 🔥`,
      html: `<p>Hola <strong>${userName}</strong>,</p>
             <p>¡Llevas una buena racha, no la pierdas! Sigue así.</p>`,
    });
    return NextResponse.json({ status: 200, message: "Correo enviado" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      status: 500,
      error: "Error al enviar el correo",
    });
  }
}
