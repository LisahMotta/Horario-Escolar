import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Estrutura do log, compatível com o frontend:
 * {
 *   timestamp: string;
 *   usuario: string | null;
 *   acao: string;
 *   detalhes: string;
 * }
 */

/** @type {Array<{ timestamp: string; usuario: string | null; acao: string; detalhes: string }>} */
let logs = [];

// Retorna todos os logs (ou últimos N no futuro, se quiser otimizar)
app.get("/api/logs", (req, res) => {
  res.json(logs);
});

// Adiciona um novo registro ao log
app.post("/api/logs", (req, res) => {
  const { timestamp, usuario, acao, detalhes } = req.body || {};

  if (!timestamp || !acao) {
    return res
      .status(400)
      .json({ error: "Campos obrigatórios: timestamp e acao." });
  }

  const entry = {
    timestamp,
    usuario: usuario ?? null,
    acao: String(acao),
    detalhes: detalhes ? String(detalhes) : "",
  };

  logs.push(entry);

  res.status(201).json({ ok: true });
});

// ---------- Servir o frontend buildado (Vite) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "..", "dist");

// Arquivos estáticos gerados pelo Vite
app.use(express.static(distPath));

// Para qualquer rota que não seja /api, devolve o index.html (SPA)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor rodando na porta ${PORT}`);
});
