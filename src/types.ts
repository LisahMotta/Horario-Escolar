/// src/types.ts
export interface AulaInfo {
  disciplina: string;
  professor: string;
  turma: string;
}

export type HorarioPorDia = {
  [slotId: number]: AulaInfo | null;
};

export type HorarioCompleto = {
  [dia: string]: HorarioPorDia;
};

// Estrutura geral: um horário para cada grupo (fund2 / medio)
export type HorariosPorGrupo = {
  [grupoId: string]: HorarioCompleto;
};
