import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  const { userEmail, userName, streakDays } = await request.json();

  // Configura el transportador de Nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_FROM,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  // Determinar el mensaje según la racha
  const streakMessage =
    streakDays === 0
      ? "¡Empieza tu racha hoy! Completa un examen y comienza tu progreso."
      : `¡Increíble! Llevas <strong>${streakDays} ${
          streakDays === 1 ? "día" : "días"
        }</strong> de racha. No dejes que se rompa.`;

  const emailSubject =
    streakDays === 0
      ? "¡Empieza tu racha en ExamFlow! 📚"
      : `¡Mantén tu racha de ${streakDays} ${
          streakDays === 1 ? "día" : "días"
        }! 🔥`;

  try {
    await transporter.sendMail({
      from: '"ExamFlow" <tu.email@gmail.com>',
      to: userEmail,
      subject: emailSubject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    background-color: #f4f4f4; 
                    margin: 0; 
                    padding: 20px; 
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white; 
                    padding: 30px; 
                    border-radius: 10px; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header { 
                    color: #667eea; 
                    text-align: center; 
                    margin-bottom: 20px; 
                }
                .streak-count {
                    text-align: center; 
                    font-size: 48px; 
                    font-weight: bold; 
                    color: #f59e0b; 
                    margin: 20px 0;
                }
                .button { 
                    display: inline-block; 
                    background: ${streakDays === 0 ? "#007bff" : "#28a745"}; 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    font-size: 16px;
                    font-weight: bold;
                    margin: 20px 0;
                }
                .center { 
                    text-align: center; 
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="header">
                    ${
                      streakDays === 0
                        ? "🎯 ¡Empieza tu racha hoy!"
                        : "🔥 ¡Recuerda completar tu racha de hoy!"
                    }
                </h1>
                
                <p>Hola <strong>${userName}</strong>,</p>
                <p>${streakMessage}</p>
                
                <div class="center">
                    <a href="https://examen-generator.vercel.app" class="button">
                        ${
                          streakDays === 0
                            ? "Comenzar a Practicar"
                            : "Continuar Practicando"
                        }
                    </a>
                </div>
                
                <p>Con ExamFlow puedes:</p>
                <ul>
                    <li>Practicar con exámenes personalizados</li>
                    <li>Seguir tu progreso diario</li>
                    <li>Mejorar tus conocimientos</li>
                </ul>
                
                <div class="footer">
                    <p>ExamFlow - Tu compañero de estudio</p>
                </div>
            </div>
        </body>
        </html>
      `,
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
