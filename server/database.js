import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cria ou abre o banco de dados
const dbPath = path.join(__dirname, "..", "data", "horario-escolar.db");
const db = new Database(dbPath);

// Habilita foreign keys
db.pragma("foreign_keys = ON");

// Cria as tabelas se não existirem
function inicializarBanco() {
  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('direcao', 'vice_direcao', 'coordenacao', 'goe', 'aoe', 'professor')),
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela de sessões (para manter login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      expira_em TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de horários
  db.exec(`
    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id TEXT NOT NULL,
      dia TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      disciplina TEXT,
      professor TEXT,
      turma TEXT,
      usuario_id INTEGER,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      UNIQUE(grupo_id, dia, slot_id)
    )
  `);

  // Tabela de configurações da escola
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes_escola (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela de histórico de alterações (auditoria)
  db.exec(`
    CREATE TABLE IF NOT EXISTS historico_alteracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_alteracao TEXT NOT NULL CHECK(tipo_alteracao IN ('criar', 'atualizar', 'deletar', 'limpar')),
      tabela TEXT NOT NULL,
      registro_id INTEGER,
      grupo_id TEXT,
      dia TEXT,
      slot_id INTEGER,
      campo_alterado TEXT,
      valor_anterior TEXT,
      valor_novo TEXT,
      usuario_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      detalhes TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de snapshots (versões completas do horário)
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      dados TEXT NOT NULL,
      usuario_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Índices para melhor performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_horarios_grupo_dia 
    ON horarios(grupo_id, dia);
    
    CREATE INDEX IF NOT EXISTS idx_sessoes_token 
    ON sessoes(token);
    
    CREATE INDEX IF NOT EXISTS idx_sessoes_usuario 
    ON sessoes(usuario_id);
    
    CREATE INDEX IF NOT EXISTS idx_historico_timestamp 
    ON historico_alteracoes(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_historico_usuario 
    ON historico_alteracoes(usuario_id);
    
    CREATE INDEX IF NOT EXISTS idx_historico_grupo 
    ON historico_alteracoes(grupo_id, dia, slot_id);
    
    CREATE INDEX IF NOT EXISTS idx_snapshots_criado 
    ON snapshots(criado_em DESC);
  `);

  console.log("Banco de dados inicializado com sucesso!");
}

// Inicializa o banco na importação
inicializarBanco();

export default db;

