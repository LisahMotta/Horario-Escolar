// src/scheduleConfig.ts
export type TipoSlot = "aula" | "intervalo";

export interface TimeSlot {
  id: number;
  label: string;   // ex: "07:00 - 07:50 (Aula 1)"
  tipo: TipoSlot;
}

export type GrupoId = "fund2" | "medio";

export interface GrupoInfo {
  id: GrupoId;
  nome: string;
  descricao: string;
}

export const grupos: GrupoInfo[] = [
  {
    id: "fund2",
    nome: "6º ao 8º ano",
    descricao: "Intervalo às 9h30 (após a 3ª aula)",
  },
  {
    id: "medio",
    nome: "9º ano e Ensino Médio",
    descricao: "Intervalo às 10h20 (após a 4ª aula)",
  },
];

export const slotsPorGrupo: Record<GrupoId, TimeSlot[]> = {
  fund2: [
    { id: 1, label: "07:00 - 07:50 (Aula 1)", tipo: "aula" },
    { id: 2, label: "07:50 - 08:40 (Aula 2)", tipo: "aula" },
    { id: 3, label: "08:40 - 09:30 (Aula 3)", tipo: "aula" },
    { id: 4, label: "09:30 - 09:50 (Intervalo)", tipo: "intervalo" },
    { id: 5, label: "09:50 - 10:40 (Aula 4)", tipo: "aula" },
    { id: 6, label: "10:40 - 11:30 (Aula 5)", tipo: "aula" },
    { id: 7, label: "11:30 - 12:20 (Aula 6)", tipo: "aula" },
  ],
  medio: [
    { id: 1, label: "07:00 - 07:50 (Aula 1)", tipo: "aula" },
    { id: 2, label: "07:50 - 08:40 (Aula 2)", tipo: "aula" },
    { id: 3, label: "08:40 - 09:30 (Aula 3)", tipo: "aula" },
    { id: 4, label: "09:30 - 10:20 (Aula 4)", tipo: "aula" },
    { id: 5, label: "10:20 - 10:40 (Intervalo)", tipo: "intervalo" },
    { id: 6, label: "10:40 - 11:30 (Aula 5)", tipo: "aula" },
    { id: 7, label: "11:30 - 12:20 (Aula 6)", tipo: "aula" },
  ],
};

export const diasSemana = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
];
