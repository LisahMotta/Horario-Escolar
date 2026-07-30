import pool from "./database.js";
import { registrarAlteracao } from "./historico.js";

// Salvar ou atualizar horário
export async function salvarHorario(
  grupoId,
  dia,
  slotId,
  disciplina,
  professor,
  turma,
  usuarioId
) {
  const agora = new Date().toISOString();

  // Tenta atualizar primeiro
  const { rows } = await pool.query(
    "SELECT * FROM horarios WHERE grupo_id = $1 AND dia = $2 AND slot_id = $3",
    [grupoId, dia, slotId]
  );
  const existente = rows[0];

  if (existente) {
    // Registra cada campo alterado no histórico
    if (existente.disciplina !== (disciplina || null)) {
      await registrarAlteracao({
        tipoAlteracao: "atualizar",
        tabela: "horarios",
        registroId: existente.id,
        grupoId,
        dia,
        slotId,
        campoAlterado: "disciplina",
        valorAnterior: existente.disciplina,
        valorNovo: disciplina || null,
        usuarioId,
        detalhes: `Disciplina alterada de "${existente.disciplina || "vazio"}" para "${disciplina || "vazio"}"`,
      });
    }

    if (existente.professor !== (professor || null)) {
      await registrarAlteracao({
        tipoAlteracao: "atualizar",
        tabela: "horarios",
        registroId: existente.id,
        grupoId,
        dia,
        slotId,
        campoAlterado: "professor",
        valorAnterior: existente.professor,
        valorNovo: professor || null,
        usuarioId,
        detalhes: `Professor alterado de "${existente.professor || "vazio"}" para "${professor || "vazio"}"`,
      });
    }

    if (existente.turma !== (turma || null)) {
      await registrarAlteracao({
        tipoAlteracao: "atualizar",
        tabela: "horarios",
        registroId: existente.id,
        grupoId,
        dia,
        slotId,
        campoAlterado: "turma",
        valorAnterior: existente.turma,
        valorNovo: turma || null,
        usuarioId,
        detalhes: `Turma alterada de "${existente.turma || "vazio"}" para "${turma || "vazio"}"`,
      });
    }

    // Atualiza
    await pool.query(
      `UPDATE horarios
       SET disciplina = $1, professor = $2, turma = $3, usuario_id = $4, atualizado_em = $5
       WHERE id = $6`,
      [disciplina || null, professor || null, turma || null, usuarioId, agora, existente.id]
    );

    return { id: existente.id, criado: false };
  } else {
    // Cria novo
    const { rows: insertRows } = await pool.query(
      `INSERT INTO horarios
       (grupo_id, dia, slot_id, disciplina, professor, turma, usuario_id, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        grupoId,
        dia,
        slotId,
        disciplina || null,
        professor || null,
        turma || null,
        usuarioId,
        agora,
        agora,
      ]
    );
    const novoId = insertRows[0].id;

    // Registra criação no histórico
    await registrarAlteracao({
      tipoAlteracao: "criar",
      tabela: "horarios",
      registroId: novoId,
      grupoId,
      dia,
      slotId,
      campoAlterado: null,
      valorAnterior: null,
      valorNovo: { disciplina, professor, turma },
      usuarioId,
      detalhes: `Horário criado: ${disciplina || ""} - ${professor || ""} - ${turma || ""}`,
    });

    return { id: novoId, criado: true };
  }
}

// Limpar horário (definir como null)
export async function limparHorario(grupoId, dia, slotId, usuarioId) {
  const agora = new Date().toISOString();

  // Busca o horário antes de limpar para registrar no histórico
  const { rows } = await pool.query(
    "SELECT * FROM horarios WHERE grupo_id = $1 AND dia = $2 AND slot_id = $3",
    [grupoId, dia, slotId]
  );
  const existente = rows[0];

  if (existente && (existente.disciplina || existente.professor || existente.turma)) {
    await registrarAlteracao({
      tipoAlteracao: "limpar",
      tabela: "horarios",
      registroId: existente.id,
      grupoId,
      dia,
      slotId,
      campoAlterado: null,
      valorAnterior: {
        disciplina: existente.disciplina,
        professor: existente.professor,
        turma: existente.turma,
      },
      valorNovo: null,
      usuarioId,
      detalhes: `Horário limpo: ${existente.disciplina || ""} - ${existente.professor || ""} - ${existente.turma || ""}`,
    });
  }

  await pool.query(
    `UPDATE horarios
     SET disciplina = NULL, professor = NULL, turma = NULL, usuario_id = $1, atualizado_em = $2
     WHERE grupo_id = $3 AND dia = $4 AND slot_id = $5`,
    [usuarioId, agora, grupoId, dia, slotId]
  );
}

// Buscar todos os horários de um grupo
export async function buscarHorariosPorGrupo(grupoId) {
  const { rows } = await pool.query(
    `SELECT * FROM horarios
     WHERE grupo_id = $1
     ORDER BY dia, slot_id`,
    [grupoId]
  );

  return rows;
}

// Buscar todos os horários
export async function buscarTodosHorarios() {
  const { rows } = await pool.query(
    "SELECT * FROM horarios ORDER BY grupo_id, dia, slot_id"
  );

  return rows;
}

// Buscar horário específico
export async function buscarHorario(grupoId, dia, slotId) {
  const { rows } = await pool.query(
    "SELECT * FROM horarios WHERE grupo_id = $1 AND dia = $2 AND slot_id = $3",
    [grupoId, dia, slotId]
  );

  return rows[0] || null;
}

// Limpar todos os horários de um grupo
export async function limparGrupo(grupoId, usuarioId) {
  const agora = new Date().toISOString();

  // Busca todos os horários do grupo antes de limpar
  const { rows: horariosGrupo } = await pool.query(
    "SELECT * FROM horarios WHERE grupo_id = $1",
    [grupoId]
  );

  // Registra cada horário limpo no histórico
  for (const h of horariosGrupo) {
    if (h.disciplina || h.professor || h.turma) {
      await registrarAlteracao({
        tipoAlteracao: "limpar",
        tabela: "horarios",
        registroId: h.id,
        grupoId,
        dia: h.dia,
        slotId: h.slot_id,
        campoAlterado: null,
        valorAnterior: {
          disciplina: h.disciplina,
          professor: h.professor,
          turma: h.turma,
        },
        valorNovo: null,
        usuarioId,
        detalhes: `Grupo limpo: ${h.disciplina || ""} - ${h.professor || ""} - ${h.turma || ""}`,
      });
    }
  }

  await pool.query(
    `UPDATE horarios
     SET disciplina = NULL, professor = NULL, turma = NULL, usuario_id = $1, atualizado_em = $2
     WHERE grupo_id = $3`,
    [usuarioId, agora, grupoId]
  );
}

// Formatar horários no formato esperado pelo frontend
export function formatarHorariosParaFrontend(horarios) {
  const resultado = {};

  horarios.forEach((h) => {
    if (!resultado[h.grupo_id]) {
      resultado[h.grupo_id] = {};
    }

    if (!resultado[h.grupo_id][h.dia]) {
      resultado[h.grupo_id][h.dia] = {};
    }

    if (h.disciplina || h.professor || h.turma) {
      resultado[h.grupo_id][h.dia][h.slot_id] = {
        disciplina: h.disciplina || "",
        professor: h.professor || "",
        turma: h.turma || "",
      };
    } else {
      resultado[h.grupo_id][h.dia][h.slot_id] = null;
    }
  });

  return resultado;
}
