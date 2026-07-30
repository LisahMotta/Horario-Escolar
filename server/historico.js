import pool, { toPg } from "./database.js";

// Registra uma alteração no histórico
export async function registrarAlteracao({
  tipoAlteracao,
  tabela,
  registroId,
  grupoId,
  dia,
  slotId,
  campoAlterado,
  valorAnterior,
  valorNovo,
  usuarioId,
  detalhes,
}) {
  const timestamp = new Date().toISOString();

  await pool.query(
    `INSERT INTO historico_alteracoes
     (tipo_alteracao, tabela, registro_id, grupo_id, dia, slot_id,
      campo_alterado, valor_anterior, valor_novo, usuario_id, timestamp, detalhes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      tipoAlteracao,
      tabela,
      registroId || null,
      grupoId || null,
      dia || null,
      slotId || null,
      campoAlterado || null,
      valorAnterior ? JSON.stringify(valorAnterior) : null,
      valorNovo ? JSON.stringify(valorNovo) : null,
      usuarioId,
      timestamp,
      detalhes || null,
    ]
  );
}

// Buscar histórico de alterações
export async function buscarHistorico(filtros = {}) {
  let query = `
    SELECT h.*, u.nome as usuario_nome, u.perfil as usuario_perfil
    FROM historico_alteracoes h
    JOIN usuarios u ON h.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filtros.grupoId) {
    query += " AND h.grupo_id = ?";
    params.push(filtros.grupoId);
  }

  if (filtros.dia) {
    query += " AND h.dia = ?";
    params.push(filtros.dia);
  }

  if (filtros.usuarioId) {
    query += " AND h.usuario_id = ?";
    params.push(filtros.usuarioId);
  }

  if (filtros.tipoAlteracao) {
    query += " AND h.tipo_alteracao = ?";
    params.push(filtros.tipoAlteracao);
  }

  if (filtros.slotId !== undefined) {
    query += " AND h.slot_id = ?";
    params.push(filtros.slotId);
  }

  if (filtros.dataInicio) {
    query += " AND h.timestamp >= ?";
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += " AND h.timestamp <= ?";
    params.push(filtros.dataFim);
  }

  query += " ORDER BY h.timestamp DESC";

  if (filtros.limite) {
    query += " LIMIT ?";
    params.push(filtros.limite);
  }

  const { rows } = await pool.query(toPg(query), params);

  return rows.map((h) => ({
    id: h.id,
    tipoAlteracao: h.tipo_alteracao,
    tabela: h.tabela,
    registroId: h.registro_id,
    grupoId: h.grupo_id,
    dia: h.dia,
    slotId: h.slot_id,
    campoAlterado: h.campo_alterado,
    valorAnterior: h.valor_anterior ? JSON.parse(h.valor_anterior) : null,
    valorNovo: h.valor_novo ? JSON.parse(h.valor_novo) : null,
    usuario: {
      id: h.usuario_id,
      nome: h.usuario_nome,
      perfil: h.usuario_perfil,
    },
    timestamp: h.timestamp,
    detalhes: h.detalhes,
  }));
}

// Buscar histórico de um horário específico
export async function buscarHistoricoHorario(grupoId, dia, slotId) {
  return buscarHistorico({ grupoId, dia, slotId });
}

// Buscar estatísticas do histórico
export async function buscarEstatisticasHistorico(filtros = {}) {
  let query = `
    SELECT
      COUNT(*)::int as total_alteracoes,
      COUNT(DISTINCT h.usuario_id)::int as total_usuarios,
      COUNT(DISTINCT h.grupo_id)::int as total_grupos,
      MIN(h.timestamp) as primeira_alteracao,
      MAX(h.timestamp) as ultima_alteracao
    FROM historico_alteracoes h
    WHERE 1=1
  `;
  const params = [];

  if (filtros.dataInicio) {
    query += " AND h.timestamp >= ?";
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += " AND h.timestamp <= ?";
    params.push(filtros.dataFim);
  }

  const { rows: statsRows } = await pool.query(toPg(query), params);
  const stats = statsRows[0];

  // Alterações por tipo
  let queryTipos = `
    SELECT tipo_alteracao, COUNT(*)::int as quantidade
    FROM historico_alteracoes
    WHERE 1=1
  `;
  const paramsTipos = [];

  if (filtros.dataInicio) {
    queryTipos += " AND timestamp >= ?";
    paramsTipos.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    queryTipos += " AND timestamp <= ?";
    paramsTipos.push(filtros.dataFim);
  }

  queryTipos += " GROUP BY tipo_alteracao";

  const { rows: tipos } = await pool.query(toPg(queryTipos), paramsTipos);

  // Alterações por usuário
  let queryUsuarios = `
    SELECT u.nome, u.perfil, COUNT(*)::int as quantidade
    FROM historico_alteracoes h
    JOIN usuarios u ON h.usuario_id = u.id
    WHERE 1=1
  `;
  const paramsUsuarios = [];

  if (filtros.dataInicio) {
    queryUsuarios += " AND h.timestamp >= ?";
    paramsUsuarios.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    queryUsuarios += " AND h.timestamp <= ?";
    paramsUsuarios.push(filtros.dataFim);
  }

  queryUsuarios += " GROUP BY h.usuario_id, u.nome, u.perfil ORDER BY quantidade DESC LIMIT 10";

  const { rows: usuarios } = await pool.query(toPg(queryUsuarios), paramsUsuarios);

  return {
    totalAlteracoes: stats.total_alteracoes || 0,
    totalUsuarios: stats.total_usuarios || 0,
    totalGrupos: stats.total_grupos || 0,
    primeiraAlteracao: stats.primeira_alteracao,
    ultimaAlteracao: stats.ultima_alteracao,
    porTipo: tipos.map((t) => ({
      tipo: t.tipo_alteracao,
      quantidade: t.quantidade,
    })),
    porUsuario: usuarios.map((u) => ({
      nome: u.nome,
      perfil: u.perfil,
      quantidade: u.quantidade,
    })),
  };
}

// Criar snapshot (versão completa)
export async function criarSnapshot(nome, descricao, dados, usuarioId) {
  const timestamp = new Date().toISOString();

  const { rows } = await pool.query(
    `INSERT INTO snapshots (nome, descricao, dados, usuario_id, criado_em)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nome, descricao || null, JSON.stringify(dados), usuarioId, timestamp]
  );

  return {
    id: rows[0].id,
    nome,
    descricao,
    criadoEm: timestamp,
  };
}

// Buscar snapshots
export async function buscarSnapshots(limite = 50) {
  const { rows } = await pool.query(
    `SELECT s.*, u.nome as usuario_nome, u.perfil as usuario_perfil
     FROM snapshots s
     JOIN usuarios u ON s.usuario_id = u.id
     ORDER BY s.criado_em DESC
     LIMIT $1`,
    [limite]
  );

  return rows.map((s) => ({
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    dados: JSON.parse(s.dados),
    usuario: {
      id: s.usuario_id,
      nome: s.usuario_nome,
      perfil: s.usuario_perfil,
    },
    criadoEm: s.criado_em,
  }));
}

// Buscar snapshot específico
export async function buscarSnapshot(id) {
  const { rows } = await pool.query(
    `SELECT s.*, u.nome as usuario_nome, u.perfil as usuario_perfil
     FROM snapshots s
     JOIN usuarios u ON s.usuario_id = u.id
     WHERE s.id = $1`,
    [id]
  );
  const snapshot = rows[0];

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    nome: snapshot.nome,
    descricao: snapshot.descricao,
    dados: JSON.parse(snapshot.dados),
    usuario: {
      id: snapshot.usuario_id,
      nome: snapshot.usuario_nome,
      perfil: snapshot.usuario_perfil,
    },
    criadoEm: snapshot.criado_em,
  };
}

// Deletar snapshot
export async function deletarSnapshot(id) {
  await pool.query("DELETE FROM snapshots WHERE id = $1", [id]);
}
