import { useEffect, useRef, useState } from "react";
import {
  Buildings,
  Bell,
  CaretDown,
  Clock,
  Info,
  SignOut,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  getGrupos,
  getSlotsPorGrupo,
  getDiasSemana,
  getTurmasPorGrupo,
  obterConfiguracao,
  type GrupoId,
  type TimeSlot,
} from "./scheduleConfig";
import type { HorarioCompleto, HorariosPorGrupo } from "./types";
import { ConfiguracaoEscola } from "./ConfiguracaoEscola";
import { Professores } from "./Professores";
import { Usuarios } from "./Usuarios";
import type { ProfessorInfo } from "./professoresStore";
import { carregarProfessores } from "./professoresStore";
import { AuthScreen } from "./AuthScreen";
import { HistoricoAlteracoes } from "./HistoricoAlteracoes";
import { Dashboard } from "./Dashboard";
import { ExportacaoImportacao } from "./ExportacaoImportacao";
import { Sidebar } from "./Sidebar";
import {
  verificarSessao,
  fazerLogout as apiFazerLogout,
  buscarHorarios as apiBuscarHorarios,
  salvarHorario as apiSalvarHorario,
  limparHorario as apiLimparHorario,
  limparGrupo as apiLimparGrupo,
  criarSnapshot as apiCriarSnapshot,
  buscarSnapshots as apiBuscarSnapshots,
  buscarSnapshot as apiBuscarSnapshot,
} from "./api";

const STORAGE_KEY = "horario-escolar-manha-por-grupo";
const STORAGE_DRAFT_KEY = "horario-escolar-rascunho-por-grupo";
const THEME_KEY = "horario-escolar-theme";
const FONT_KEY = "horario-escolar-font-scale";
const USER_KEY = "horario-escolar-usuario";
const SNAPSHOT_KEY = "horario-escolar-snapshots";

export type AbaId = "dashboard" | "quadro" | "cadastro" | "grades" | "relatorios" | "configuracao" | "professores" | "usuarios" | "historico" | "exportacao";

export const HORARIO_TABS: AbaId[] = [
  "quadro",
  "cadastro",
  "grades",
  "relatorios",
  "historico",
  "exportacao",
];

export type Perfil =
  | "direcao"
  | "vice_direcao"
  | "coordenacao"
  | "goe"
  | "aoe"
  | "professor";

export const PERFIS_LABEL: Record<Perfil, string> = {
  direcao: "Direção",
  vice_direcao: "Vice-direção",
  coordenacao: "Coordenação",
  goe: "GOE",
  aoe: "AOE",
  professor: "Professor(a)",
};

interface LogEntry {
  timestamp: string; // ISO string
  usuario: string | null;
  acao: string; // "login", "logout", "salvar_aula", "limpar_aula", "limpar_grupo"
  detalhes: string;
  grupoId?: GrupoId | null;
}

interface UsuarioAtual {
  nome: string;
  perfil: Perfil;
}

interface SnapshotHorario {
  id: string;
  timestamp: string;
  usuario: string | null;
  descricao: string;
  horarios: HorariosPorGrupo;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

// ---------- Funções auxiliares de base ----------

function criarHorarioVazioParaGrupo(grupoId: GrupoId): HorarioCompleto {
  const slotsPorGrupo = getSlotsPorGrupo();
  const diasSemana = getDiasSemana();
  const slots = slotsPorGrupo[grupoId];
  const horario: HorarioCompleto = {};

  diasSemana.forEach((dia: string) => {
    horario[dia] = {};
    slots.forEach((slot: TimeSlot) => {
      if (slot.tipo === "aula") {
        horario[dia][slot.id] = null;
      }
    });
  });

  return horario;
}

async function carregarHorarios(): Promise<HorariosPorGrupo> {
  try {
    // Tenta carregar do servidor
    const horarios = await apiBuscarHorarios();
    if (Object.keys(horarios).length > 0) {
      return horarios;
    }
  } catch (error) {
    console.error("Erro ao carregar horários do servidor:", error);
    // Fallback para localStorage
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      return JSON.parse(salvo);
    }
  }

  // Se não houver dados, cria estrutura vazia
  const grupos = getGrupos();
  const inicial: HorariosPorGrupo = {};
  grupos.forEach((g) => {
    inicial[g.id] = criarHorarioVazioParaGrupo(g.id);
  });
  return inicial;
}


function carregarHorariosRascunho(): HorariosPorGrupo {
  const salvo = localStorage.getItem(STORAGE_DRAFT_KEY);
  if (salvo) {
    try {
      return JSON.parse(salvo);
    } catch {
      // se der erro, ignora e recria
    }
  }
  // por padrão, começa vazio (pode ser preenchido a partir do oficial quando o simulador é ativado)
  const grupos = getGrupos();
  const inicial: HorariosPorGrupo = {};
  grupos.forEach((g) => {
    inicial[g.id] = criarHorarioVazioParaGrupo(g.id);
  });
  return inicial;
}

function salvarHorariosRascunho(horarios: HorariosPorGrupo) {
  localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(horarios));
}

function carregarSnapshots(): SnapshotHorario[] {
  try {
    const salvo = localStorage.getItem(SNAPSHOT_KEY);
    if (!salvo) return [];
    return JSON.parse(salvo);
  } catch {
    return [];
  }
}

function salvarSnapshots(lista: SnapshotHorario[]) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(lista));
}

// URL base da API de logs (no Render será a mesma URL do app, em /api/logs)
const LOGS_API_URL = "/api/logs";

// Carrega log do localStorage (usado apenas como fallback se a API não responder)
function carregarLogLocal(): LogEntry[] {
  try {
    const salvo = localStorage.getItem("horario-escolar-log");
    if (!salvo) return [];
    return JSON.parse(salvo);
  } catch {
    return [];
  }
}

function salvarLogLocal(logs: LogEntry[]) {
  localStorage.setItem("horario-escolar-log", JSON.stringify(logs));
}

function carregarUsuario(): UsuarioAtual | null {
  const salvo = localStorage.getItem(USER_KEY);
  if (!salvo) return null;

  try {
    const obj = JSON.parse(salvo) as Partial<UsuarioAtual>;
    if (obj && typeof obj.nome === "string" && obj.perfil) {
      return { nome: obj.nome, perfil: obj.perfil as Perfil };
    }
  } catch {
    // se não for JSON, trata como formato antigo (apenas nome)
    if (salvo) {
      return { nome: salvo, perfil: "professor" };
    }
  }

  // fallback para formato antigo
  return { nome: salvo, perfil: "professor" };
}

function salvarUsuario(usuario: UsuarioAtual | null) {
  if (usuario) {
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function podeEditar(usuario: UsuarioAtual | null): boolean {
  if (!usuario) return false;
  return usuario.perfil === "direcao" || usuario.perfil === "vice_direcao";
}

function iniciaisUsuario(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// Converte “número da aula” (1 a 6) para o slotId correto, ignorando intervalos
function aulaNumeroParaSlotId(slots: TimeSlot[], numAula: number): number | null {
  let contador = 0;
  for (const slot of slots) {
    if (slot.tipo === "aula") {
      contador++;
      if (contador === numAula) {
        return slot.id;
      }
    }
  }
  return null;
}

// ---------- Montagem da grade por professor ----------

type GradeProfessor = {
  [professor: string]: {
    [dia: string]: {
      [numAula: number]: { disciplina: string; turma: string };
    };
  };
};

function construirGradeProfessor(
  horario: HorarioCompleto,
  slots: TimeSlot[]
): GradeProfessor {
  const mapa: GradeProfessor = {};
  const diasSemana = getDiasSemana();

  diasSemana.forEach((dia: string) => {
    let numAula = 0;

    slots.forEach((slot) => {
      if (slot.tipo !== "aula") return;
      numAula++;

      const aula = horario[dia][slot.id];
      if (!aula || !aula.professor) return;

      const prof = aula.professor.trim();
      if (!prof) return;

      if (!mapa[prof]) mapa[prof] = {};
      if (!mapa[prof][dia]) mapa[prof][dia] = {};

      mapa[prof][dia][numAula] = {
        disciplina: aula.disciplina || "",
        turma: aula.turma || "",
      };
    });
  });

  return mapa;
}

// ---------- Montagem da grade por turma ----------

type GradeTurma = {
  [turma: string]: {
    [dia: string]: {
      [numAula: number]: { disciplina: string; professor: string };
    };
  };
};

function construirGradeTurma(
  horario: HorarioCompleto,
  slots: TimeSlot[]
): GradeTurma {
  const mapa: GradeTurma = {};
  const diasSemana = getDiasSemana();

  diasSemana.forEach((dia: string) => {
    let numAula = 0;

    slots.forEach((slot) => {
      if (slot.tipo !== "aula") return;
      numAula++;

      const aula = horario[dia][slot.id];
      if (!aula || !aula.turma) return;

      const turma = aula.turma.trim();
      if (!turma) return;

      if (!mapa[turma]) mapa[turma] = {};
      if (!mapa[turma][dia]) mapa[turma][dia] = {};

      mapa[turma][dia][numAula] = {
        disciplina: aula.disciplina || "",
        professor: aula.professor || "",
      };
    });
  });

  return mapa;
}

// ---------- Componente principal ----------

function App() {
  // Configuração dinâmica da escola
  const grupos = getGrupos();
  const slotsPorGrupo = getSlotsPorGrupo();
  const diasSemana = getDiasSemana();
  const config = obterConfiguracao();

  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoId>(() => {
    const grupos = getGrupos();
    return grupos.length > 0 ? grupos[0].id : "";
  });
  const [aba, setAba] = useState<AbaId>("quadro");

  // Horário oficial
  const [horarios, setHorarios] = useState<HorariosPorGrupo>({});
  
  // Horário de rascunho (simulador)
  const [horariosRascunho, setHorariosRascunho] = useState<HorariosPorGrupo>(
    () => carregarHorariosRascunho()
  );
  const [modoSimulador, setModoSimulador] = useState(false);
  const [modoPublico] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("publico") === "1";
    } catch {
      return false;
    }
  });

  const [logEntries, setLogEntries] = useState<LogEntry[]>(() =>
    carregarLogLocal()
  );

  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioAtual | null>(null);
  const [professores, setProfessores] = useState<ProfessorInfo[]>(() =>
    carregarProfessores()
  );
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const menuUsuarioRef = useRef<HTMLDivElement>(null);
  const notificacoesRef = useRef<HTMLDivElement>(null);

  // Fecha os menus do topo ao clicar fora deles
  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (
        menuUsuarioRef.current &&
        !menuUsuarioRef.current.contains(event.target as Node)
      ) {
        setMenuUsuarioAberto(false);
      }
      if (
        notificacoesRef.current &&
        !notificacoesRef.current.contains(event.target as Node)
      ) {
        setNotificacoesAbertas(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);


  // Carrega horários do servidor quando usuarioAtual muda
  useEffect(() => {
    if (usuarioAtual) {
      carregarHorarios().then(setHorarios).catch(console.error);
    }
  }, [usuarioAtual]);
  
  // Verifica sessão ao montar
  useEffect(() => {
    verificarSessao().then((usuario) => {
      if (usuario) {
        setUsuarioAtual({
          nome: usuario.nome,
          perfil: usuario.perfil as Perfil,
        });
      } else {
        // Fallback para localStorage
        const local = carregarUsuario();
        if (local) {
          setUsuarioAtual(local);
        }
      }
    }).catch(() => {
      // Fallback para localStorage
      const local = carregarUsuario();
      if (local) {
        setUsuarioAtual(local);
      }
    });
  }, []);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [pwaDisponivel, setPwaDisponivel] = useState(false);

  // estado do formulário de cadastro por turma/professor
  const [turmaCadastro, setTurmaCadastro] = useState("");
  const [profCadastro, setProfCadastro] = useState("");
  const [discCadastro, setDiscCadastro] = useState("");
  const [diaCadastro, setDiaCadastro] = useState(() => {
    const dias = getDiasSemana();
    return dias.length > 0 ? dias[0] : "";
  });
  const [numAulaCadastro, setNumAulaCadastro] = useState(1);

  const [snapshots, setSnapshots] = useState<SnapshotHorario[]>([]);
  const [snapshotSelecionadoId, setSnapshotSelecionadoId] = useState<
    string | null
  >(null);

  // Carrega snapshots do servidor
  useEffect(() => {
    if (usuarioAtual) {
      apiBuscarSnapshots(50)
        .then((snaps) => {
          setSnapshots(
            snaps.map((s) => ({
              id: s.id.toString(),
              timestamp: s.criadoEm,
              usuario: `${s.usuario.nome} (${s.usuario.perfil})`,
              descricao: s.descricao || s.nome,
              horarios: s.dados,
            }))
          );
        })
        .catch(() => {
          // Fallback para localStorage
          setSnapshots(carregarSnapshots());
        });
    }
  }, [usuarioAtual]);

  const fonteHorarios = modoSimulador ? horariosRascunho : horarios;

  const horarioAtual: HorarioCompleto =
    fonteHorarios[grupoSelecionado] ||
    criarHorarioVazioParaGrupo(grupoSelecionado);

  // Não salva mais no localStorage, apenas no servidor
  // useEffect(() => {
  //   salvarHorarios(horarios);
  // }, [horarios]);

  useEffect(() => {
    salvarHorariosRascunho(horariosRascunho);
  }, [horariosRascunho]);

  useEffect(() => {
    salvarSnapshots(snapshots);
  }, [snapshots]);

  // Sempre mantém uma cópia local como backup
  useEffect(() => {
    salvarLogLocal(logEntries);
  }, [logEntries]);

  // Captura evento de instalação PWA (beforeinstallprompt)
  useEffect(() => {
    function handleBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);
      setPwaDisponivel(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // Carrega log do servidor ao iniciar o app
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(LOGS_API_URL);
        if (!resp.ok) return;
        const data = (await resp.json()) as LogEntry[];
        if (Array.isArray(data)) {
          setLogEntries(data);
        }
      } catch {
        // Se der erro, segue usando apenas o log local
      }
    })();
  }, []);

  function adicionarLog(acao: string, detalhes: string, grupoId?: GrupoId) {
    const novo: LogEntry = {
      timestamp: new Date().toISOString(),
      usuario: usuarioAtual
        ? `${usuarioAtual.nome} (${PERFIS_LABEL[usuarioAtual.perfil]})`
        : null,
      acao,
      detalhes,
      grupoId: grupoId ?? null,
    };
    setLogEntries((prev) => [...prev, novo]);

    // Envia para o servidor (melhor esforço; se falhar, o log local continua salvo)
    fetch(LOGS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    }).catch(() => {
      // Ignora erro: o log local já está registrado
    });
  }

  async function handleInstalarPWA() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setPwaDisponivel(false);
      setDeferredPrompt(null);
    }
  }

  // function atualizarAulaDireto(
  //   dia: string,
  //   slotId: number,
  //   campo: keyof AulaInfo,
  //   valor: string
  // ) {
  //   // usada só se um dia você quiser voltar a edição direta no quadro geral
  //   setHorarios((prev) => {
  //     const copia: HorariosPorGrupo = structuredClone(prev);
  //
  //     if (!copia[grupoSelecionado]) {
  //       copia[grupoSelecionado] = criarHorarioVazioParaGrupo(grupoSelecionado);
  //     }
  //
  //     const horarioGrupo = copia[grupoSelecionado];
  //     const atual = horarioGrupo[dia][slotId] || {
  //       disciplina: "",
  //       professor: "",
  //       turma: "",
  //     };
  //
  //     atual[campo] = valor;
  //     horarioGrupo[dia][slotId] = atual;
  //
  //     return copia;
  //   });
  // }

  async function limparHorarioGrupoAtual() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas usuários com perfil de Direção ou Vice-direção podem limpar o horário."
      );
      return;
    }

    if (
      confirm(
        `Deseja limpar o horário do grupo selecionado (${grupoSelecionado})?`
      )
    ) {
      try {
        // Limpa no servidor
        if (!modoSimulador) {
          await apiLimparGrupo(grupoSelecionado);
        }

        const setter = modoSimulador ? setHorariosRascunho : setHorarios;

        setter((prev) => {
          const copia: HorariosPorGrupo = structuredClone(prev);
          copia[grupoSelecionado] = criarHorarioVazioParaGrupo(grupoSelecionado);
          return copia;
        });

        adicionarLog(
          "limpar_grupo",
          `Horário do grupo ${grupoSelecionado} foi limpo.${
            modoSimulador ? " (rascunho)" : ""
          }`,
          grupoSelecionado
        );
      } catch (error) {
        console.error("Erro ao limpar grupo:", error);
        alert("Erro ao limpar grupo. Tente novamente.");
      }
    }
  }

  const slots = slotsPorGrupo[grupoSelecionado];
  const infoGrupo = grupos.find((g) => g.id === grupoSelecionado)!;
  const podeEditarAgora = podeEditar(usuarioAtual);
  const turmasDoGrupoCadastro = getTurmasPorGrupo(grupoSelecionado);
  const numerosAulaDisponiveis = Array.from(
    { length: slots.filter((s) => s.tipo === "aula").length },
    (_, i) => i + 1
  );

  // Garante que o número da aula selecionado no cadastro continue válido
  // ao trocar para um grupo com menos aulas.
  useEffect(() => {
    if (!numerosAulaDisponiveis.includes(numAulaCadastro)) {
      setNumAulaCadastro(numerosAulaDisponiveis[0] || 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoSelecionado]);

  // Grades derivadas (para quadro geral)
  const gradeProf = construirGradeProfessor(horarioAtual, slots);
  const gradeTurma = construirGradeTurma(horarioAtual, slots);

  const professoresOrdenados = Object.keys(gradeProf).sort();
  const turmasOrdenadas = Object.keys(gradeTurma).sort();

  // ---------- Relatórios de carga horária (grupo atual) ----------

  const cargaPorProfessor = professoresOrdenados.map((prof) => {
    const aulasProf = gradeProf[prof];
    let total = 0;
    diasSemana.forEach((dia) => {
      const aulasDia = aulasProf[dia] || {};
      total += Object.keys(aulasDia).length;
    });
    return { professor: prof, aulas: total };
  });

  const cargaPorTurma = turmasOrdenadas.map((turma) => {
    const aulasTurma = gradeTurma[turma];
    let total = 0;
    diasSemana.forEach((dia) => {
      const aulasDia = aulasTurma[dia] || {};
      total += Object.keys(aulasDia).length;
    });
    return { turma, aulas: total };
  });

  const cargaPorDisciplina = (() => {
    const mapa: Record<string, number> = {};
    diasSemana.forEach((dia) => {
      const linha = horarioAtual[dia];
      if (!linha) return;
      slots.forEach((slot) => {
        if (slot.tipo !== "aula") return;
        const aula = linha[slot.id];
        const disc = aula?.disciplina?.trim();
        if (!disc) return;
        if (!mapa[disc]) mapa[disc] = 0;
        mapa[disc]++;
      });
    });
    return Object.entries(mapa)
      .map(([disciplina, aulas]) => ({ disciplina, aulas }))
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  })();

  // ---------- Análises de conflitos e alertas ----------

  // Conflitos de professor em duas turmas ao mesmo tempo (considera todos os grupos)
  const conflitosProfessores = (() => {
    const mapa: Record<
      string,
      { grupo: string; turma: string; disciplina: string }[]
    > = {};

    grupos.forEach((g) => {
      const slotsGrupo = slotsPorGrupo[g.id];
      const baseHorarios = modoSimulador ? horariosRascunho : horarios;
      const horarioGrupo = baseHorarios[g.id];
      if (!horarioGrupo) return;

      diasSemana.forEach((dia) => {
        let numAula = 0;
        slotsGrupo.forEach((slot) => {
          if (slot.tipo !== "aula") return;
          numAula++;

          const aula = horarioGrupo[dia]?.[slot.id];
          if (!aula || !aula.professor) return;

          const prof = aula.professor.trim();
          if (!prof) return;

          const key = `${dia}__${numAula}__${prof}`;
          if (!mapa[key]) mapa[key] = [];
          mapa[key].push({
            grupo: g.nome,
            turma: aula.turma || "",
            disciplina: aula.disciplina || "",
          });
        });
      });
    });

    return Object.entries(mapa)
      .filter(([, lista]) => lista.length > 1)
      .map(([chave, lista]) => {
        const [dia, numAulaStr, professor] = chave.split("__");
        return {
          dia,
          numAula: Number(numAulaStr),
          professor,
          ocorrencias: lista,
        };
      });
  })();

  // Buracos e muitas aulas seguidas da mesma disciplina por turma (apenas grupo atual)
  const alertasTurmas = (() => {
    const alertas: {
      turma: string;
      mensagens: string[];
    }[] = [];

    const numAulas = slots.filter((s) => s.tipo === "aula").length;

    turmasOrdenadas.forEach((turma) => {
      const mensagens: string[] = [];

      diasSemana.forEach((dia) => {
        const aulasDia = gradeTurma[turma]?.[dia] || {};
        const vetor = Array.from({ length: numAulas }).map((_, i) => {
          const numAula = i + 1;
          return aulasDia[numAula] || null;
        });

        // Buracos: há um espaço vazio entre aulas preenchidas
        let temBuraco = false;
        for (let i = 1; i < numAulas - 1; i++) {
          if (!vetor[i]) {
            const temAntes = vetor.slice(0, i).some((v) => v);
            const temDepois = vetor.slice(i + 1).some((v) => v);
            if (temAntes && temDepois) {
              temBuraco = true;
              break;
            }
          }
        }
        if (temBuraco) {
          mensagens.push(`Dia ${dia}: há buracos entre aulas.`);
        }

        // Muitas aulas seguidas da mesma disciplina (3 ou mais)
        let disciplinaAtual = "";
        let contador = 0;
        const disciplinasRepetidas: string[] = [];

        vetor.forEach((info) => {
          const disc = info?.disciplina?.trim() || "";
          if (disc && disc === disciplinaAtual) {
            contador++;
          } else {
            if (disciplinaAtual && contador >= 3) {
              disciplinasRepetidas.push(disciplinaAtual);
            }
            disciplinaAtual = disc;
            contador = disc ? 1 : 0;
          }
        });
        if (disciplinaAtual && contador >= 3) {
          disciplinasRepetidas.push(disciplinaAtual);
        }

        disciplinasRepetidas.forEach((disc) => {
          mensagens.push(
            `Dia ${dia}: muitas aulas seguidas da disciplina "${disc}".`
          );
        });
      });

      if (mensagens.length > 0) {
        alertas.push({ turma, mensagens });
      }
    });

    return alertas;
  })();

  // Limite de 10 aulas diárias para professores que também atuam em outra
  // unidade escolar: soma as aulas desta escola (todos os grupos) com as
  // aulas informadas no cadastro de professores para a outra unidade.
  const alertasLimiteAulas = (() => {
    const baseHorarios = modoSimulador ? horariosRascunho : horarios;
    const aulasPorProfessorEDia: Record<string, Record<string, number>> = {};

    grupos.forEach((g) => {
      const slotsGrupo = slotsPorGrupo[g.id];
      const horarioGrupo = baseHorarios[g.id];
      if (!horarioGrupo || !slotsGrupo) return;

      diasSemana.forEach((dia) => {
        slotsGrupo.forEach((slot) => {
          if (slot.tipo !== "aula") return;
          const aulaInfo = horarioGrupo[dia]?.[slot.id];
          const prof = aulaInfo?.professor?.trim();
          if (!prof) return;
          const chave = prof.toLowerCase();
          if (!aulasPorProfessorEDia[chave]) aulasPorProfessorEDia[chave] = {};
          aulasPorProfessorEDia[chave][dia] =
            (aulasPorProfessorEDia[chave][dia] || 0) + 1;
        });
      });
    });

    const alertas: {
      professor: string;
      dia: string;
      aulasNestaEscola: number;
      aulasOutraUnidade: number;
      total: number;
    }[] = [];

    professores.forEach((p) => {
      if (!p.atuaOutraUnidade || !p.nome.trim()) return;
      const chave = p.nome.trim().toLowerCase();
      const porDia = aulasPorProfessorEDia[chave] || {};

      diasSemana.forEach((dia) => {
        const aulasNestaEscola = porDia[dia] || 0;
        const aulasOutraUnidade = p.horariosOutraUnidade[dia]?.aulasNoDia || 0;
        const total = aulasNestaEscola + aulasOutraUnidade;
        if (total > 10) {
          alertas.push({
            professor: p.nome,
            dia,
            aulasNestaEscola,
            aulasOutraUnidade,
            total,
          });
        }
      });
    });

    return alertas;
  })();

  const totalAlertasAutomaticos =
    conflitosProfessores.length + alertasTurmas.length + alertasLimiteAulas.length;

  // ---------- Logout ----------

  async function handleLogout() {
    const nome = usuarioAtual?.nome;
    try {
      await apiFazerLogout();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
    setUsuarioAtual(null);
    salvarUsuario(null);
    adicionarLog("logout", `Logout de "${nome ?? "usuário desconhecido"}".`);
  }

  // ---------- Ações da aba Cadastro por Turma ----------

  async function handleSalvarCadastro() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas usuários com perfil de Direção ou Vice-direção podem salvar ou alterar aulas."
      );
      return;
    }

    if (!turmaCadastro.trim() || !profCadastro.trim() || !discCadastro.trim()) {
      alert("Preencha Turma, Professor(a) e Disciplina.");
      return;
    }

    const slotId = aulaNumeroParaSlotId(slots, numAulaCadastro);
    if (!slotId) {
      alert("Número de aula inválido para este grupo.");
      return;
    }

    try {
      // Salva no servidor
      if (!modoSimulador) {
        await apiSalvarHorario(
          grupoSelecionado,
          diaCadastro,
          slotId,
          discCadastro.trim(),
          profCadastro.trim(),
          turmaCadastro.trim()
        );
      }

      const setter = modoSimulador ? setHorariosRascunho : setHorarios;

      setter((prev) => {
        const copia: HorariosPorGrupo = structuredClone(prev);

        if (!copia[grupoSelecionado]) {
          copia[grupoSelecionado] = criarHorarioVazioParaGrupo(grupoSelecionado);
        }

        const horarioGrupo = copia[grupoSelecionado];
        const atual = horarioGrupo[diaCadastro][slotId] || {
          disciplina: "",
          professor: "",
          turma: "",
        };

        atual.turma = turmaCadastro.trim();
        atual.professor = profCadastro.trim();
        atual.disciplina = discCadastro.trim();

        horarioGrupo[diaCadastro][slotId] = atual;

        return copia;
      });

      adicionarLog("salvar_aula", `Aula salva: turma=${turmaCadastro.trim()}, prof=${profCadastro.trim()}, disc=${discCadastro.trim()}, dia=${diaCadastro}, aula=${numAulaCadastro}, grupo=${grupoSelecionado}.`, grupoSelecionado);
    } catch (error) {
      console.error("Erro ao salvar horário:", error);
      alert("Erro ao salvar horário. Tente novamente.");
    }
  }

  async function handleLimparCadastroCampo() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas usuários com perfil de Direção ou Vice-direção podem limpar este horário."
      );
      return;
    }

    const slotId = aulaNumeroParaSlotId(slots, numAulaCadastro);
    if (!slotId) {
      alert("Número de aula inválido para este grupo.");
      return;
    }

    try {
      // Limpa no servidor
      if (!modoSimulador) {
        await apiLimparHorario(grupoSelecionado, diaCadastro, slotId);
      }

      const setter = modoSimulador ? setHorariosRascunho : setHorarios;

      setter((prev) => {
        const copia: HorariosPorGrupo = structuredClone(prev);

        if (!copia[grupoSelecionado]) return prev;

        const horarioGrupo = copia[grupoSelecionado];
        horarioGrupo[diaCadastro][slotId] = null;

        return copia;
      });

      adicionarLog(
        "limpar_aula",
        `Horário limpo: dia=${diaCadastro}, aula=${numAulaCadastro}, grupo=${grupoSelecionado}.${
          modoSimulador ? " (rascunho)" : ""
        }`,
        grupoSelecionado
      );
    } catch (error) {
      console.error("Erro ao limpar horário:", error);
      alert("Erro ao limpar horário. Tente novamente.");
    }
  }

  // ---------- Exportar log como arquivo ----------

  function handleExportarLog() {
    if (logEntries.length === 0) {
      alert("Ainda não há registros no log.");
      return;
    }

    const conteudo = JSON.stringify(logEntries, null, 2);
    const blob = new Blob([conteudo], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "horario-escolar-log.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Snapshots (versões do horário) ----------

  async function handleSalvarSnapshot() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas Direção ou Vice-direção podem salvar versões do horário."
      );
      return;
    }

    const descricao = prompt(
      "Descrição desta versão (ex.: Horário final de março):"
    );
    if (descricao === null) return;

    const nome = descricao.trim() || `Versão ${new Date().toLocaleString("pt-BR")}`;

    try {
      await apiCriarSnapshot(nome, descricao.trim() || null, structuredClone(horarios));
      
      // Atualiza lista local
      const novosSnapshots = await apiBuscarSnapshots(50);
      setSnapshots(
        novosSnapshots.map((s) => ({
          id: s.id.toString(),
          timestamp: s.criadoEm,
          usuario: `${s.usuario.nome} (${s.usuario.perfil})`,
          descricao: s.descricao || s.nome,
          horarios: s.dados,
        }))
      );

      adicionarLog(
        "snapshot_criado",
        `Snapshot salvo: "${nome}" por ${usuarioAtual.nome}.`
      );
      alert("Versão salva com sucesso!");
    } catch (error: any) {
      alert(`Erro ao salvar versão: ${error.message}`);
    }
  }

  async function handleRestaurarSnapshot() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas Direção ou Vice-direção podem restaurar versões do horário."
      );
      return;
    }
    if (!snapshotSelecionadoId) {
      alert("Selecione uma versão do horário para restaurar.");
      return;
    }

    try {
      const snap = await apiBuscarSnapshot(parseInt(snapshotSelecionadoId));
      
      if (
        !confirm(
          `Tem certeza que deseja restaurar a versão "${snap.descricao || snap.nome}"? Isso substituirá o horário atual de todos os grupos.`
        )
      ) {
        return;
      }

      setHorarios(structuredClone(snap.dados));
      
      // Salva cada horário no servidor
      for (const [grupoId, horarioGrupo] of Object.entries(snap.dados)) {
        for (const [dia, slots] of Object.entries(horarioGrupo)) {
          for (const [slotIdStr, aula] of Object.entries(slots)) {
            const slotId = parseInt(slotIdStr);
            if (aula) {
              await apiSalvarHorario(
                grupoId,
                dia,
                slotId,
                aula.disciplina,
                aula.professor,
                aula.turma
              );
            }
          }
        }
      }

      adicionarLog(
        "snapshot_restaurado",
        `Snapshot restaurado: "${snap.descricao || snap.nome}" (salvo em ${new Date(
          snap.criadoEm
        ).toLocaleString("pt-BR")}).`
      );
      alert("Versão restaurada com sucesso!");
    } catch (error: any) {
      alert(`Erro ao restaurar versão: ${error.message}`);
    }
  }

  function obterDiferencasComSnapshotSelecionado() {
    if (!snapshotSelecionadoId) return [];
    const snap = snapshots.find((s) => s.id === snapshotSelecionadoId);
    if (!snap) return [];

    const diffs: {
      dia: string;
      aula: number;
      campo: "turma" | "disciplina" | "professor";
      de: string;
      para: string;
    }[] = [];

    const horarioSnap = snap.horarios[grupoSelecionado] || {};
    const horarioAtualGrupo = horarioAtual;

    diasSemana.forEach((dia) => {
      const slotsDiaSnap = horarioSnap[dia] || {};
      const slotsDiaAtual = horarioAtualGrupo[dia] || {};

      let numAula = 0;
      slots.forEach((slot) => {
        if (slot.tipo !== "aula") return;
        numAula++;
        const aSnap = slotsDiaSnap[slot.id] || null;
        const aAtual = slotsDiaAtual[slot.id] || null;

        (["turma", "disciplina", "professor"] as const).forEach((campo) => {
          const vSnap = aSnap?.[campo] || "";
          const vAtual = aAtual?.[campo] || "";
          if (vSnap !== vAtual) {
            diffs.push({
              dia,
              aula: numAula,
              campo,
              de: vSnap,
              para: vAtual,
            });
          }
        });
      });
    });

    return diffs;
  }

  const diferencasSnapshot = obterDiferencasComSnapshotSelecionado();

  // Estados para exportação específica
  const [professorExport, setProfessorExport] = useState<string>("");
  const [turmaExport, setTurmaExport] = useState<string>("");

  // Estados de filtro de log
  const [filtroUsuario, setFiltroUsuario] = useState<string>("");
  const [filtroAcao, setFiltroAcao] = useState<string>("");
  const [filtroGrupoId, setFiltroGrupoId] = useState<string>("");
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>("");
  const [filtroDataFim, setFiltroDataFim] = useState<string>("");

  // Busca rápida no quadro
  const [termoBusca, setTermoBusca] = useState<string>("");

  // Tema e acessibilidade
  const [temaEscuro, setTemaEscuro] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });
  const [escalaFonte, setEscalaFonte] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(FONT_KEY));
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  });

  function correspondeBusca(texto?: string | null) {
    if (!termoBusca.trim()) return false;
    if (!texto) return false;
    return texto.toLowerCase().includes(termoBusca.trim().toLowerCase());
  }

  // Aplicar tema e escala de fonte globais
  useEffect(() => {
    if (temaEscuro) {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
    try {
      localStorage.setItem(THEME_KEY, temaEscuro ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [temaEscuro]);

  useEffect(() => {
    const base = 16; // px
    const novo = Math.max(12, Math.min(20, base + escalaFonte * 2));
    document.documentElement.style.fontSize = `${novo}px`;
    try {
      localStorage.setItem(FONT_KEY, String(escalaFonte));
    } catch {
      // ignore
    }
  }, [escalaFonte]);

  function ajustarFonte(delta: number) {
    setEscalaFonte((prev) => {
      const novo = prev + delta;
      if (novo > 2) return 2;
      if (novo < -2) return -2;
      return novo;
    });
  }

  // ---------- Exportações por professor / turma ----------

  function gerarCSV(conteudo: string, nomeArquivo: string) {
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarProfessorCSV() {
    if (!professorExport) {
      alert("Selecione um professor para exportar.");
      return;
    }
    const prof = professorExport;
    const linhas: string[] = [];
    linhas.push("Professor,Dia,Aula,Turma,Disciplina,Grupo");

    const aulasProf = gradeProf[prof] || {};
    diasSemana.forEach((dia) => {
      const aulasDia = aulasProf[dia] || {};
      Array.from({ length: 6 }).forEach((_, i) => {
        const numAula = i + 1;
        const info = aulasDia[numAula];
        if (!info) return;
        linhas.push(
          `"${prof}","${dia}",${numAula},"${info.turma.replace(
            /"/g,
            '""'
          )}","${info.disciplina.replace(/"/g, '""')}","${infoGrupo.nome}"`
        );
      });
    });

    gerarCSV(linhas.join("\n"), `horario-professor-${prof}.csv`);
  }

  function exportarTurmaCSV() {
    if (!turmaExport) {
      alert("Selecione uma turma para exportar.");
      return;
    }
    const turma = turmaExport;
    const linhas: string[] = [];
    linhas.push("Turma,Dia,Aula,Professor,Disciplina,Grupo");

    const aulasTurma = gradeTurma[turma] || {};
    diasSemana.forEach((dia) => {
      const aulasDia = aulasTurma[dia] || {};
      Array.from({ length: 6 }).forEach((_, i) => {
        const numAula = i + 1;
        const info = aulasDia[numAula];
        if (!info) return;
        linhas.push(
          `"${turma}","${dia}",${numAula},"${info.professor.replace(
            /"/g,
            '""'
          )}","${info.disciplina.replace(
            /"/g,
            '""'
          )}","${infoGrupo.nome}"`
        );
      });
    });

    gerarCSV(linhas.join("\n"), `horario-turma-${turma}.csv`);
  }

  function abrirJanelaImpressao(html: string, titulo: string) {
    const novaJanela = window.open("", "_blank");
    if (!novaJanela) return;
    novaJanela.document.write(`
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${titulo}</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
            h1 { font-size: 18px; margin-bottom: 8px; }
            h2 { font-size: 14px; margin-top: 0; margin-bottom: 16px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
            th { background: #f3f4f6; }
            tr:nth-child(odd) td { background: #f9fafb; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    novaJanela.document.close();
    novaJanela.focus();
    novaJanela.print();
  }

  function abrirJanelaCartaoImpressao(html: string, titulo: string) {
    const novaJanela = window.open("", "_blank");
    if (!novaJanela) return;
    novaJanela.document.write(`
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${titulo}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 12px;
              display: flex;
              justify-content: center;
            }
            .card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 8px 10px;
              max-width: 420px;
              width: 100%;
            }
            h1 {
              font-size: 16px;
              margin: 0 0 4px 0;
            }
            h2 {
              font-size: 12px;
              margin: 0 0 8px 0;
              color: #4b5563;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 2px 4px;
              text-align: center;
            }
            th {
              background: #f3f4f6;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${html}
          </div>
        </body>
      </html>
    `);
    novaJanela.document.close();
    novaJanela.focus();
    novaJanela.print();
  }

  function exportarProfessorPDF() {
    if (!professorExport) {
      alert("Selecione um professor para gerar o PDF.");
      return;
    }
    const prof = professorExport;
    const aulasProf = gradeProf[prof] || {};

    let html = `<h1>Horário do professor(a) ${prof}</h1>`;
    html += `<h2>Grupo: ${infoGrupo.nome} – ${infoGrupo.descricao}</h2>`;
    html += `<table><thead><tr><th>Dia</th><th>Aula</th><th>Turma</th><th>Disciplina</th></tr></thead><tbody>`;

    diasSemana.forEach((dia) => {
      const aulasDia = aulasProf[dia] || {};
      Array.from({ length: 6 }).forEach((_, i) => {
        const numAula = i + 1;
        const info = aulasDia[numAula];
        if (!info) return;
        html += `<tr>
          <td>${dia}</td>
          <td>${numAula}ª</td>
          <td>${info.turma || ""}</td>
          <td>${info.disciplina || ""}</td>
        </tr>`;
      });
    });

    html += "</tbody></table>";
    abrirJanelaImpressao(html, `Horario-prof-${prof}`);
  }

  function exportarTurmaPDF() {
    if (!turmaExport) {
      alert("Selecione uma turma para gerar o PDF.");
      return;
    }
    const turma = turmaExport;
    const aulasTurma = gradeTurma[turma] || {};

    let html = `<h1>Horário da turma ${turma}</h1>`;
    html += `<h2>Grupo: ${infoGrupo.nome} – ${infoGrupo.descricao}</h2>`;
    html += `<table><thead><tr><th>Dia</th><th>Aula</th><th>Professor(a)</th><th>Disciplina</th></tr></thead><tbody>`;

    diasSemana.forEach((dia) => {
      const aulasDia = aulasTurma[dia] || {};
      Array.from({ length: 6 }).forEach((_, i) => {
        const numAula = i + 1;
        const info = aulasDia[numAula];
        if (!info) return;
        html += `<tr>
          <td>${dia}</td>
          <td>${numAula}ª</td>
          <td>${info.professor || ""}</td>
          <td>${info.disciplina || ""}</td>
        </tr>`;
      });
    });

    html += "</tbody></table>";
    abrirJanelaImpressao(html, `Horario-turma-${turma}`);
  }

  function exportarProfessorCartaoPDF() {
    if (!professorExport) {
      alert("Selecione um professor para gerar o cartão.");
      return;
    }
    const prof = professorExport;
    const aulasProf = gradeProf[prof] || {};

    let html = `<h1>Professor(a): ${prof}</h1>`;
    html += `<h2>${infoGrupo.nome} – ${infoGrupo.descricao}</h2>`;
    html += `<table><thead><tr><th>Dia</th>`;
    for (let i = 1; i <= 6; i++) {
      html += `<th>${i}ª</th>`;
    }
    html += `</tr></thead><tbody>`;

    diasSemana.forEach((dia) => {
      const aulasDia = aulasProf[dia] || {};
      html += `<tr><td>${dia}</td>`;
      for (let i = 1; i <= 6; i++) {
        const info = aulasDia[i];
        let texto = "";
        if (info) {
          texto = info.disciplina || "";
          if (info.turma) {
            texto += texto ? ` (${info.turma})` : info.turma;
          }
        }
        html += `<td>${texto || "-"}</td>`;
      }
      html += `</tr>`;
    });

    html += "</tbody></table>";
    abrirJanelaCartaoImpressao(html, `Cartao-prof-${prof}`);
  }

  function exportarTurmaCartaoPDF() {
    if (!turmaExport) {
      alert("Selecione uma turma para gerar o cartão.");
      return;
    }
    const turma = turmaExport;
    const aulasTurma = gradeTurma[turma] || {};

    let html = `<h1>Turma: ${turma}</h1>`;
    html += `<h2>${infoGrupo.nome} – ${infoGrupo.descricao}</h2>`;
    html += `<table><thead><tr><th>Dia</th>`;
    for (let i = 1; i <= 6; i++) {
      html += `<th>${i}ª</th>`;
    }
    html += `</tr></thead><tbody>`;

    diasSemana.forEach((dia) => {
      const aulasDia = aulasTurma[dia] || {};
      html += `<tr><td>${dia}</td>`;
      for (let i = 1; i <= 6; i++) {
        const info = aulasDia[i];
        let texto = "";
        if (info) {
          texto = info.disciplina || "";
          if (info.professor) {
            texto += texto ? ` (${info.professor})` : info.professor;
          }
        }
        html += `<td>${texto || "-"}</td>`;
      }
      html += `</tr>`;
    });

    html += "</tbody></table>";
    abrirJanelaCartaoImpressao(html, `Cartao-turma-${turma}`);
  }

  function handleSinalizarConflitoProfessor(conflito: {
    dia: string;
    numAula: number;
    professor: string;
    ocorrencias: { grupo: string; turma: string; disciplina: string }[];
  }) {
    if (!usuarioAtual || usuarioAtual.perfil !== "goe") {
      alert("Apenas usuários com perfil GOE podem sinalizar incompatibilidade de horário.");
      return;
    }

    const detalhesExtras =
      prompt(
        "Descreva rapidamente a incompatibilidade (opcional, pode deixar em branco):"
      ) || "";

    const resumoOcorrencias = conflito.ocorrencias
      .map(
        (o) =>
          `${o.turma || "turma não informada"} – ${o.disciplina || "disciplina não informada"} (${o.grupo})`
      )
      .join(" / ");

    adicionarLog(
      "goe_incompatibilidade",
      `GOE sinalizou incompatibilidade: professor=${conflito.professor}, dia=${conflito.dia}, aula=${conflito.numAula}ª, ocorrências=[${resumoOcorrencias}]${
        detalhesExtras ? `, observação="${detalhesExtras}"` : ""
      }.`
    );
    alert("Incompatibilidade registrada no log pelo GOE.");
  }

  // ---------- Simulador: aplicar rascunho no horário oficial ----------

  function handleAlternarSimulador() {
    if (!modoSimulador) {
      // ao ativar pela primeira vez, se o rascunho estiver "vazio", copia do oficial
      const algumPreenchido = Object.values(horariosRascunho).some(
        (h) => h && Object.keys(h).length > 0
      );
      if (!algumPreenchido) {
        setHorariosRascunho(structuredClone(horarios));
      }
    }
    setModoSimulador((prev) => !prev);
  }

  function handleAplicarRascunho() {
    if (!usuarioAtual || !podeEditar(usuarioAtual) || modoPublico) {
      alert(
        "Apenas Direção ou Vice-direção podem aplicar o rascunho ao horário oficial."
      );
      return;
    }

    if (
      !confirm(
        "Tem certeza que deseja aplicar o horário de rascunho como horário oficial para todos os grupos?"
      )
    ) {
      return;
    }

    setHorarios(structuredClone(horariosRascunho));
    setModoSimulador(false);
    adicionarLog(
      "simulador_aplicar",
      "Horário de rascunho aplicado como horário oficial para todos os grupos."
    );
  }

  // ---------- Filtros e export do log ----------

  const usuariosLog = Array.from(
    new Set(logEntries.map((l) => l.usuario || "—"))
  ).sort();
  const acoesLog = Array.from(new Set(logEntries.map((l) => l.acao))).sort();

  const logsFiltrados = logEntries.filter((log) => {
    if (filtroUsuario && (log.usuario || "—") !== filtroUsuario) return false;
    if (filtroAcao && log.acao !== filtroAcao) return false;
    if (filtroGrupoId) {
      if (!log.grupoId || log.grupoId !== (filtroGrupoId as GrupoId)) {
        return false;
      }
    }
    if (filtroDataInicio) {
      const dataLog = new Date(log.timestamp).toISOString().slice(0, 10);
      if (dataLog < filtroDataInicio) return false;
    }
    if (filtroDataFim) {
      const dataLog = new Date(log.timestamp).toISOString().slice(0, 10);
      if (dataLog > filtroDataFim) return false;
    }
    return true;
  });

  function exportarLogCSV() {
    if (logsFiltrados.length === 0) {
      alert("Não há registros no log com os filtros atuais.");
      return;
    }
    const linhas: string[] = [];
    linhas.push("Data/Hora,Usuário,Ação,Grupo,Detalhes");

    logsFiltrados.forEach((log) => {
      const grupoLabel = log.grupoId
        ? grupos.find((g) => g.id === log.grupoId)?.nome ?? log.grupoId
        : "";
      linhas.push(
        `"${new Date(log.timestamp).toLocaleString("pt-BR")}","${
          (log.usuario || "—").replace(/"/g, '""')
        }","${log.acao.replace(/"/g, '""')}","${grupoLabel.replace(
          /"/g,
          '""'
        )}","${log.detalhes.replace(/"/g, '""')}"`
      );
    });

    gerarCSV(linhas.join("\n"), "log-horario-escolar.csv");
  }

  function exportarLogPDF() {
    if (logsFiltrados.length === 0) {
      alert("Não há registros no log com os filtros atuais.");
      return;
    }

    let html = `<h1>Log de alterações do horário</h1>`;
    html += `<h2>Total de registros: ${logsFiltrados.length}</h2>`;
    html += `<table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Grupo</th><th>Detalhes</th></tr></thead><tbody>`;

    logsFiltrados.forEach((log) => {
      const grupoLabel = log.grupoId
        ? grupos.find((g) => g.id === log.grupoId)?.nome ?? log.grupoId
        : "";
      html += `<tr>
        <td>${new Date(log.timestamp).toLocaleString("pt-BR")}</td>
        <td>${log.usuario ?? "—"}</td>
        <td>${log.acao}</td>
        <td>${grupoLabel}</td>
        <td>${log.detalhes}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    abrirJanelaImpressao(html, "log-horario-escolar");
  }

  // ---------- Render ----------

  // Se não estiver logado e não for modo público, mostra tela de autenticação
  if (!usuarioAtual && !modoPublico) {
    return (
      <AuthScreen
        onLogin={(nome, perfil) => {
          const usuario: UsuarioAtual = { nome, perfil };
          setUsuarioAtual(usuario);
          salvarUsuario(usuario);
          adicionarLog(
            "login",
            `Login efetuado por "${nome}" como ${PERFIS_LABEL[perfil as Perfil]}.`
          );
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        abaAtiva={aba}
        horarioAtivo={HORARIO_TABS.includes(aba)}
        onPainelPrincipal={() => setAba("dashboard")}
        onHorarioDeAulas={() => setAba("quadro")}
        onConfiguracao={() => setAba("configuracao")}
        onProfessores={() => setAba("professores")}
        onUsuarios={() => setAba("usuarios")}
        podeConfigurar={podeEditar(usuarioAtual)}
        usuarioNome={usuarioAtual?.nome}
        usuarioPerfilLabel={
          usuarioAtual ? PERFIS_LABEL[usuarioAtual.perfil] : undefined
        }
      />

      <div className="app-shell-main">
        {/* Cabeçalho */}
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-header-icon">
              <Buildings size={20} weight="duotone" />
            </span>
            <div>
              <div className="app-header-title">
                {config.nomeEscola || "Secretaria da Educação do Estado de São Paulo"}
              </div>
              <div className="app-header-subtitle">
                Sistema de Organização de Horário – Manhã, Tarde e Noite
              </div>
            </div>
            <span className="app-header-badge">
              <span className="app-header-badge-dot" />
              Uso interno – Gestão Escolar
            </span>
          </div>

          <div className="topbar-actions">
            {!modoPublico && usuarioAtual && (
              <div className="notif-wrapper" ref={notificacoesRef}>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Notificações"
                  onClick={() => setNotificacoesAbertas((v) => !v)}
                >
                  <Bell size={19} />
                  {totalAlertasAutomaticos > 0 && (
                    <span className="icon-button-badge">
                      {totalAlertasAutomaticos}
                    </span>
                  )}
                </button>
                {notificacoesAbertas && (
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-title">Alertas automáticos</div>
                    {totalAlertasAutomaticos === 0 ? (
                      <p className="notif-empty">Nenhum alerta no momento.</p>
                    ) : (
                      <ul className="notif-list">
                        {conflitosProfessores.slice(0, 3).map((c, idx) => (
                          <li key={"conf-" + idx}>
                            <WarningCircle size={15} weight="fill" />
                            <span>
                              {c.professor} em duas turmas – {c.dia}, {c.numAula}ª aula
                            </span>
                          </li>
                        ))}
                        {alertasTurmas.slice(0, 3).map((a, idx) => (
                          <li key={"turma-" + idx}>
                            <WarningCircle size={15} weight="fill" />
                            <span>
                              {a.turma}: {a.mensagens[0]}
                            </span>
                          </li>
                        ))}
                        {alertasLimiteAulas.slice(0, 3).map((a, idx) => (
                          <li key={"limite-" + idx}>
                            <WarningCircle size={15} weight="fill" />
                            <span>
                              {a.professor} ultrapassa 10 aulas/dia – {a.dia} ({a.total} aulas)
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="notif-dropdown-link"
                      onClick={() => {
                        setAba("quadro");
                        setNotificacoesAbertas(false);
                      }}
                    >
                      Ver todos os alertas
                    </button>
                  </div>
                )}
              </div>
            )}

            {modoPublico ? (
              <span className="login-user">
                Modo público – apenas leitura (sem login).
              </span>
            ) : usuarioAtual ? (
              <div className="user-menu-wrapper" ref={menuUsuarioRef}>
                <button
                  type="button"
                  className="user-chip"
                  onClick={() => setMenuUsuarioAberto((v) => !v)}
                >
                  <span className="user-chip-avatar">
                    {iniciaisUsuario(usuarioAtual.nome)}
                  </span>
                  <span className="user-chip-text">
                    <span className="user-chip-name">{usuarioAtual.nome}</span>
                    <span className="user-chip-role">
                      {PERFIS_LABEL[usuarioAtual.perfil]}
                    </span>
                  </span>
                  <CaretDown size={13} />
                </button>
                {menuUsuarioAberto && (
                  <div className="user-menu-dropdown">
                    <button
                      type="button"
                      className="user-menu-item"
                      onClick={handleLogout}
                    >
                      <SignOut size={16} />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </header>

      {/* Conteúdo */}
      <main className="app-main">
        <div className="app-content">
          {/* Barra superior */}
          {HORARIO_TABS.includes(aba) && (
          <div className="app-toolbar">
            <div className="app-toolbar-left">
              <div className="app-toolbar-title">Horário de Aulas</div>
              <div className="app-toolbar-text">
                Organização de horários por grupo de turmas e período.{" "}
                {modoSimulador && (
                  <span style={{ color: "#b45309", fontWeight: 600 }}>
                    (VISUALIZANDO RASCUNHO)
                  </span>
                )}
              </div>

              <div className="info-banner">
                <Info size={17} weight="fill" />
                <span>
                  Grupo atual: <strong>{infoGrupo.nome}</strong> – {infoGrupo.descricao}
                </span>
              </div>

              {/* Abas */}
              <div className="tab-bar">
                <button
                  className={
                    "tab-button " + (aba === "quadro" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("quadro")}
                >
                  Quadro geral
                </button>
                {podeEditarAgora && (
                  <button
                    className={
                      "tab-button " +
                      (aba === "cadastro" ? "tab-button-active" : "")
                    }
                    onClick={() => setAba("cadastro")}
                  >
                    Cadastro por turma / professor
                  </button>
                )}
                <button
                  className={
                    "tab-button " + (aba === "grades" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("grades")}
                >
                  Grades por professor / turma
                </button>
                <button
                  className={
                    "tab-button " +
                    (aba === "relatorios" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("relatorios")}
                >
                  Relatórios de carga horária
                </button>
                <button
                  className={
                    "tab-button " +
                    (aba === "historico" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("historico")}
                >
                  📜 Histórico
                </button>
                <button
                  className={
                    "tab-button " +
                    (aba === "exportacao" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("exportacao")}
                >
                  💾 Exportar/Importar
                </button>
              </div>
            </div>

            <div className="app-toolbar-group">
              {pwaDisponivel && (
                <button
                  className="button-secondary"
                  style={{ marginRight: "0.5rem" }}
                  onClick={handleInstalarPWA}
                >
                  📲 Instalar aplicativo
                </button>
              )}
              <label htmlFor="grupo-select" style={{ fontSize: "0.85rem" }}>
                Grupo de turmas:
              </label>
              <select
                id="grupo-select"
                className="app-select"
                value={grupoSelecionado}
                onChange={(e) => setGrupoSelecionado(e.target.value as GrupoId)}
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>

              <input
                className="login-input"
                placeholder="Buscar professor / turma / disciplina"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                style={{ marginLeft: "0.75rem", minWidth: "220px" }}
              />

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  marginLeft: "0.75rem",
                  fontSize: "0.75rem",
                }}
              >
                <button
                  className="button-secondary"
                  style={{ paddingInline: "0.6rem" }}
                  onClick={() => setTemaEscuro((prev) => !prev)}
                >
                  {temaEscuro ? "☀️ Claro" : "🌙 Escuro"}
                </button>
                <button
                  className="button-secondary"
                  style={{ paddingInline: "0.5rem" }}
                  onClick={() => ajustarFonte(1)}
                >
                  A+
                </button>
                <button
                  className="button-secondary"
                  style={{ paddingInline: "0.5rem" }}
                  onClick={() => ajustarFonte(-1)}
                >
                  A-
                </button>
              </div>

              {podeEditarAgora && (
                <>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      marginLeft: "0.75rem",
                      fontSize: "0.75rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={modoSimulador}
                      onChange={handleAlternarSimulador}
                    />
                    Usar rascunho (simulador)
                  </label>
                  {modoSimulador && (
                    <button
                      className="button-danger"
                      style={{ marginLeft: "0.5rem", paddingInline: "0.7rem" }}
                      onClick={handleAplicarRascunho}
                    >
                      ⏩ Aplicar rascunho
                    </button>
                  )}

                  {/* Controle de versões do horário (snapshots) */}
                  <select
                    className="app-select"
                    style={{ marginLeft: "0.5rem" }}
                    value={snapshotSelecionadoId ?? ""}
                    onChange={(e) =>
                      setSnapshotSelecionadoId(e.target.value || null)
                    }
                  >
                    <option value="">
                      Versões salvas ({snapshots.length})
                    </option>
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.timestamp).toLocaleString("pt-BR")} –{" "}
                        {s.descricao}
                      </option>
                    ))}
                  </select>
                  <button
                    className="button-primary"
                    style={{ marginLeft: "0.25rem" }}
                    onClick={handleSalvarSnapshot}
                  >
                    💾 Salvar versão
                  </button>
                  <button
                    className="button-danger"
                    style={{ marginLeft: "0.25rem", paddingInline: "0.7rem" }}
                    onClick={handleRestaurarSnapshot}
                  >
                    ⏪ Restaurar
                  </button>
                </>
              )}
            </div>
          </div>
          )}

          {/* ---------- ABA DASHBOARD ---------- */}
          {aba === "dashboard" && (
            <Dashboard horarios={horarios} />
          )}

          {/* ---------- ABA QUADRO GERAL (somente leitura) ---------- */}
          {aba === "quadro" && (
            <>
              {/* Tabela principal por dia x horário */}
              <div className="horario-wrapper">
                <table className="horario-table">
                  <thead>
                    <tr>
                      <th className="horario-col-horario">Horário</th>
                      {diasSemana.map((dia) => (
                        <th key={dia}>{dia}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td className="horario-col-horario">{slot.label}</td>

                        {diasSemana.map((dia) => {
                          if (slot.tipo === "intervalo") {
                            return (
                              <td
                                key={dia}
                                className="horario-slot-intervalo"
                              >
                                Intervalo
                              </td>
                            );
                          }

                          const aula = horarioAtual[dia][slot.id];
                          const destacado =
                            aula &&
                            (correspondeBusca(aula.turma) ||
                              correspondeBusca(aula.disciplina) ||
                              correspondeBusca(aula.professor));

                          return (
                            <td
                              key={dia}
                              className={
                                "horario-slot-aula" +
                                (destacado ? " horario-highlight" : "")
                              }
                            >
                              {aula ? (
                                <>
                                  {aula.turma && (
                                    <div className="quadro-linha">
                                      <strong>{aula.turma}</strong>
                                    </div>
                                  )}
                                  {aula.disciplina && (
                                    <div className="quadro-linha">
                                      {aula.disciplina}
                                    </div>
                                  )}
                                  {aula.professor && (
                                    <div className="quadro-linha quadro-prof">
                                      {aula.professor}
                                    </div>
                                  )}
                                  {!aula.turma &&
                                    !aula.disciplina &&
                                    !aula.professor && (
                                      <span className="quadro-vazio">—</span>
                                    )}
                                </>
                              ) : (
                                <span className="quadro-vazio">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ações */}
              <div className="app-actions" style={{ gap: "0.5rem" }}>
                {podeEditarAgora && (
                  <button
                    className="button-danger"
                    onClick={limparHorarioGrupoAtual}
                  >
                    <span className="button-danger-icon">🧹</span>
                    Limpar horário do grupo
                  </button>
                )}

                <button
                  className="button-danger"
                  style={{ background: "#1d4ed8" }}
                  onClick={() => window.print()}
                >
                  <span className="button-danger-icon">🖨️</span>
                  Gerar PDF do quadro
                </button>

                <button
                  className="button-primary"
                  onClick={handleExportarLog}
                >
                  <span>📄</span>
                  Exportar log (JSON)
                </button>
              </div>

              {/* Exportações específicas por professor / turma */}
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ fontWeight: 500 }}>Exportar por professor:</span>
                <select
                  className="app-select"
                  value={professorExport}
                  onChange={(e) => setProfessorExport(e.target.value)}
                >
                  <option value="">Selecione um professor</option>
                  {professoresOrdenados.map((prof) => (
                    <option key={prof} value={prof}>
                      {prof}
                    </option>
                  ))}
                </select>
                <button
                  className="button-primary"
                  onClick={exportarProfessorPDF}
                >
                  🖨️ PDF
                </button>
                <button
                  className="button-primary"
                  onClick={exportarProfessorCartaoPDF}
                >
                  🪪 Cartão
                </button>
                <button className="button-primary" onClick={exportarProfessorCSV}>
                  📊 CSV/Excel
                </button>

                <span
                  style={{
                    fontWeight: 500,
                    marginLeft: "1rem",
                  }}
                >
                  Exportar por turma:
                </span>
                <select
                  className="app-select"
                  value={turmaExport}
                  onChange={(e) => setTurmaExport(e.target.value)}
                >
                  <option value="">Selecione uma turma</option>
                  {turmasOrdenadas.map((turma) => (
                    <option key={turma} value={turma}>
                      {turma}
                    </option>
                  ))}
                </select>
                <button className="button-primary" onClick={exportarTurmaPDF}>
                  🖨️ PDF
                </button>
                <button
                  className="button-primary"
                  onClick={exportarTurmaCartaoPDF}
                >
                  🪪 Cartão
                </button>
                <button className="button-primary" onClick={exportarTurmaCSV}>
                  📊 CSV/Excel
                </button>
              </div>

              {/* Alertas de conflitos e qualidade do horário */}
              <section style={{ marginTop: "1.75rem" }}>
                <h2 className="section-title">Alertas automáticos</h2>
                <div className="alert-cards">
                  <div className="alert-card">
                    <span className="alert-card-icon alert-card-icon-danger">
                      <UsersThree size={20} weight="fill" />
                    </span>
                    <div className="alert-card-body">
                    <h3>Professores em duas turmas ao mesmo tempo</h3>
                    {conflitosProfessores.length === 0 ? (
                      <p className="alert-card-ok-text">
                        Nenhum conflito de professor encontrado entre grupos.
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                        {conflitosProfessores.map((c, idx) => (
                          <li key={idx}>
                            {c.professor} – {c.dia}, {c.numAula}ª aula:{" "}
                            {c.ocorrencias
                              .map(
                                (o) =>
                                  `${o.turma || "turma não informada"} (${o.grupo})`
                              )
                              .join(" / ")}
                            {usuarioAtual?.perfil === "goe" && (
                              <button
                                className="button-primary"
                                style={{
                                  marginLeft: "0.35rem",
                                  paddingInline: "0.5rem",
                                  fontSize: "0.7rem",
                                }}
                                onClick={() =>
                                  handleSinalizarConflitoProfessor(c)
                                }
                              >
                                ⚠️ Sinalizar incompatibilidade
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  </div>

                  <div className="alert-card">
                    <span className="alert-card-icon alert-card-icon-warning">
                      <WarningCircle size={20} weight="fill" />
                    </span>
                    <div className="alert-card-body">
                    <h3>Buracos e excesso de aulas seguidas por turma (grupo atual)</h3>
                    {alertasTurmas.length === 0 ? (
                      <p className="alert-card-ok-text">
                        Nenhum buraco ou sequência excessiva encontrado neste
                        grupo.
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                        {alertasTurmas.map((a, idx) => (
                          <li key={idx}>
                            <strong>{a.turma}:</strong>{" "}
                            {a.mensagens.join(" ")}
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  </div>

                  <div className="alert-card">
                    <span className="alert-card-icon alert-card-icon-danger">
                      <Clock size={20} weight="fill" />
                    </span>
                    <div className="alert-card-body">
                    <h3>Limite de 10 aulas diárias (docentes em outra unidade)</h3>
                    {alertasLimiteAulas.length === 0 ? (
                      <p className="alert-card-ok-text">
                        Nenhum docente com acúmulo de outra unidade ultrapassando
                        10 aulas em um mesmo dia.
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                        {alertasLimiteAulas.map((a, idx) => (
                          <li key={idx}>
                            <strong>{a.professor}</strong> – {a.dia}:{" "}
                            {a.aulasNestaEscola} aula(s) nesta escola +{" "}
                            {a.aulasOutraUnidade} na outra unidade ={" "}
                            {a.total} aulas.
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Diferenças entre horário atual e versão selecionada */}
              {snapshotSelecionadoId && (
                <section style={{ marginTop: "1.5rem" }}>
                  <h2 className="section-title">
                    Comparação – horário atual x versão selecionada (grupo{" "}
                    {infoGrupo.nome})
                  </h2>
                  {diferencasSnapshot.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "#4b5563" }}>
                      Nenhuma diferença encontrada entre o horário atual e a
                      versão selecionada para este grupo.
                    </p>
                  ) : (
                    <div className="horario-wrapper">
                      <table className="horario-table log-table">
                        <thead>
                          <tr>
                            <th>Dia</th>
                            <th>Aula</th>
                            <th>Campo</th>
                            <th>Versão selecionada</th>
                            <th>Horário atual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diferencasSnapshot.map((d, idx) => (
                            <tr key={idx}>
                              <td>{d.dia}</td>
                              <td>{d.aula}ª</td>
                              <td>{d.campo}</td>
                              <td>{d.de || "—"}</td>
                              <td>{d.para || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Log (resumo) */}
              <section style={{ marginTop: "1.5rem" }}>
                <h2 className="section-title">
                  Últimas ações registradas
                </h2>

                {/* Filtros do log */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    fontSize: "0.8rem",
                    marginBottom: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Filtros:</span>
                  <select
                    className="app-select"
                    value={filtroUsuario}
                    onChange={(e) => setFiltroUsuario(e.target.value)}
                  >
                    <option value="">Usuário (todos)</option>
                    {usuariosLog.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <select
                    className="app-select"
                    value={filtroAcao}
                    onChange={(e) => setFiltroAcao(e.target.value)}
                  >
                    <option value="">Ação (todas)</option>
                    {acoesLog.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <select
                    className="app-select"
                    value={filtroGrupoId}
                    onChange={(e) => setFiltroGrupoId(e.target.value)}
                  >
                    <option value="">Grupo/Período (todos)</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                  <label>
                    De:{" "}
                    <input
                      type="date"
                      value={filtroDataInicio}
                      onChange={(e) => setFiltroDataInicio(e.target.value)}
                    />
                  </label>
                  <label>
                    Até:{" "}
                    <input
                      type="date"
                      value={filtroDataFim}
                      onChange={(e) => setFiltroDataFim(e.target.value)}
                    />
                  </label>
                  <button
                    className="button-primary"
                    style={{ marginLeft: "0.25rem" }}
                    onClick={exportarLogPDF}
                  >
                    🖨️ PDF
                  </button>
                  <button
                    className="button-primary"
                    style={{ marginLeft: "0.25rem" }}
                    onClick={exportarLogCSV}
                  >
                    📊 CSV/Excel
                  </button>
                </div>

                <div className="horario-wrapper">
                  <table className="horario-table log-table">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Usuário</th>
                        <th>Ação</th>
                        <th>Grupo</th>
                        <th>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center" }}>
                            Nenhum registro no log com os filtros atuais.
                          </td>
                        </tr>
                      )}
                      {logsFiltrados
                        .slice() // cópia para poder reverter
                        .reverse()
                        .map((log, idx) => {
                          const grupoLabel = log.grupoId
                            ? grupos.find((g) => g.id === log.grupoId)?.nome ??
                              log.grupoId
                            : "";
                          return (
                            <tr key={idx}>
                              <td>
                                {new Date(log.timestamp).toLocaleString(
                                  "pt-BR"
                                )}
                              </td>
                              <td>{log.usuario ?? "—"}</td>
                              <td>{log.acao}</td>
                              <td>{grupoLabel}</td>
                              <td>{log.detalhes}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ---------- ABA CADASTRO POR TURMA / PROFESSOR (editável) ---------- */}
          {aba === "cadastro" && podeEditarAgora && (
            <section className="cadastro-container">
              <h2 style={{ fontSize: "1rem" }}>
                Cadastro de horário por turma e professor
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Preencha os campos abaixo para registrar uma aula em uma turma,
                em um dia e número de aula específicos. Essas informações irão
                aparecer automaticamente no quadro geral.
              </p>

              <div className="cadastro-grid">
                <div className="cadastro-field">
                  <label className="cadastro-label">Turma</label>
                  {turmasDoGrupoCadastro.length > 0 ? (
                    <>
                      <select
                        className="cadastro-select"
                        value={
                          turmasDoGrupoCadastro.includes(turmaCadastro)
                            ? turmaCadastro
                            : "__outra__"
                        }
                        onChange={(e) =>
                          setTurmaCadastro(
                            e.target.value === "__outra__" ? "" : e.target.value
                          )
                        }
                      >
                        <option value="__outra__">Outra (digitar manualmente)</option>
                        {turmasDoGrupoCadastro.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {!turmasDoGrupoCadastro.includes(turmaCadastro) && (
                        <input
                          className="cadastro-input"
                          placeholder="Ex: 6º A"
                          value={turmaCadastro}
                          onChange={(e) => setTurmaCadastro(e.target.value)}
                          style={{ marginTop: "0.35rem" }}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      className="cadastro-input"
                      placeholder="Ex: 6º A"
                      value={turmaCadastro}
                      onChange={(e) => setTurmaCadastro(e.target.value)}
                    />
                  )}
                </div>

                <div className="cadastro-field">
                  <label className="cadastro-label">Professor(a)</label>
                  {professores.length > 0 ? (
                    <>
                      <select
                        className="cadastro-select"
                        value={
                          professores.some((p) => p.nome === profCadastro)
                            ? profCadastro
                            : "__outro__"
                        }
                        onChange={(e) =>
                          setProfCadastro(
                            e.target.value === "__outro__" ? "" : e.target.value
                          )
                        }
                      >
                        <option value="__outro__">Outro (digitar manualmente)</option>
                        {professores.map((p) => (
                          <option key={p.id} value={p.nome}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                      {!professores.some((p) => p.nome === profCadastro) && (
                        <input
                          className="cadastro-input"
                          placeholder="Nome do(a) professor(a)"
                          value={profCadastro}
                          onChange={(e) => setProfCadastro(e.target.value)}
                          style={{ marginTop: "0.35rem" }}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      className="cadastro-input"
                      placeholder="Nome do(a) professor(a)"
                      value={profCadastro}
                      onChange={(e) => setProfCadastro(e.target.value)}
                    />
                  )}
                </div>

                <div className="cadastro-field">
                  <label className="cadastro-label">Disciplina</label>
                  <input
                    className="cadastro-input"
                    placeholder="Ex: Português"
                    value={discCadastro}
                    onChange={(e) => setDiscCadastro(e.target.value)}
                  />
                </div>

                <div className="cadastro-field">
                  <label className="cadastro-label">Dia da semana</label>
                  <select
                    className="cadastro-select"
                    value={diaCadastro}
                    onChange={(e) => setDiaCadastro(e.target.value)}
                  >
                    {diasSemana.map((dia) => (
                      <option key={dia} value={dia}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cadastro-field">
                  <label className="cadastro-label">Número da aula</label>
                  <select
                    className="cadastro-select"
                    value={numAulaCadastro}
                    onChange={(e) =>
                      setNumAulaCadastro(Number(e.target.value))
                    }
                  >
                    {numerosAulaDisponiveis.map((n) => (
                      <option key={n} value={n}>
                        {n}ª aula
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cadastro-actions">
                <button className="button-primary" onClick={handleSalvarCadastro}>
                  <span>💾</span>
                  Salvar / Atualizar aula
                </button>

                <button
                  className="button-danger"
                  onClick={handleLimparCadastroCampo}
                >
                  <span className="button-danger-icon">✖</span>
                  Limpar este horário
                </button>
              </div>

              <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                Dica: você pode definir o professor e a turma, escolher o dia e
                ir mudando apenas o número da aula para montar o dia inteiro.
                Depois é só conferir tudo na aba <strong>Quadro geral</strong>.
              </p>
            </section>
          )}

          {/* ---------- ABA GRADES POR PROFESSOR / TURMA ---------- */}
          {aba === "grades" && (
            <section className="cadastro-container">
              <h2 style={{ fontSize: "1rem" }}>
                Grades por professor e por turma – {infoGrupo.nome}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Visão resumida das aulas por professor(a) e por turma, sem
                intervalos, apenas para o grupo selecionado.
              </p>

              {/* Grade por Professor (sem intervalos) */}
              <section style={{ marginTop: "1rem" }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                  Grade horária por professor (sem intervalos)
                </h3>
                <div className="horario-wrapper">
                  <table className="horario-table">
                    <thead>
                      <tr>
                        <th>Professor(a)</th>
                        <th>Dia</th>
                        <th>1ª</th>
                        <th>2ª</th>
                        <th>3ª</th>
                        <th>4ª</th>
                        <th>5ª</th>
                        <th>6ª</th>
                      </tr>
                    </thead>
                    <tbody>
                      {professoresOrdenados.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center" }}>
                            Nenhum professor cadastrado ainda.
                          </td>
                        </tr>
                      )}

                      {professoresOrdenados.map((prof) =>
                        diasSemana.map((dia) => {
                          const aulasDia = gradeProf[prof][dia] || {};
                          return (
                            <tr key={prof + dia}>
                              <td>{prof}</td>
                              <td>{dia}</td>
                              {Array.from({ length: 6 }).map((_, i) => {
                                const numAula = i + 1;
                                const info = aulasDia[numAula];
                                const texto = info
                                  ? `${info.disciplina}${
                                      info.turma ? ` (${info.turma})` : ""
                                    }`
                                  : "";
                                return <td key={numAula}>{texto}</td>;
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Grade por Turma (sem intervalos) */}
              <section style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                  Grade horária por turma (sem intervalos)
                </h3>
                <div className="horario-wrapper">
                  <table className="horario-table">
                    <thead>
                      <tr>
                        <th>Turma</th>
                        <th>Dia</th>
                        <th>1ª</th>
                        <th>2ª</th>
                        <th>3ª</th>
                        <th>4ª</th>
                        <th>5ª</th>
                        <th>6ª</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turmasOrdenadas.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center" }}>
                            Nenhuma turma cadastrada ainda.
                          </td>
                        </tr>
                      )}

                      {turmasOrdenadas.map((turma) =>
                        diasSemana.map((dia) => {
                          const aulasDia = gradeTurma[turma][dia] || {};
                          return (
                            <tr key={turma + dia}>
                              <td>{turma}</td>
                              <td>{dia}</td>
                              {Array.from({ length: 6 }).map((_, i) => {
                                const numAula = i + 1;
                                const info = aulasDia[numAula];
                                const texto = info
                                  ? `${info.disciplina}${
                                      info.professor
                                        ? ` (${info.professor})`
                                        : ""
                                    }`
                                  : "";
                                return <td key={numAula}>{texto}</td>;
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          )}

          {/* ---------- ABA RELATÓRIOS DE CARGA HORÁRIA ---------- */}
          {aba === "relatorios" && (
            <section className="cadastro-container">
              <h2 style={{ fontSize: "1rem" }}>
                Relatórios de carga horária – {infoGrupo.nome}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Resumo de aulas por professor, turma e disciplina no grupo
                selecionado.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1rem",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ flex: "1 1 220px" }}>
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: "0.25rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Por professor(a)
                  </h3>
                  <div className="horario-wrapper">
                    <table className="horario-table log-table">
                      <thead>
                        <tr>
                          <th>Professor(a)</th>
                          <th>Total de aulas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargaPorProfessor.length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ textAlign: "center" }}>
                              Nenhum professor neste grupo.
                            </td>
                          </tr>
                        )}
                        {cargaPorProfessor.map((item) => (
                          <tr key={item.professor}>
                            <td>{item.professor}</td>
                            <td>{item.aulas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: "0.25rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Por turma
                  </h3>
                  <div className="horario-wrapper">
                    <table className="horario-table log-table">
                      <thead>
                        <tr>
                          <th>Turma</th>
                          <th>Total de aulas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargaPorTurma.length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ textAlign: "center" }}>
                              Nenhuma turma neste grupo.
                            </td>
                          </tr>
                        )}
                        {cargaPorTurma.map((item) => (
                          <tr key={item.turma}>
                            <td>{item.turma}</td>
                            <td>{item.aulas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: "0.25rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Por disciplina
                  </h3>
                  <div className="horario-wrapper">
                    <table className="horario-table log-table">
                      <thead>
                        <tr>
                          <th>Disciplina</th>
                          <th>Total de aulas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargaPorDisciplina.length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ textAlign: "center" }}>
                              Nenhuma disciplina cadastrada neste grupo.
                            </td>
                          </tr>
                        )}
                        {cargaPorDisciplina.map((item) => (
                          <tr key={item.disciplina}>
                            <td>{item.disciplina}</td>
                            <td>{item.aulas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ---------- ABA HISTÓRICO DE ALTERAÇÕES ---------- */}
          {aba === "historico" && (
            <HistoricoAlteracoes
              horariosAtuais={horarios}
              podeEditar={podeEditarAgora}
              onRestaurarSnapshot={(dados) => {
                setHorarios(dados);
                alert("Horário restaurado! Recarregue a página para ver as mudanças.");
              }}
            />
          )}

          {/* ---------- ABA EXPORTAÇÃO/IMPORTAÇÃO ---------- */}
          {aba === "exportacao" && (
            <ExportacaoImportacao
              horarios={horarios}
              podeEditar={podeEditarAgora}
              onHorariosAtualizados={() => {
                carregarHorarios().then(setHorarios).catch(console.error);
              }}
            />
          )}

          {/* ---------- ABA CONFIGURAÇÃO DA ESCOLA ---------- */}
          {aba === "configuracao" && podeEditarAgora && (
            <ConfiguracaoEscola
              onConfigChange={() => {
                // Atualiza grupo selecionado se o atual não existir mais
                const novosGrupos = getGrupos();
                if (!novosGrupos.find((g) => g.id === grupoSelecionado)) {
                  setGrupoSelecionado(
                    novosGrupos.length > 0 ? novosGrupos[0].id : ""
                  );
                }
              }}
            />
          )}

          {/* ---------- ABA PROFESSORES ---------- */}
          {aba === "professores" && podeEditarAgora && (
            <Professores
              onProfessoresChange={() => setProfessores(carregarProfessores())}
            />
          )}

          {/* ---------- ABA USUÁRIOS ---------- */}
          {aba === "usuarios" && podeEditarAgora && <Usuarios />}
        </div>
      </main>

        <footer className="app-footer">
          PWA experimental para organização de horários – desenvolvido para apoio à
          gestão escolar.
        </footer>
      </div>
    </div>
  );
}

export default App;
