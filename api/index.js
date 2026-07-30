// Função serverless da Vercel. O vercel.json reescreve todas as chamadas
// "/api/*" para cá, e o Express (server/app.js) cuida do roteamento
// interno normalmente (ex: /api/auth/login, /api/horarios, etc.).
import app from "../server/app.js";

export default app;
