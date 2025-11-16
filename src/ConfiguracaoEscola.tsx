import { useState, useEffect } from "react";
import type {
  EscolaConfig,
  GrupoInfo,
  TimeSlot,
  TipoSlot,
  GrupoId,
} from "./scheduleConfig";
import {
  obterConfiguracao,
  atualizarConfiguracao,
  resetarConfiguracao,
  carregarConfiguracao,
} from "./scheduleConfig";

interface ConfiguracaoEscolaProps {
  onConfigChange?: () => void;
}

export function ConfiguracaoEscola({ onConfigChange }: ConfiguracaoEscolaProps) {
  const [config, setConfig] = useState<EscolaConfig>(() => obterConfiguracao());
  const [grupoEditando, setGrupoEditando] = useState<GrupoId | null>(null);

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
      nome: "Novo grupo",
      descricao: "Descrição do grupo",
    };
    setConfig({
      ...config,
      grupos: [...config.grupos, novoGrupo],
      slotsPorGrupo: {
        ...config.slotsPorGrupo,
        [novoId]: [
          { id: 1, label: "08:00 - 08:50 (Aula 1)", tipo: "aula" },
        ],
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
          Configure os horários, grupos de turmas e dias da semana da sua escola.
          Apenas usuários com perfil de Direção ou Vice-direção podem editar.
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

      {/* Grupos */}
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
            Grupos de Turmas
          </label>
          <button className="button-primary" onClick={handleAdicionarGrupo}>
            + Adicionar Grupo
          </button>
        </div>

        {config.grupos.map((grupo) => (
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
                  placeholder="Nome do grupo"
                  style={{ marginBottom: "0.5rem" }}
                />
                <input
                  className="cadastro-input"
                  value={grupo.descricao}
                  onChange={(e) =>
                    handleAtualizarGrupo(grupo.id, "descricao", e.target.value)
                  }
                  placeholder="Descrição (ex: Manhã 07h00 às 12h20)"
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

            {/* Slots do grupo */}
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
                  Horários
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
        ))}
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
        <strong>💡 Dica:</strong> Após salvar, a página será recarregada para
        aplicar as mudanças. Certifique-se de que todos os grupos têm pelo menos
        um horário configurado.
      </div>
    </section>
  );
}

