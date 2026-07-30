// Ponto de entrada usado apenas em desenvolvimento local / hospedagem
// tradicional (ex: "npm run server"). Na Vercel, api/index.js importa o
// app do server/app.js diretamente, sem chamar listen().
import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor rodando na porta ${PORT}`);
});
