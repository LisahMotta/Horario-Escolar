import pool from "./database.js";

// Converte o registro do banco (snake_case) no formato usado pelo frontend
// (camelCase), no mesmo padrão de horarios.js.
function formatarProfessor(row) {
  return {
    id: row.id,
    nome: row.nome,
    disciplinas: row.disciplinas || [],
    turmas: row.turmas || [],
    acumulaCargo: row.acumula_cargo,
    atuaOutraUnidade: row.atua_outra_unidade,
    outraUnidadeNome: row.outra_unidade_nome || "",
    horariosOutraUnidade: row.horarios_outra_unidade || {},
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

// Usado tanto para disciplinas quanto para turmas: normaliza uma lista de
// strings vinda do cliente (remove vazios, espaços e duplicatas).
function normalizarLista(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((d) => String(d).trim())
    .filter(Boolean)
    // remove duplicatas mantendo a ordem
    .filter((d, i, arr) => arr.findIndex((x) => x.toLowerCase() === d.toLowerCase()) === i);
}

// Lista todos os professores cadastrados
export async function listarProfessores() {
  const { rows } = await pool.query(
    "SELECT * FROM professores ORDER BY LOWER(nome)"
  );
  return rows.map(formatarProfessor);
}

// Cria um novo professor
export async function criarProfessor(dados, usuarioId) {
  const nome = String(dados.nome || "").trim();
  if (!nome) {
    throw new Error("Nome do professor é obrigatório");
  }

  const disciplinas = normalizarLista(dados.disciplinas);
  const turmas = normalizarLista(dados.turmas);
  const agora = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `INSERT INTO professores
       (nome, disciplinas, turmas, acumula_cargo, atua_outra_unidade, outra_unidade_nome, horarios_outra_unidade, usuario_id, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`,
      [
        nome,
        disciplinas,
        turmas,
        !!dados.acumulaCargo,
        !!dados.atuaOutraUnidade,
        dados.outraUnidadeNome ? String(dados.outraUnidadeNome).trim() : null,
        JSON.stringify(dados.horariosOutraUnidade || {}),
        usuarioId,
        agora,
      ]
    );
    return formatarProfessor(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw new Error(`Já existe um professor cadastrado com o nome "${nome}"`);
    }
    throw error;
  }
}

// Atualiza um professor existente (apenas os campos enviados)
export async function atualizarProfessor(id, dados) {
  const { rows } = await pool.query("SELECT * FROM professores WHERE id = $1", [id]);
  const existente = rows[0];
  if (!existente) {
    throw new Error("Professor não encontrado");
  }

  const nome =
    dados.nome !== undefined ? String(dados.nome).trim() : existente.nome;
  if (!nome) {
    throw new Error("Nome do professor é obrigatório");
  }

  const disciplinas =
    dados.disciplinas !== undefined
      ? normalizarLista(dados.disciplinas)
      : existente.disciplinas;
  const turmas =
    dados.turmas !== undefined ? normalizarLista(dados.turmas) : existente.turmas;
  const acumulaCargo =
    dados.acumulaCargo !== undefined ? !!dados.acumulaCargo : existente.acumula_cargo;
  const atuaOutraUnidade =
    dados.atuaOutraUnidade !== undefined
      ? !!dados.atuaOutraUnidade
      : existente.atua_outra_unidade;
  const outraUnidadeNome =
    dados.outraUnidadeNome !== undefined
      ? dados.outraUnidadeNome
        ? String(dados.outraUnidadeNome).trim()
        : null
      : existente.outra_unidade_nome;
  const horariosOutraUnidade =
    dados.horariosOutraUnidade !== undefined
      ? dados.horariosOutraUnidade
      : existente.horarios_outra_unidade;
  const agora = new Date().toISOString();

  try {
    const { rows: atualizado } = await pool.query(
      `UPDATE professores
       SET nome = $1, disciplinas = $2, turmas = $3, acumula_cargo = $4, atua_outra_unidade = $5,
           outra_unidade_nome = $6, horarios_outra_unidade = $7, atualizado_em = $8
       WHERE id = $9
       RETURNING *`,
      [
        nome,
        disciplinas,
        turmas,
        acumulaCargo,
        atuaOutraUnidade,
        outraUnidadeNome,
        JSON.stringify(horariosOutraUnidade),
        agora,
        id,
      ]
    );
    return formatarProfessor(atualizado[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw new Error(`Já existe um professor cadastrado com o nome "${nome}"`);
    }
    throw error;
  }
}

// Remove um professor cadastrado
export async function removerProfessor(id) {
  const resultado = await pool.query("DELETE FROM professores WHERE id = $1", [id]);
  if (resultado.rowCount === 0) {
    throw new Error("Professor não encontrado");
  }
}

// Importa vários professores de uma vez, um nome por item da lista (ex.: uma
// lista colada com um nome por linha). Nomes em branco são ignorados; nomes
// repetidos (na lista ou já cadastrados) entram em "duplicados" em vez de dar
// erro, para o restante da importação seguir normalmente.
export async function importarProfessores(nomes, usuarioId) {
  const agora = new Date().toISOString();
  const vistos = new Set();
  const criados = [];
  const duplicados = [];

  for (const nomeOriginal of nomes) {
    const nome = String(nomeOriginal || "").trim();
    if (!nome) continue;

    const chave = nome.toLowerCase();
    if (vistos.has(chave)) {
      duplicados.push(nome);
      continue;
    }
    vistos.add(chave);

    try {
      const { rows } = await pool.query(
        `INSERT INTO professores
         (nome, disciplinas, acumula_cargo, atua_outra_unidade, horarios_outra_unidade, usuario_id, criado_em, atualizado_em)
         VALUES ($1, '{}', false, false, '{}', $2, $3, $3)
         RETURNING *`,
        [nome, usuarioId, agora]
      );
      criados.push(formatarProfessor(rows[0]));
    } catch (error) {
      if (error.code === "23505") {
        duplicados.push(nome);
        continue;
      }
      throw error;
    }
  }

  return { criados, duplicados };
}
