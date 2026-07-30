// Cria (ou reseta a senha de) uma conta de Direção diretamente no banco,
// sem apagar nenhum outro dado. Útil quando o banco já existia antes da
// conta padrão automática (direcao@escola.com / trocar123) ser criada, ou
// para recuperar o acesso caso a senha seja esquecida.
//
// Uso:
//   npm run criar-admin -- seuemail@escola.com suasenha "Seu Nome"
//
// Se o email já existir, apenas atualiza a senha e garante o perfil de
// Direção. Se não existir, cria um usuário novo com perfil de Direção.

import crypto from "crypto";
import pool from "./database.js";

const [, , email, senha, nome] = process.argv;

if (!email || !senha) {
  console.error(
    'Uso: npm run criar-admin -- seuemail@escola.com suasenha "Seu Nome"'
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

const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = $1", [
  emailNormalizado,
]);
const existente = rows[0];

if (existente) {
  await pool.query(
    `UPDATE usuarios SET senha_hash = $1, perfil = 'direcao', atualizado_em = $2 WHERE id = $3`,
    [senhaHash, agora, existente.id]
  );
  console.log(`Senha atualizada para "${emailNormalizado}" (perfil: direcao).`);
} else {
  await pool.query(
    `INSERT INTO usuarios (email, nome, senha_hash, perfil, criado_em, atualizado_em)
     VALUES ($1, $2, $3, 'direcao', $4, $5)`,
    [emailNormalizado, nome || "Direção", senhaHash, agora, agora]
  );
  console.log(`Conta de Direção criada: ${emailNormalizado}`);
}

await pool.end();
