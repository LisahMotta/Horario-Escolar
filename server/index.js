import express from "express";
import cors from "cors";

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor de logs rodando na porta ${PORT}`);
});


