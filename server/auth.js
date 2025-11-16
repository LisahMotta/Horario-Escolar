import db from "./database.js";
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
export function cadastrarUsuario(email, nome, senha, perfil) {
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

    const resultado = db
      .prepare(
        `INSERT INTO usuarios (email, nome, senha_hash, perfil, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        email.toLowerCase().trim(),
        nome.trim(),
        senhaHash,
        perfil,
        agora,
        agora
      );

    return {
      id: resultado.lastInsertRowid,
      email: email.toLowerCase().trim(),
      nome: nome.trim(),
      perfil,
    };
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("Email já cadastrado");
    }
    throw error;
  }
}

// Fazer login
export function fazerLogin(email, senha) {
  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email.toLowerCase().trim());

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

  db.prepare(
    `INSERT INTO sessoes (usuario_id, token, criado_em, expira_em)
     VALUES (?, ?, ?, ?)`
  ).run(usuario.id, token, agora.toISOString(), expiraEm.toISOString());

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
export function validarSessao(token) {
  const sessao = db
    .prepare(
      `SELECT s.*, u.id as usuario_id, u.email, u.nome, u.perfil
       FROM sessoes s
       JOIN usuarios u ON s.usuario_id = u.id
       WHERE s.token = ? AND s.expira_em > datetime('now')`
    )
    .get(token);

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
export function fazerLogout(token) {
  db.prepare("DELETE FROM sessoes WHERE token = ?").run(token);
}

// Limpar sessões expiradas
export function limparSessoesExpiradas() {
  db.prepare("DELETE FROM sessoes WHERE expira_em < datetime('now')").run();
}

// Buscar usuário por email
export function buscarUsuarioPorEmail(email) {
  const usuario = db
    .prepare("SELECT id, email, nome, perfil FROM usuarios WHERE email = ?")
    .get(email.toLowerCase().trim());

  return usuario || null;
}

