import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as auth from "./auth.js";
import * as horarios from "./horarios.js";
import * as historico from "./historico.js";
import db from "./database.js";

const app = express();

app.use(cors());
app.use(express.json());

// Middleware para verificar autenticação
function verificarAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const usuario = auth.validarSessao(token);
  if (!usuario) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  req.usuario = usuario;
  req.token = token;
  next();
}

// Limpa sessões expiradas a cada hora
setInterval(() => {
  auth.limparSessoesExpiradas();
}, 60 * 60 * 1000);

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

// ---------- Endpoints de Autenticação ----------

// Cadastrar novo usuário
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, nome, senha, perfil, pin } = req.body;

    if (!email || !nome || !senha || !perfil) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    // Validação de PIN para perfis administrativos (opcional)
    if (perfil === "direcao" || perfil === "vice_direcao") {
      if (pin) {
        const PIN_DIRECAO = "1234";
        const PIN_VICE_DIRECAO = "5678";
        const pinCorreto = perfil === "direcao" ? PIN_DIRECAO : PIN_VICE_DIRECAO;
        if (pin !== pinCorreto) {
          return res.status(400).json({ error: "PIN incorreto" });
        }
      }
    }

    const usuario = auth.cadastrarUsuario(email, nome, senha, perfil);
    res.status(201).json({ ok: true, usuario });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fazer login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, senha, pin } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const resultado = auth.fazerLogin(email, senha);

    // Validação de PIN para perfis administrativos (opcional)
    if (pin && (resultado.usuario.perfil === "direcao" || resultado.usuario.perfil === "vice_direcao")) {
      const PIN_DIRECAO = "1234";
      const PIN_VICE_DIRECAO = "5678";
      const pinCorreto = resultado.usuario.perfil === "direcao" ? PIN_DIRECAO : PIN_VICE_DIRECAO;
      if (pin !== pinCorreto) {
        auth.fazerLogout(resultado.token);
        return res.status(400).json({ error: "PIN incorreto" });
      }
    }

    res.json(resultado);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Verificar sessão atual
app.get("/api/auth/me", verificarAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});

// Fazer logout
app.post("/api/auth/logout", verificarAuth, (req, res) => {
  auth.fazerLogout(req.token);
  res.json({ ok: true });
});

// ---------- Endpoints de Horários ----------

// Buscar todos os horários
app.get("/api/horarios", verificarAuth, (req, res) => {
  try {
    const todosHorarios = horarios.buscarTodosHorarios();
    const formatado = horarios.formatarHorariosParaFrontend(todosHorarios);
    res.json(formatado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar horários de um grupo específico
app.get("/api/horarios/:grupoId", verificarAuth, (req, res) => {
  try {
    const { grupoId } = req.params;
    const horariosGrupo = horarios.buscarHorariosPorGrupo(grupoId);
    const formatado = horarios.formatarHorariosParaFrontend(horariosGrupo);
    res.json(formatado[grupoId] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar horário
app.post("/api/horarios", verificarAuth, (req, res) => {
  try {
    const { grupoId, dia, slotId, disciplina, professor, turma } = req.body;

    if (!grupoId || !dia || slotId === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const resultado = horarios.salvarHorario(
      grupoId,
      dia,
      slotId,
      disciplina,
      professor,
      turma,
      req.usuario.id
    );

    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpar horário
app.delete("/api/horarios", verificarAuth, (req, res) => {
  try {
    const { grupoId, dia, slotId } = req.body;

    if (!grupoId || !dia || slotId === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    horarios.limparHorario(grupoId, dia, slotId, req.usuario.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpar grupo inteiro
app.delete("/api/horarios/grupo/:grupoId", verificarAuth, (req, res) => {
  try {
    const { grupoId } = req.params;
    horarios.limparGrupo(grupoId, req.usuario.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Endpoints de Histórico ----------

// Buscar histórico de alterações
app.get("/api/historico", verificarAuth, (req, res) => {
  try {
    const {
      grupoId,
      dia,
      usuarioId,
      tipoAlteracao,
      dataInicio,
      dataFim,
      limite,
    } = req.query;

    const filtros = {};
    if (grupoId) filtros.grupoId = grupoId;
    if (dia) filtros.dia = dia;
    if (usuarioId) filtros.usuarioId = parseInt(usuarioId);
    if (tipoAlteracao) filtros.tipoAlteracao = tipoAlteracao;
    if (dataInicio) filtros.dataInicio = dataInicio;
    if (dataFim) filtros.dataFim = dataFim;
    if (limite) filtros.limite = parseInt(limite);

    const historicoData = historico.buscarHistorico(filtros);
    res.json(historicoData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar histórico de um horário específico
app.get("/api/historico/horario/:grupoId/:dia/:slotId", verificarAuth, (req, res) => {
  try {
    const { grupoId, dia, slotId } = req.params;
    const historicoData = historico.buscarHistoricoHorario(
      grupoId,
      dia,
      parseInt(slotId)
    );
    res.json(historicoData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar estatísticas do histórico
app.get("/api/historico/estatisticas", verificarAuth, (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const filtros = {};
    if (dataInicio) filtros.dataInicio = dataInicio;
    if (dataFim) filtros.dataFim = dataFim;

    const estatisticas = historico.buscarEstatisticasHistorico(filtros);
    res.json(estatisticas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Endpoints de Snapshots ----------

// Criar snapshot
app.post("/api/snapshots", verificarAuth, (req, res) => {
  try {
    const { nome, descricao, dados } = req.body;

    if (!nome || !dados) {
      return res.status(400).json({ error: "Nome e dados são obrigatórios" });
    }

    const snapshot = historico.criarSnapshot(
      nome,
      descricao,
      dados,
      req.usuario.id
    );
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar snapshots
app.get("/api/snapshots", verificarAuth, (req, res) => {
  try {
    const limite = req.query.limite ? parseInt(req.query.limite) : 50;
    const snapshots = historico.buscarSnapshots(limite);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar snapshot específico
app.get("/api/snapshots/:id", verificarAuth, (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = historico.buscarSnapshot(parseInt(id));
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot não encontrado" });
    }
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar snapshot
app.delete("/api/snapshots/:id", verificarAuth, (req, res) => {
  try {
    const { id } = req.params;
    historico.deletarSnapshot(parseInt(id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
