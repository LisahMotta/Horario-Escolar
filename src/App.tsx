import { useEffect, useState } from "react";
import {
  grupos,
  slotsPorGrupo,
  diasSemana,
  type GrupoId,
  type TimeSlot,
} from "./scheduleConfig";
import type { HorarioCompleto, HorariosPorGrupo } from "./types";

const STORAGE_KEY = "horario-escolar-manha-por-grupo";
const USER_KEY = "horario-escolar-usuario";

type AbaId = "quadro" | "cadastro";

interface LogEntry {
  timestamp: string; // ISO string
  usuario: string | null;
  acao: string; // "login", "logout", "salvar_aula", "limpar_aula", "limpar_grupo"
  detalhes: string;
}

// ---------- Funções auxiliares de base ----------

function criarHorarioVazioParaGrupo(grupoId: GrupoId): HorarioCompleto {
  const slots = slotsPorGrupo[grupoId];
  const horario: HorarioCompleto = {};

  diasSemana.forEach((dia) => {
    horario[dia] = {};
    slots.forEach((slot) => {
      if (slot.tipo === "aula") {
        horario[dia][slot.id] = null;
      }
    });
  });

  return horario;
}

function carregarHorarios(): HorariosPorGrupo {
  const salvo = localStorage.getItem(STORAGE_KEY);
  if (salvo) {
    return JSON.parse(salvo);
  }

  const inicial: HorariosPorGrupo = {};
  grupos.forEach((g) => {
    inicial[g.id] = criarHorarioVazioParaGrupo(g.id);
  });
  return inicial;
}

function salvarHorarios(horarios: HorariosPorGrupo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(horarios));
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

function carregarUsuario(): string | null {
  const salvo = localStorage.getItem(USER_KEY);
  return salvo || null;
}

function salvarUsuario(nome: string | null) {
  if (nome) {
    localStorage.setItem(USER_KEY, nome);
  } else {
    localStorage.removeItem(USER_KEY);
  }
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

  diasSemana.forEach((dia) => {
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

  diasSemana.forEach((dia) => {
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
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoId>("fund2");
  const [aba, setAba] = useState<AbaId>("quadro");

  const [horarios, setHorarios] = useState<HorariosPorGrupo>(() =>
    carregarHorarios()
  );

  const [logEntries, setLogEntries] = useState<LogEntry[]>(() =>
    carregarLogLocal()
  );

  const [usuarioAtual, setUsuarioAtual] = useState<string | null>(() =>
    carregarUsuario()
  );
  const [nomeLogin, setNomeLogin] = useState("");

  // estado do formulário de cadastro por turma/professor
  const [turmaCadastro, setTurmaCadastro] = useState("");
  const [profCadastro, setProfCadastro] = useState("");
  const [discCadastro, setDiscCadastro] = useState("");
  const [diaCadastro, setDiaCadastro] = useState(diasSemana[0]);
  const [numAulaCadastro, setNumAulaCadastro] = useState(1);

  const horarioAtual: HorarioCompleto =
    horarios[grupoSelecionado] || criarHorarioVazioParaGrupo(grupoSelecionado);

  useEffect(() => {
    salvarHorarios(horarios);
  }, [horarios]);

  // Sempre mantém uma cópia local como backup
  useEffect(() => {
    salvarLogLocal(logEntries);
  }, [logEntries]);

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

  function adicionarLog(acao: string, detalhes: string) {
    const novo: LogEntry = {
      timestamp: new Date().toISOString(),
      usuario: usuarioAtual,
      acao,
      detalhes,
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

  function limparHorarioGrupoAtual() {
    if (
      !usuarioAtual &&
      !confirm(
        "Nenhum usuário está logado. Deseja mesmo limpar o horário deste grupo sem registrar usuário?"
      )
    ) {
      return;
    }

    if (
      confirm(
        `Deseja limpar o horário do grupo selecionado (${grupoSelecionado})?`
      )
    ) {
      setHorarios((prev) => {
        const copia: HorariosPorGrupo = structuredClone(prev);
        copia[grupoSelecionado] = criarHorarioVazioParaGrupo(grupoSelecionado);
        return copia;
      });

      adicionarLog(
        "limpar_grupo",
        `Horário do grupo ${grupoSelecionado} foi limpo.`
      );
    }
  }

  const slots = slotsPorGrupo[grupoSelecionado];
  const infoGrupo = grupos.find((g) => g.id === grupoSelecionado)!;

  // Grades derivadas (para quadro geral)
  const gradeProf = construirGradeProfessor(horarioAtual, slots);
  const gradeTurma = construirGradeTurma(horarioAtual, slots);

  const professoresOrdenados = Object.keys(gradeProf).sort();
  const turmasOrdenadas = Object.keys(gradeTurma).sort();

  // ---------- Login / Logout ----------

  function handleLogin() {
    if (!nomeLogin.trim()) {
      alert("Digite um nome para login.");
      return;
    }
    const nome = nomeLogin.trim();
    setUsuarioAtual(nome);
    salvarUsuario(nome);
    setNomeLogin("");
    adicionarLog("login", `Login efetuado por "${nome}".`);
  }

  function handleLogout() {
    const nome = usuarioAtual;
    setUsuarioAtual(null);
    salvarUsuario(null);
    adicionarLog("logout", `Logout de "${nome ?? "usuário desconhecido"}".`);
  }

  // ---------- Ações da aba Cadastro por Turma ----------

  function handleSalvarCadastro() {
    if (!usuarioAtual) {
      alert("Faça login antes de salvar para registrar quem fez a alteração.");
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

    setHorarios((prev) => {
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

    adicionarLog(
      "salvar_aula",
      `Aula salva: turma=${turmaCadastro.trim()}, prof=${profCadastro.trim()}, disc=${discCadastro.trim()}, dia=${diaCadastro}, aula=${numAulaCadastro}, grupo=${grupoSelecionado}.`
    );
  }

  function handleLimparCadastroCampo() {
    if (!usuarioAtual) {
      alert("Faça login antes de limpar para registrar quem fez a alteração.");
      return;
    }

    const slotId = aulaNumeroParaSlotId(slots, numAulaCadastro);
    if (!slotId) {
      alert("Número de aula inválido para este grupo.");
      return;
    }

    setHorarios((prev) => {
      const copia: HorariosPorGrupo = structuredClone(prev);

      if (!copia[grupoSelecionado]) return prev;

      const horarioGrupo = copia[grupoSelecionado];
      horarioGrupo[diaCadastro][slotId] = null;

      return copia;
    });

    adicionarLog(
      "limpar_aula",
      `Horário limpo: dia=${diaCadastro}, aula=${numAulaCadastro}, grupo=${grupoSelecionado}.`
    );
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

  // ---------- Render ----------

  return (
    <div className="app-container">
      {/* Cabeçalho SEDUC */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-header-title">
            Secretaria da Educação do Estado de São Paulo
          </div>
          <div className="app-header-subtitle">
            Sistema de Organização de Horário – Período da Manhã
          </div>
          <div className="app-header-badge">
            <span className="app-header-badge-dot" />
            <span>Uso interno – Gestão Escolar</span>
          </div>
        </div>

        {/* Login no topo */}
        <div className="login-bar">
          {usuarioAtual ? (
            <>
              <span className="login-user">
                Usuário: <strong>{usuarioAtual}</strong>
              </span>
              <button className="button-danger" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <input
                className="login-input"
                placeholder="Seu nome para login"
                value={nomeLogin}
                onChange={(e) => setNomeLogin(e.target.value)}
              />
              <button className="button-primary" onClick={handleLogin}>
                Entrar
              </button>
            </>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="app-main">
        <div className="app-content">
          {/* Barra superior */}
          <div className="app-toolbar">
            <div className="app-toolbar-left">
              <div className="app-toolbar-title">
                Horário de Aulas – Manhã (07h00 às 12h20)
              </div>
              <div className="app-toolbar-text">
                6 aulas de 50 minutos e 1 intervalo de 20 minutos por grupo de
                turmas. <br />
                <span className="app-toolbar-highlight">
                  Grupo atual: {infoGrupo.nome} – {infoGrupo.descricao}
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
                <button
                  className={
                    "tab-button " +
                    (aba === "cadastro" ? "tab-button-active" : "")
                  }
                  onClick={() => setAba("cadastro")}
                >
                  Cadastro por turma / professor
                </button>
              </div>
            </div>

            <div className="app-toolbar-group">
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
            </div>
          </div>

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

                          return (
                            <td key={dia} className="horario-slot-aula">
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
                <button
                  className="button-danger"
                  onClick={limparHorarioGrupoAtual}
                >
                  <span className="button-danger-icon">🧹</span>
                  Limpar horário do grupo
                </button>

                <button
                  className="button-danger"
                  style={{ background: "#1d4ed8" }}
                  onClick={() => window.print()}
                >
                  <span className="button-danger-icon">🖨️</span>
                  Imprimir página
                </button>

                <button
                  className="button-primary"
                  onClick={handleExportarLog}
                >
                  <span>📄</span>
                  Exportar log (JSON)
                </button>
              </div>

              {/* Grade por Professor (sem intervalos) */}
              <section style={{ marginTop: "1.5rem" }}>
                <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                  Grade horária por professor (sem intervalos)
                </h2>
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
                <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                  Grade horária por turma (sem intervalos)
                </h2>
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

              {/* Log (resumo) */}
              <section style={{ marginTop: "1.5rem" }}>
                <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                  Últimas ações registradas
                </h2>
                <div className="horario-wrapper">
                  <table className="horario-table log-table">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Usuário</th>
                        <th>Ação</th>
                        <th>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logEntries.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center" }}>
                            Nenhum registro no log ainda.
                          </td>
                        </tr>
                      )}
                      {logEntries
                        .slice(-20) // últimas 20
                        .reverse()
                        .map((log, idx) => (
                          <tr key={idx}>
                            <td>
                              {new Date(log.timestamp).toLocaleString("pt-BR")}
                            </td>
                            <td>{log.usuario ?? "—"}</td>
                            <td>{log.acao}</td>
                            <td>{log.detalhes}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ---------- ABA CADASTRO POR TURMA / PROFESSOR (editável) ---------- */}
          {aba === "cadastro" && (
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
                  <input
                    className="cadastro-input"
                    placeholder="Ex: 6º A"
                    value={turmaCadastro}
                    onChange={(e) => setTurmaCadastro(e.target.value)}
                  />
                </div>

                <div className="cadastro-field">
                  <label className="cadastro-label">Professor(a)</label>
                  <input
                    className="cadastro-input"
                    placeholder="Nome do(a) professor(a)"
                    value={profCadastro}
                    onChange={(e) => setProfCadastro(e.target.value)}
                  />
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
                    <option value={1}>1ª aula</option>
                    <option value={2}>2ª aula</option>
                    <option value={3}>3ª aula</option>
                    <option value={4}>4ª aula</option>
                    <option value={5}>5ª aula</option>
                    <option value={6}>6ª aula</option>
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
        </div>
      </main>

      <footer className="app-footer">
        PWA experimental para organização de horários – desenvolvido para apoio à
        gestão escolar.
      </footer>
    </div>
  );
}

export default App;
