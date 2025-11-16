import db from "./database.js";
import { registrarAlteracao } from "./historico.js";

// Salvar ou atualizar horário
export function salvarHorario(
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
  const existente = db
    .prepare(
      "SELECT * FROM horarios WHERE grupo_id = ? AND dia = ? AND slot_id = ?"
    )
    .get(grupoId, dia, slotId);

  if (existente) {
    // Registra alterações no histórico
    const valorAnterior = {
      disciplina: existente.disciplina,
      professor: existente.professor,
      turma: existente.turma,
    };
    const valorNovo = {
      disciplina: disciplina || null,
      professor: professor || null,
      turma: turma || null,
    };

    // Registra cada campo alterado
    if (existente.disciplina !== (disciplina || null)) {
      registrarAlteracao({
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
      registrarAlteracao({
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
      registrarAlteracao({
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
    db.prepare(
      `UPDATE horarios 
       SET disciplina = ?, professor = ?, turma = ?, usuario_id = ?, atualizado_em = ?
       WHERE id = ?`
    ).run(disciplina || null, professor || null, turma || null, usuarioId, agora, existente.id);

    return { id: existente.id, criado: false };
  } else {
    // Cria novo
    const resultado = db
      .prepare(
        `INSERT INTO horarios 
         (grupo_id, dia, slot_id, disciplina, professor, turma, usuario_id, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        grupoId,
        dia,
        slotId,
        disciplina || null,
        professor || null,
        turma || null,
        usuarioId,
        agora,
        agora
      );

    // Registra criação no histórico
    registrarAlteracao({
      tipoAlteracao: "criar",
      tabela: "horarios",
      registroId: resultado.lastInsertRowid,
      grupoId,
      dia,
      slotId,
      campoAlterado: null,
      valorAnterior: null,
      valorNovo: { disciplina, professor, turma },
      usuarioId,
      detalhes: `Horário criado: ${disciplina || ""} - ${professor || ""} - ${turma || ""}`,
    });

    return { id: resultado.lastInsertRowid, criado: true };
  }
}

// Limpar horário (definir como null)
export function limparHorario(grupoId, dia, slotId, usuarioId) {
  const agora = new Date().toISOString();

  // Busca o horário antes de limpar para registrar no histórico
  const existente = db
    .prepare(
      "SELECT * FROM horarios WHERE grupo_id = ? AND dia = ? AND slot_id = ?"
    )
    .get(grupoId, dia, slotId);

  if (existente && (existente.disciplina || existente.professor || existente.turma)) {
    // Registra no histórico
    registrarAlteracao({
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

  db.prepare(
    `UPDATE horarios 
     SET disciplina = NULL, professor = NULL, turma = NULL, usuario_id = ?, atualizado_em = ?
     WHERE grupo_id = ? AND dia = ? AND slot_id = ?`
  ).run(usuarioId, agora, grupoId, dia, slotId);
}

// Buscar todos os horários de um grupo
export function buscarHorariosPorGrupo(grupoId) {
  const horarios = db
    .prepare(
      `SELECT * FROM horarios 
       WHERE grupo_id = ? 
       ORDER BY dia, slot_id`
    )
    .all(grupoId);

  return horarios;
}

// Buscar todos os horários
export function buscarTodosHorarios() {
  const horarios = db
    .prepare("SELECT * FROM horarios ORDER BY grupo_id, dia, slot_id")
    .all();

  return horarios;
}

// Buscar horário específico
export function buscarHorario(grupoId, dia, slotId) {
  const horario = db
    .prepare(
      "SELECT * FROM horarios WHERE grupo_id = ? AND dia = ? AND slot_id = ?"
    )
    .get(grupoId, dia, slotId);

  return horario || null;
}

// Limpar todos os horários de um grupo
export function limparGrupo(grupoId, usuarioId) {
  const agora = new Date().toISOString();

  // Busca todos os horários do grupo antes de limpar
  const horariosGrupo = db
    .prepare("SELECT * FROM horarios WHERE grupo_id = ?")
    .all(grupoId);

  // Registra cada horário limpo no histórico
  horariosGrupo.forEach((h) => {
    if (h.disciplina || h.professor || h.turma) {
      registrarAlteracao({
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
  });

  db.prepare(
    `UPDATE horarios 
     SET disciplina = NULL, professor = NULL, turma = NULL, usuario_id = ?, atualizado_em = ?
     WHERE grupo_id = ?`
  ).run(usuarioId, agora, grupoId);
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

