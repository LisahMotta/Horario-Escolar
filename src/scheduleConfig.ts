// src/scheduleConfig.ts
export type TipoSlot = "aula" | "intervalo";

export interface TimeSlot {
  id: number;
  label: string; // ex: "07:00 - 07:50 (Aula 1)"
  tipo: TipoSlot;
}

export type GrupoId = "fund2" | "medio" | "tarde_456" | "tarde_123" | "noite";

export interface GrupoInfo {
  id: GrupoId;
  nome: string;
  descricao: string; // aparece na tela como resumo do período / intervalo
}

// Configuração completa da escola atual.
// Para adaptar a outra escola, você pode copiar este objeto, ajustar grupos e slots,
// mantendo os mesmos ids de grupos ou adaptando o tipo GrupoId conforme necessário.
export interface EscolaConfig {
  nomeEscola: string;
  grupos: GrupoInfo[];
  slotsPorGrupo: Record<GrupoId, TimeSlot[]>;
  diasSemana: string[];
}

export const escolaConfig: EscolaConfig = {
  nomeEscola: "Escola padrão",
  grupos: [
    {
      id: "fund2",
      nome: "Manhã – 6º ao 8º ano",
      descricao: "Manhã (07h00 às 12h20) – intervalo às 9h30 (após a 3ª aula)",
    },
    {
      id: "medio",
      nome: "Manhã – 9º ano e Ensino Médio",
      descricao:
        "Manhã (07h00 às 12h20) – intervalo às 10h20 (após a 4ª aula)",
    },
    {
      id: "tarde_456",
      nome: "Tarde – 4º, 5º e 6º ano",
      descricao:
        "Tarde (13h00 às 18h20) – intervalo das 14h40 às 15h00 (4º, 5º e 6º ano)",
    },
    {
      id: "tarde_123",
      nome: "Tarde – 1º, 2º e 3º ano",
      descricao:
        "Tarde (13h00 às 18h20) – intervalo das 15h30 às 15h50 (1º, 2º e 3º ano)",
    },
    {
      id: "noite",
      nome: "Noite – 1º, 2º e 3º médio",
      descricao:
        "Noite (18h50 às 22h50) – turmas de 1º, 2º e 3º médio, intervalo das 20h20 às 20h35",
    },
  ],
  slotsPorGrupo: {
    // MANHÃ – já existentes
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

    // TARDE – 6 aulas, com intervalos em horários diferentes por grupo
    // 4º, 5º e 6º ano: intervalo das 14h40 às 15h00
    tarde_456: [
      { id: 1, label: "13:00 - 13:50 (Aula 1)", tipo: "aula" },
      { id: 2, label: "13:50 - 14:40 (Aula 2)", tipo: "aula" },
      { id: 3, label: "14:40 - 15:00 (Intervalo)", tipo: "intervalo" },
      { id: 4, label: "15:00 - 15:50 (Aula 3)", tipo: "aula" },
      { id: 5, label: "15:50 - 16:40 (Aula 4)", tipo: "aula" },
      { id: 6, label: "16:40 - 17:30 (Aula 5)", tipo: "aula" },
      { id: 7, label: "17:30 - 18:20 (Aula 6)", tipo: "aula" },
    ],
    // 1º, 2º e 3º ano: intervalo das 15h30 às 15h50
    tarde_123: [
      { id: 1, label: "13:00 - 13:50 (Aula 1)", tipo: "aula" },
      { id: 2, label: "13:50 - 14:40 (Aula 2)", tipo: "aula" },
      { id: 3, label: "14:40 - 15:30 (Aula 3)", tipo: "aula" },
      { id: 4, label: "15:30 - 15:50 (Intervalo)", tipo: "intervalo" },
      { id: 5, label: "15:50 - 16:40 (Aula 4)", tipo: "aula" },
      { id: 6, label: "16:40 - 17:30 (Aula 5)", tipo: "aula" },
      { id: 7, label: "17:30 - 18:20 (Aula 6)", tipo: "aula" },
    ],

    // NOITE – 5 aulas com um intervalo
    noite: [
      { id: 1, label: "18:50 - 19:40 (Aula 1)", tipo: "aula" },
      { id: 2, label: "19:40 - 20:20 (Aula 2)", tipo: "aula" },
      { id: 3, label: "20:20 - 20:35 (Intervalo)", tipo: "intervalo" },
      { id: 4, label: "20:35 - 21:25 (Aula 3)", tipo: "aula" },
      { id: 5, label: "21:25 - 22:15 (Aula 4)", tipo: "aula" },
      { id: 6, label: "22:15 - 22:50 (Aula 5)", tipo: "aula" },
    ],
  },
  diasSemana: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
};

// Exports derivados para continuar usando a mesma API no restante do app
export const grupos = escolaConfig.grupos;
export const slotsPorGrupo = escolaConfig.slotsPorGrupo;
export const diasSemana = escolaConfig.diasSemana;
