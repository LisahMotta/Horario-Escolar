import { useState, useEffect } from "react";
import type {
  EscolaConfig,
  GrupoInfo,
  TimeSlot,
  TipoSlot,
  GrupoId,
  TipoPeriodo,
  SerieTurmas,
} from "./scheduleConfig";
import {
  obterConfiguracao,
  atualizarConfiguracao,
  resetarConfiguracao,
  carregarConfiguracao,
  LIMITE_AULAS_POR_TIPO,
  TIPO_PERIODO_LABEL,
  calcularDuracaoAulaMin,
  gerarSlots,
  gerarTurmasPorSeries,
} from "./scheduleConfig";

interface ConfiguracaoEscolaProps {
  onConfigChange?: () => void;
}

interface NovaSerieDraft {
  serie: string;
  quantidade: number;
}

const TIPOS_PERIODO: TipoPeriodo[] = ["pei", "parcial", "noturno"];

export function ConfiguracaoEscola({ onConfigChange }: ConfiguracaoEscolaProps) {
  const [config, setConfig] = useState<EscolaConfig>(() => obterConfiguracao());
  const [grupoEditando, setGrupoEditando] = useState<GrupoId | null>(null);
  const [novaSeriePorGrupo, setNovaSeriePorGrupo] = useState<
    Record<GrupoId, NovaSerieDraft>
  >({});

  // Recarrega a configuração quando o componente monta
  useEffect(() => {
    setConfig(obterConfiguracao());
  }, []);

  function handleSalvarConfig() {
    atualizarConfiguracao(config);
    if (onConfigChange) {
      onConfigChange();
    }
    alert("Configuração salva com sucesso! A página será recarregada.");
    window.location.reload();
  }

  function handleResetar() {
    if (
      confirm(
        "Tem certeza que deseja resetar para a configuração padrão? Isso apagará todas as personalizações."
      )
    ) {
      resetarConfiguracao();
      setConfig(carregarConfiguracao());
      if (onConfigChange) {
        onConfigChange();
      }
      alert("Configuração resetada! A página será recarregada.");
      window.location.reload();
    }
  }

  function handleAdicionarGrupo() {
    const novoId = `grupo_${Date.now()}`;
    const novoGrupo: GrupoInfo = {
      id: novoId,
      nome: "Novo período",
      descricao: "Descrição do período",
      tipoPeriodo: "parcial",
      horaInicio: "07:00",
      horaTermino: "12:00",
      quantidadeAulas: 6,
      intervaloAposAula: 3,
      duracaoIntervaloMin: 20,
      series: [],
      turmas: [],
    };
    setConfig({
      ...config,
      grupos: [...config.grupos, novoGrupo],
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [novoId]: [{ id: 1, label: "08:00 - 08:50 (Aula 1)", tipo: "aula" }],
      },
    });
    setGrupoEditando(novoId);
  }

  function handleRemoverGrupo(grupoId: GrupoId) {
    if (
      !confirm(
        "Tem certeza que deseja remover este grupo? Todos os horários deste grupo serão perdidos."
      )
    ) {
      return;
    }
    const novosGrupos = config.grupos.filter((g) => g.id !== grupoId);
    const novosSlots = { ...config.slotsPorGrupo };
    delete novosSlots[grupoId];
    setConfig({
      ...config,
      grupos: novosGrupos,
      slotsPorGrupo: novosSlots,
    });
  }

  function handleAtualizarGrupo(grupoId: GrupoId, campo: keyof GrupoInfo, valor: string) {
    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId ? { ...g, [campo]: valor } : g
      ),
    });
  }

  function handleAtualizarGrupoCampo<K extends keyof GrupoInfo>(
    grupoId: GrupoId,
    campo: K,
    valor: GrupoInfo[K]
  ) {
    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId ? { ...g, [campo]: valor } : g
      ),
    });
  }

  // Ao trocar o tipo de período, garante que a quantidade de aulas não
  // ultrapasse o limite diário permitido para aquele tipo.
  function handleAlterarTipoPeriodo(grupoId: GrupoId, tipo: TipoPeriodo) {
    const grupo = config.grupos.find((g) => g.id === grupoId);
    const limite = LIMITE_AULAS_POR_TIPO[tipo];
    const quantidadeAtual = grupo?.quantidadeAulas ?? limite;
    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId
          ? { ...g, tipoPeriodo: tipo, quantidadeAulas: Math.min(quantidadeAtual, limite) }
          : g
      ),
    });
  }

  function handleAlterarQuantidadeAulas(grupoId: GrupoId, valor: number) {
    const grupo = config.grupos.find((g) => g.id === grupoId);
    const limite = LIMITE_AULAS_POR_TIPO[grupo?.tipoPeriodo || "parcial"];
    const quantidade = Math.max(1, Math.min(valor || 1, limite));
    handleAtualizarGrupoCampo(grupoId, "quantidadeAulas", quantidade);
  }

  function handleGerarHorarios(grupoId: GrupoId) {
    const grupo = config.grupos.find((g) => g.id === grupoId);
    if (!grupo) return;

    const tipo = grupo.tipoPeriodo || "parcial";
    const horaInicio = grupo.horaInicio || "07:00";
    const horaTermino = grupo.horaTermino || "12:00";
    const limite = LIMITE_AULAS_POR_TIPO[tipo];
    const quantidadeAulas = Math.max(1, Math.min(grupo.quantidadeAulas || limite, limite));
    const duracaoIntervaloMin = grupo.duracaoIntervaloMin ?? 20;
    const intervaloAposAula = grupo.intervaloAposAula ?? null;

    const duracaoAulaMin = calcularDuracaoAulaMin(
      horaInicio,
      horaTermino,
      quantidadeAulas,
      intervaloAposAula ? duracaoIntervaloMin : 0
    );

    const novosSlots = gerarSlots({
      horaInicio,
      duracaoAulaMin,
      quantidadeAulas,
      intervaloAposAula,
      duracaoIntervaloMin,
    });

    const ultimoSlot = novosSlots[novosSlots.length - 1];
    const horaTerminoReal = ultimoSlot
      ? ultimoSlot.label.split(" - ")[1]?.split(" (")[0] ?? horaTermino
      : horaTermino;

    const descricaoIntervalo = intervaloAposAula
      ? ` – intervalo após a ${intervaloAposAula}ª aula`
      : "";

    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId
          ? {
              ...g,
              quantidadeAulas,
              duracaoAulaMin,
              descricao: `${horaInicio} às ${horaTerminoReal}${descricaoIntervalo} (aulas de ${duracaoAulaMin} min)`,
            }
          : g
      ),
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [grupoId]: novosSlots,
      },
    });
  }

  function handleAdicionarSlot(grupoId: GrupoId) {
    const slots = config.slotsPorGrupo[grupoId] || [];
    const novoId = Math.max(...slots.map((s) => s.id), 0) + 1;
    const novoSlot: TimeSlot = {
      id: novoId,
      label: "08:00 - 08:50 (Aula)",
      tipo: "aula",
    };
    setConfig({
      ...config,
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [grupoId]: [...slots, novoSlot],
      },
    });
  }

  function handleRemoverSlot(grupoId: GrupoId, slotIndex: number) {
    const slots = config.slotsPorGrupo[grupoId] || [];
    const novosSlots = slots.filter((_, i) => i !== slotIndex);
    setConfig({
      ...config,
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [grupoId]: novosSlots,
      },
    });
  }

  function handleAtualizarSlot(
    grupoId: GrupoId,
    slotIndex: number,
    campo: keyof TimeSlot,
    valor: string | TipoSlot
  ) {
    const slots = config.slotsPorGrupo[grupoId] || [];
    const novosSlots = [...slots];
    novosSlots[slotIndex] = {
      ...novosSlots[slotIndex],
      [campo]: valor,
    };
    setConfig({
      ...config,
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [grupoId]: novosSlots,
      },
    });
  }

  // ---------- Séries e turmas ----------

  function handleAdicionarSerie(grupoId: GrupoId) {
    const draft = novaSeriePorGrupo[grupoId];
    if (!draft || !draft.serie.trim() || !draft.quantidade) return;

    const grupo = config.grupos.find((g) => g.id === grupoId);
    if (!grupo) return;

    const novasSeries: SerieTurmas[] = [
      ...(grupo.series || []),
      { serie: draft.serie.trim(), quantidade: draft.quantidade },
    ];
    const novasTurmas = gerarTurmasPorSeries(novasSeries);

    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId ? { ...g, series: novasSeries, turmas: novasTurmas } : g
      ),
    });
    setNovaSeriePorGrupo({
      ...novaSeriePorGrupo,
      [grupoId]: { serie: "", quantidade: 1 },
    });
  }

  function handleRemoverSerie(grupoId: GrupoId, index: number) {
    const grupo = config.grupos.find((g) => g.id === grupoId);
    if (!grupo) return;
    const novasSeries = (grupo.series || []).filter((_, i) => i !== index);
    const novasTurmas = gerarTurmasPorSeries(novasSeries);
    setConfig({
      ...config,
      grupos: config.grupos.map((g) =>
        g.id === grupoId ? { ...g, series: novasSeries, turmas: novasTurmas } : g
      ),
    });
  }

  function handleAdicionarDia(dia: string) {
    if (!config.diasSemana.includes(dia)) {
      setConfig({
        ...config,
        diasSemana: [...config.diasSemana, dia],
      });
    }
  }

  function handleRemoverDia(dia: string) {
    setConfig({
      ...config,
      diasSemana: config.diasSemana.filter((d) => d !== dia),
    });
  }

  const diasPadrao = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Configuração da Escola
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Configure os períodos, os horários de aula, as turmas e os dias da
          semana da sua escola. Apenas usuários com perfil de Direção ou
          Vice-direção podem editar.
        </p>
      </div>

      {/* Nome da Escola */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label className="cadastro-label">Nome da Escola</label>
        <input
          className="cadastro-input"
          value={config.nomeEscola}
          onChange={(e) =>
            setConfig({ ...config, nomeEscola: e.target.value })
          }
          placeholder="Ex: Escola Estadual Exemplo"
        />
      </div>

      {/* Dias da Semana */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label className="cadastro-label">Dias da Semana</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
          {config.diasSemana.map((dia) => (
            <div
              key={dia}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.5rem",
                background: "#e5e7eb",
                borderRadius: "4px",
              }}
            >
              <span>{dia}</span>
              <button
                className="button-danger"
                style={{ padding: "0.125rem 0.375rem", fontSize: "0.75rem" }}
                onClick={() => handleRemoverDia(dia)}
              >
                ✖
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <select
            className="cadastro-select"
            onChange={(e) => {
              if (e.target.value) {
                handleAdicionarDia(e.target.value);
                e.target.value = "";
              }
            }}
            style={{ width: "auto" }}
          >
            <option value="">Adicionar dia...</option>
            {diasPadrao
              .filter((d) => !config.diasSemana.includes(d))
              .map((dia) => (
                <option key={dia} value={dia}>
                  {dia}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Grupos / Períodos */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <label className="cadastro-label" style={{ margin: 0 }}>
            Períodos e Turmas
          </label>
          <button className="button-primary" onClick={handleAdicionarGrupo}>
            + Adicionar Período
          </button>
        </div>

        {config.grupos.map((grupo) => {
          const tipo = grupo.tipoPeriodo || "parcial";
          const limite = LIMITE_AULAS_POR_TIPO[tipo];
          const quantidadeAulas = grupo.quantidadeAulas ?? limite;
          const draft = novaSeriePorGrupo[grupo.id] || { serie: "", quantidade: 1 };
          const turmasGeradas = grupo.turmas || [];

          return (
            <div
              key={grupo.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
                background: grupoEditando === grupo.id ? "#f9fafb" : "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    className="cadastro-input"
                    value={grupo.nome}
                    onChange={(e) =>
                      handleAtualizarGrupo(grupo.id, "nome", e.target.value)
                    }
                    placeholder="Nome do período (ex: Manhã – 6º ao 8º ano)"
                    style={{ marginBottom: "0.5rem" }}
                  />
                  <input
                    className="cadastro-input"
                    value={grupo.descricao}
                    onChange={(e) =>
                      handleAtualizarGrupo(grupo.id, "descricao", e.target.value)
                    }
                    placeholder="Descrição (preenchida automaticamente ao gerar os horários)"
                  />
                </div>
                <button
                  className="button-danger"
                  onClick={() => handleRemoverGrupo(grupo.id)}
                  style={{ marginLeft: "0.5rem" }}
                >
                  Remover
                </button>
              </div>

              {/* Assistente de geração automática de horários */}
              <div
                style={{
                  background: "#eff6ff",
                  borderRadius: "8px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.6rem" }}>
                  Montar horários automaticamente
                </label>

                <div className="cadastro-grid" style={{ marginBottom: "0.6rem" }}>
                  <div className="cadastro-field">
                    <label className="cadastro-label">Tipo de período</label>
                    <select
                      className="cadastro-select"
                      value={tipo}
                      onChange={(e) =>
                        handleAlterarTipoPeriodo(grupo.id, e.target.value as TipoPeriodo)
                      }
                    >
                      {TIPOS_PERIODO.map((t) => (
                        <option key={t} value={t}>
                          {TIPO_PERIODO_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="cadastro-field">
                    <label className="cadastro-label">Início</label>
                    <input
                      className="cadastro-input"
                      type="time"
                      value={grupo.horaInicio || "07:00"}
                      onChange={(e) =>
                        handleAtualizarGrupoCampo(grupo.id, "horaInicio", e.target.value)
                      }
                    />
                  </div>

                  <div className="cadastro-field">
                    <label className="cadastro-label">Término</label>
                    <input
                      className="cadastro-input"
                      type="time"
                      value={grupo.horaTermino || "12:00"}
                      onChange={(e) =>
                        handleAtualizarGrupoCampo(grupo.id, "horaTermino", e.target.value)
                      }
                    />
                  </div>

                  <div className="cadastro-field">
                    <label className="cadastro-label">
                      Quantidade de aulas (máx. {limite})
                    </label>
                    <input
                      className="cadastro-input"
                      type="number"
                      min={1}
                      max={limite}
                      value={quantidadeAulas}
                      onChange={(e) =>
                        handleAlterarQuantidadeAulas(grupo.id, Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="cadastro-field">
                    <label className="cadastro-label">Intervalo após a aula nº</label>
                    <select
                      className="cadastro-select"
                      value={grupo.intervaloAposAula ?? ""}
                      onChange={(e) =>
                        handleAtualizarGrupoCampo(
                          grupo.id,
                          "intervaloAposAula",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Sem intervalo</option>
                      {Array.from({ length: quantidadeAulas }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}ª aula
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="cadastro-field">
                    <label className="cadastro-label">Duração do intervalo (min)</label>
                    <input
                      className="cadastro-input"
                      type="number"
                      min={0}
                      value={grupo.duracaoIntervaloMin ?? 20}
                      onChange={(e) =>
                        handleAtualizarGrupoCampo(
                          grupo.id,
                          "duracaoIntervaloMin",
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                    />
                  </div>
                </div>

                <button
                  className="button-primary"
                  onClick={() => handleGerarHorarios(grupo.id)}
                >
                  ⚙️ Gerar horários deste período
                </button>
                <span style={{ fontSize: "0.75rem", color: "#4b5563", marginLeft: "0.6rem" }}>
                  Divide o intervalo entre o início e o término igualmente pela
                  quantidade de aulas e substitui a lista de horários abaixo.
                </span>
              </div>

              {/* Séries e turmas */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                  Séries/anos e turmas deste período
                </label>

                {(grupo.series || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.6rem" }}>
                    {(grupo.series || []).map((s, idx) => (
                      <div
                        key={`${s.serie}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          fontSize: "0.82rem",
                          background: "#f9fafb",
                          borderRadius: "6px",
                          padding: "0.4rem 0.6rem",
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          <strong>{s.serie}</strong> – {s.quantidade}{" "}
                          {s.quantidade === 1 ? "turma" : "turmas"}
                        </span>
                        <button
                          className="button-danger"
                          style={{ padding: "0.125rem 0.375rem", fontSize: "0.7rem" }}
                          onClick={() => handleRemoverSerie(grupo.id, idx)}
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="cadastro-field" style={{ minWidth: "160px" }}>
                    <label className="cadastro-label">Série/ano</label>
                    <input
                      className="cadastro-input"
                      value={draft.serie}
                      placeholder="Ex: 7º ano"
                      onChange={(e) =>
                        setNovaSeriePorGrupo({
                          ...novaSeriePorGrupo,
                          [grupo.id]: { ...draft, serie: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="cadastro-field" style={{ maxWidth: "120px" }}>
                    <label className="cadastro-label">Nº de turmas</label>
                    <input
                      className="cadastro-input"
                      type="number"
                      min={1}
                      max={26}
                      value={draft.quantidade}
                      onChange={(e) =>
                        setNovaSeriePorGrupo({
                          ...novaSeriePorGrupo,
                          [grupo.id]: {
                            ...draft,
                            quantidade: Math.max(1, Math.min(26, Number(e.target.value) || 1)),
                          },
                        })
                      }
                    />
                  </div>
                  <button
                    className="button-primary"
                    onClick={() => handleAdicionarSerie(grupo.id)}
                  >
                    + Adicionar série
                  </button>
                </div>

                {turmasGeradas.length > 0 && (
                  <p style={{ fontSize: "0.8rem", color: "#1d4ed8", marginTop: "0.5rem" }}>
                    Turmas geradas: {turmasGeradas.join(", ")}
                  </p>
                )}
              </div>

              {/* Slots do grupo (edição manual / fina) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <label style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    Horários gerados (edição manual, se necessário)
                  </label>
                  <button
                    className="button-primary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => handleAdicionarSlot(grupo.id)}
                  >
                    + Adicionar Horário
                  </button>
                </div>

                {(config.slotsPorGrupo[grupo.id] || []).map((slot, index) => (
                  <div
                    key={slot.id}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      background: "#f9fafb",
                      borderRadius: "4px",
                    }}
                  >
                    <select
                      className="cadastro-select"
                      value={slot.tipo}
                      onChange={(e) =>
                        handleAtualizarSlot(
                          grupo.id,
                          index,
                          "tipo",
                          e.target.value as TipoSlot
                        )
                      }
                      style={{ width: "120px" }}
                    >
                      <option value="aula">Aula</option>
                      <option value="intervalo">Intervalo</option>
                    </select>
                    <input
                      className="cadastro-input"
                      value={slot.label}
                      onChange={(e) =>
                        handleAtualizarSlot(grupo.id, index, "label", e.target.value)
                      }
                      placeholder="Ex: 07:00 - 07:50 (Aula 1)"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="button-danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => handleRemoverSlot(grupo.id, index)}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="cadastro-actions">
        <button className="button-primary" onClick={handleSalvarConfig}>
          <span>💾</span>
          Salvar Configuração
        </button>
        <button className="button-danger" onClick={handleResetar}>
          <span>🔄</span>
          Resetar para Padrão
        </button>
      </div>

      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "#fef3c7",
          borderRadius: "4px",
          fontSize: "0.8rem",
        }}
      >
        <strong>💡 Dica:</strong> Configure o tipo de período, horário de início/término
        e clique em "Gerar horários" para montar as aulas automaticamente. Depois
        cadastre as séries (ex: 6º ano, 3 turmas) para gerar as turmas A, B, C
        automaticamente. Após salvar, a página será recarregada para aplicar as
        mudanças.
      </div>
    </section>
  );
}
