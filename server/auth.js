import pool from "./database.js";
import crypto from "crypto";

// Gera um hash simples da senha (em produção, use bcrypt)
function hashSenha(senha) {
  return crypto.createHash("sha256").update(senha).digest("hex");
}

// Gera um token de sessão
function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Valida email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Cadastrar novo usuário
export async function cadastrarUsuario(email, nome, senha, perfil) {
  if (!validarEmail(email)) {
    throw new Error("Email inválido");
  }

  if (!nome || nome.trim().length === 0) {
    throw new Error("Nome é obrigatório");
  }

  if (!senha || senha.length < 4) {
    throw new Error("Senha deve ter pelo menos 4 caracteres");
  }

  const perfisValidos = [
    "direcao",
    "vice_direcao",
    "coordenacao",
    "goe",
    "aoe",
    "professor",
  ];
  if (!perfisValidos.includes(perfil)) {
    throw new Error("Perfil inválido");
  }

  try {
    const senhaHash = hashSenha(senha);
    const agora = new Date().toISOString();
    const emailNormalizado = email.toLowerCase().trim();
    const nomeNormalizado = nome.trim();

    const { rows } = await pool.query(
      `INSERT INTO usuarios (email, nome, senha_hash, perfil, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [emailNormalizado, nomeNormalizado, senhaHash, perfil, agora, agora]
    );

    return {
      id: rows[0].id,
      email: emailNormalizado,
      nome: nomeNormalizado,
      perfil,
    };
  } catch (error) {
    if (error.code === "23505") {
      throw new Error("Email já cadastrado");
    }
    throw error;
  }
}

// Fazer login
export async function fazerLogin(email, senha) {
  const { rows } = await pool.query(
    "SELECT * FROM usuarios WHERE email = $1",
    [email.toLowerCase().trim()]
  );
  const usuario = rows[0];

  if (!usuario) {
    throw new Error("Email ou senha incorretos");
  }

  const senhaHash = hashSenha(senha);
  if (usuario.senha_hash !== senhaHash) {
    throw new Error("Email ou senha incorretos");
  }

  // Cria sessão
  const token = gerarToken();
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias

  await pool.query(
    `INSERT INTO sessoes (usuario_id, token, criado_em, expira_em)
     VALUES ($1, $2, $3, $4)`,
    [usuario.id, token, agora.toISOString(), expiraEm.toISOString()]
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      perfil: usuario.perfil,
    },
  };
}

// Validar token de sessão
export async function validarSessao(token) {
  const { rows } = await pool.query(
    `SELECT s.*, u.id as usuario_id, u.email, u.nome, u.perfil
     FROM sessoes s
     JOIN usuarios u ON s.usuario_id = u.id
     WHERE s.token = $1 AND s.expira_em > $2`,
    [token, new Date().toISOString()]
  );
  const sessao = rows[0];

  if (!sessao) {
    return null;
  }

  return {
    id: sessao.usuario_id,
    email: sessao.email,
    nome: sessao.nome,
    perfil: sessao.perfil,
  };
}

// Fazer logout (remover sessão)
export async function fazerLogout(token) {
  await pool.query("DELETE FROM sessoes WHERE token = $1", [token]);
}

// Limpar sessões expiradas
export async function limparSessoesExpiradas() {
  await pool.query("DELETE FROM sessoes WHERE expira_em < $1", [
    new Date().toISOString(),
  ]);
}

// Buscar usuário por email
export async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(
    "SELECT id, email, nome, perfil FROM usuarios WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  return rows[0] || null;
}

// Perfis que podem cadastrar/editar horários e usuários. Coordenação, GOE,
// AOE e Professor têm acesso somente de consulta.
export const PERFIS_EDITORES = ["direcao", "vice_direcao"];

export function podeEditarHorarios(perfil) {
  return PERFIS_EDITORES.includes(perfil);
}

// Lista todos os usuários (sem o hash da senha), para a tela de gestão de usuários
export async function listarUsuarios() {
  const { rows } = await pool.query(
    "SELECT id, email, nome, perfil, criado_em FROM usuarios ORDER BY LOWER(nome)"
  );
  return rows;
}

// Remove um usuário cadastrado
export async function removerUsuario(id) {
  const resultado = await pool.query("DELETE FROM usuarios WHERE id = $1", [
    id,
  ]);
  if (resultado.rowCount === 0) {
    throw new Error("Usuário não encontrado");
  }
}
