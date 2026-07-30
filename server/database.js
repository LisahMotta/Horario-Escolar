import "dotenv/config";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "Aviso: variável de ambiente DATABASE_URL não definida. Configure a string de conexão do Postgres (Supabase) em um arquivo .env (local) ou nas variáveis de ambiente do Vercel (produção)."
  );
}

// Em ambientes serverless (Vercel), cada instância da função deve manter
// poucas conexões — o ideal é usar a connection string do "Connection
// pooling" (PgBouncer) do Supabase, que multiplexa muitas instâncias em
// poucas conexões reais com o Postgres.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : false,
  max: process.env.VERCEL ? 1 : 10,
});

// Converte placeholders "?" (estilo usado nas queries dinâmicas deste
// projeto) em "$1, $2, ..." (estilo Postgres).
export function toPg(query) {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

async function inicializarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('direcao', 'vice_direcao', 'coordenacao', 'goe', 'aoe', 'professor')),
      criado_em TEXT NOT NULL DEFAULT (NOW()::text),
      atualizado_em TEXT NOT NULL DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (NOW()::text),
      expira_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS horarios (
      id SERIAL PRIMARY KEY,
      grupo_id TEXT NOT NULL,
      dia TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      disciplina TEXT,
      professor TEXT,
      turma TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TEXT NOT NULL DEFAULT (NOW()::text),
      atualizado_em TEXT NOT NULL DEFAULT (NOW()::text),
      UNIQUE(grupo_id, dia, slot_id)
    );

    CREATE TABLE IF NOT EXISTS configuracoes_escola (
      id SERIAL PRIMARY KEY,
      chave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS historico_alteracoes (
      id SERIAL PRIMARY KEY,
      tipo_alteracao TEXT NOT NULL CHECK(tipo_alteracao IN ('criar', 'atualizar', 'deletar', 'limpar')),
      tabela TEXT NOT NULL,
      registro_id INTEGER,
      grupo_id TEXT,
      dia TEXT,
      slot_id INTEGER,
      campo_alterado TEXT,
      valor_anterior TEXT,
      valor_novo TEXT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL DEFAULT (NOW()::text),
      detalhes TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      dados TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_em TEXT NOT NULL DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS logs_atividade (
      id SERIAL PRIMARY KEY,
      timestamp TEXT NOT NULL,
      usuario TEXT,
      acao TEXT NOT NULL,
      detalhes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_horarios_grupo_dia ON horarios(grupo_id, dia);
    CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);
    CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico_alteracoes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_historico_usuario ON historico_alteracoes(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_historico_grupo ON historico_alteracoes(grupo_id, dia, slot_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_criado ON snapshots(criado_em DESC);
  `);

  console.log("Banco de dados inicializado com sucesso!");
}

// Cria uma conta padrão de Direção no primeiro uso, para que a escola
// consiga entrar e cadastrar os demais usuários sem depender de um
// cadastro público (removido por segurança).
async function seedUsuarioPadrao() {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM usuarios"
  );
  if (rows[0].total > 0) return;

  const senhaHash = crypto.createHash("sha256").update("trocar123").digest("hex");
  const agora = new Date().toISOString();

  await pool.query(
    `INSERT INTO usuarios (email, nome, senha_hash, perfil, criado_em, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ["direcao@escola.com", "Direção", senhaHash, "direcao", agora, agora]
  );

  console.log(
    "Usuário padrão criado — email: direcao@escola.com | senha: trocar123 (recomendamos avisar a direção para ter cuidado com este acesso)."
  );
}

await inicializarBanco();
await seedUsuarioPadrao();

export default pool;
