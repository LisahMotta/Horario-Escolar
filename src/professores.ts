// src/professores.ts
// Registro de professores: dados administrativos (acúmulo de cargo, atuação
// em outra unidade escolar) usados para alertar sobre o limite de 10 aulas
// diárias quando o docente também leciona em outra escola.

export interface HorarioOutraUnidade {
  aulasNoDia: number; // quantidade de aulas que o professor já tem na outra unidade nesse dia
  horarioReferencia?: string; // texto livre, ex: "13h às 18h20", apenas para consulta visual
}

export interface ProfessorInfo {
  id: string;
  nome: string;
  acumulaCargo: boolean;
  atuaOutraUnidade: boolean;
  outraUnidadeNome?: string;
  horariosOutraUnidade: Record<string, HorarioOutraUnidade>; // chave: dia da semana
}

const PROFESSORES_STORAGE_KEY = "horario-escolar-professores";

export function carregarProfessores(): ProfessorInfo[] {
  try {
    const salvo = localStorage.getItem(PROFESSORES_STORAGE_KEY);
    if (salvo) {
      const lista = JSON.parse(salvo);
      if (Array.isArray(lista)) return lista;
    }
  } catch {
    // Se der erro, retorna lista vazia
  }
  return [];
}

export function salvarProfessores(lista: ProfessorInfo[]) {
  try {
    localStorage.setItem(PROFESSORES_STORAGE_KEY, JSON.stringify(lista));
  } catch (error) {
    console.error("Erro ao salvar professores:", error);
  }
}
