import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as auth from "./auth.js";
import * as horarios from "./horarios.js";
import * as historico from "./historico.js";
import pool from "./database.js";

const app = express();

app.use(cors());
app.use(express.json());

// Middleware para verificar autenticação
async function verificarAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const usuario = await auth.validarSessao(token);
    if (!usuario) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    req.usuario = usuario;
    req.token = token;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Middleware para exigir perfil de Direção ou Vice-direção (gestor).
// Use sempre depois de verificarAuth, que popula req.usuario.
function exigirGestor(req, res, next) {
  if (!auth.podeEditarHorarios(req.usuario.perfil)) {
    return res
      .status(403)
      .json({ error: "Apenas Direção ou Vice-direção podem realizar esta ação." });
  }
  next();
}

// Limpa sessões expiradas a cada hora (só relevante quando o processo fica
// de pé, como em "npm run server"; em funções serverless cada invocação é
// curta e isso não chega a rodar, o que não é um problema pois a checagem
// de expiração já acontece em validarSessao a cada requisição).
setInterval(() => {
  auth.limparSessoesExpiradas().catch((error) => {
    console.error("Erro ao limpar sessões expiradas:", error);
  });
}, 60 * 60 * 1000);

// ---------- Log de atividade (best-effort, complementa o log local) ----------

app.get("/api/logs", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT timestamp, usuario, acao, detalhes FROM logs_atividade ORDER BY id ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/logs", async (req, res) => {
  try {
    const { timestamp, usuario, acao, detalhes } = req.body || {};

    if (!timestamp || !acao) {
      return res
        .status(400)
        .json({ error: "Campos obrigatórios: timestamp e acao." });
    }

    await pool.query(
      "INSERT INTO logs_atividade (timestamp, usuario, acao, detalhes) VALUES ($1, $2, $3, $4)",
      [timestamp, usuario ?? null, String(acao), detalhes ? String(detalhes) : ""]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Endpoints de Autenticação ----------

// Cadastrar novo usuário — apenas Direção/Vice-direção podem cadastrar
// outros usuários (coordenação, GOE, AOE, professores). Não existe mais
// cadastro público: a primeira conta de Direção é criada automaticamente
// (veja server/database.js).
app.post("/api/auth/register", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { email, nome, senha, perfil } = req.body;

    if (!email || !nome || !senha || !perfil) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const usuario = await auth.cadastrarUsuario(email, nome, senha, perfil);
    res.status(201).json({ ok: true, usuario });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Listar usuários cadastrados
app.get("/api/auth/usuarios", verificarAuth, exigirGestor, async (req, res) => {
  try {
    res.json(await auth.listarUsuarios());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover usuário cadastrado
app.delete("/api/auth/usuarios/:id", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.usuario.id) {
      return res
        .status(400)
        .json({ error: "Você não pode remover sua própria conta." });
    }
    await auth.removerUsuario(id);
    res.json({ ok: true });
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

    const resultado = await auth.fazerLogin(email, senha);

    // Validação de PIN para perfis administrativos (opcional)
    if (pin && (resultado.usuario.perfil === "direcao" || resultado.usuario.perfil === "vice_direcao")) {
      const PIN_DIRECAO = "1234";
      const PIN_VICE_DIRECAO = "5678";
      const pinCorreto = resultado.usuario.perfil === "direcao" ? PIN_DIRECAO : PIN_VICE_DIRECAO;
      if (pin !== pinCorreto) {
        await auth.fazerLogout(resultado.token);
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
app.post("/api/auth/logout", verificarAuth, async (req, res) => {
  await auth.fazerLogout(req.token);
  res.json({ ok: true });
});

// ---------- Endpoints de Horários ----------

// Buscar todos os horários
app.get("/api/horarios", verificarAuth, async (req, res) => {
  try {
    const todosHorarios = await horarios.buscarTodosHorarios();
    const formatado = horarios.formatarHorariosParaFrontend(todosHorarios);
    res.json(formatado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar horários de um grupo específico
app.get("/api/horarios/:grupoId", verificarAuth, async (req, res) => {
  try {
    const { grupoId } = req.params;
    const horariosGrupo = await horarios.buscarHorariosPorGrupo(grupoId);
    const formatado = horarios.formatarHorariosParaFrontend(horariosGrupo);
    res.json(formatado[grupoId] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar horário
app.post("/api/horarios", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { grupoId, dia, slotId, disciplina, professor, turma } = req.body;

    if (!grupoId || !dia || slotId === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const resultado = await horarios.salvarHorario(
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
app.delete("/api/horarios", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { grupoId, dia, slotId } = req.body;

    if (!grupoId || !dia || slotId === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    await horarios.limparHorario(grupoId, dia, slotId, req.usuario.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpar grupo inteiro
app.delete("/api/horarios/grupo/:grupoId", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { grupoId } = req.params;
    await horarios.limparGrupo(grupoId, req.usuario.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Endpoints de Histórico ----------

// Buscar histórico de alterações
app.get("/api/historico", verificarAuth, async (req, res) => {
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

    const historicoData = await historico.buscarHistorico(filtros);
    res.json(historicoData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar histórico de um horário específico
app.get("/api/historico/horario/:grupoId/:dia/:slotId", verificarAuth, async (req, res) => {
  try {
    const { grupoId, dia, slotId } = req.params;
    const historicoData = await historico.buscarHistoricoHorario(
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
app.get("/api/historico/estatisticas", verificarAuth, async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const filtros = {};
    if (dataInicio) filtros.dataInicio = dataInicio;
    if (dataFim) filtros.dataFim = dataFim;

    const estatisticas = await historico.buscarEstatisticasHistorico(filtros);
    res.json(estatisticas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Endpoints de Snapshots ----------

// Criar snapshot
app.post("/api/snapshots", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { nome, descricao, dados } = req.body;

    if (!nome || !dados) {
      return res.status(400).json({ error: "Nome e dados são obrigatórios" });
    }

    const snapshot = await historico.criarSnapshot(
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
app.get("/api/snapshots", verificarAuth, async (req, res) => {
  try {
    const limite = req.query.limite ? parseInt(req.query.limite) : 50;
    const snapshots = await historico.buscarSnapshots(limite);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar snapshot específico
app.get("/api/snapshots/:id", verificarAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await historico.buscarSnapshot(parseInt(id));
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot não encontrado" });
    }
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar snapshot
app.delete("/api/snapshots/:id", verificarAuth, exigirGestor, async (req, res) => {
  try {
    const { id } = req.params;
    await historico.deletarSnapshot(parseInt(id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Servir o frontend buildado (Vite) ----------
// Só é usado localmente (npm run server / npm run dev:full). Na Vercel, o
// frontend é servido diretamente como arquivo estático e apenas as rotas
// /api/* chegam até esta função — este bloco nunca chega a ser executado lá.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "..", "dist");

app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
