// Cria (ou reseta a senha de) uma conta de Direção diretamente no banco,
// sem apagar nenhum outro dado. Útil quando o banco já existia antes da
// conta padrão automática (direcao@escola.com / trocar123) ser criada.
//
// Uso:
//   node server/criar-admin.js seuemail@escola.com suasenha "Seu Nome"
//
// Se o email já existir, apenas atualiza a senha e garante o perfil de
// Direção. Se não existir, cria um usuário novo com perfil de Direção.

import crypto from "crypto";
import db from "./database.js";

const [, , email, senha, nome] = process.argv;

if (!email || !senha) {
  console.error(
    'Uso: node server/criar-admin.js seuemail@escola.com suasenha "Seu Nome"'
  );
  process.exit(1);
}

if (senha.length < 4) {
  console.error("A senha deve ter pelo menos 4 caracteres.");
  process.exit(1);
}

const emailNormalizado = email.toLowerCase().trim();
const senhaHash = crypto.createHash("sha256").update(senha).digest("hex");
const agora = new Date().toISOString();

const existente = db
  .prepare("SELECT id FROM usuarios WHERE email = ?")
  .get(emailNormalizado);

if (existente) {
  db.prepare(
    `UPDATE usuarios SET senha_hash = ?, perfil = 'direcao', atualizado_em = ? WHERE id = ?`
  ).run(senhaHash, agora, existente.id);
  console.log(`Senha atualizada para "${emailNormalizado}" (perfil: direcao).`);
} else {
  db.prepare(
    `INSERT INTO usuarios (email, nome, senha_hash, perfil, criado_em, atualizado_em)
     VALUES (?, ?, ?, 'direcao', ?, ?)`
  ).run(emailNormalizado, nome || "Direção", senhaHash, agora, agora);
  console.log(`Conta de Direção criada: ${emailNormalizado}`);
}
