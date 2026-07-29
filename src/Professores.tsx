import { useState } from "react";
import type { ProfessorInfo } from "./professores";
import { carregarProfessores, salvarProfessores } from "./professores";
import { getDiasSemana } from "./scheduleConfig";

interface ProfessoresProps {
  onProfessoresChange?: () => void;
}

function novoProfessor(): ProfessorInfo {
  return {
    id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome: "",
    acumulaCargo: false,
    atuaOutraUnidade: false,
    outraUnidadeNome: "",
    horariosOutraUnidade: {},
  };
}

export function Professores({ onProfessoresChange }: ProfessoresProps) {
  const [professores, setProfessores] = useState<ProfessorInfo[]>(() =>
    carregarProfessores()
  );
  const diasSemana = getDiasSemana();

  function persistir(lista: ProfessorInfo[]) {
    setProfessores(lista);
    salvarProfessores(lista);
    onProfessoresChange?.();
  }

  function handleAdicionar() {
    persistir([...professores, novoProfessor()]);
  }

  function handleRemover(id: string) {
    if (!confirm("Tem certeza que deseja remover este professor do cadastro?")) {
      return;
    }
    persistir(professores.filter((p) => p.id !== id));
  }

  function handleAtualizar<K extends keyof ProfessorInfo>(
    id: string,
    campo: K,
    valor: ProfessorInfo[K]
  ) {
    persistir(
      professores.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    );
  }

  function handleAtualizarDia(
    id: string,
    dia: string,
    campo: "aulasNoDia" | "horarioReferencia",
    valor: number | string
  ) {
    persistir(
      professores.map((p) => {
        if (p.id !== id) return p;
        const atual = p.horariosOutraUnidade[dia] || {
          aulasNoDia: 0,
          horarioReferencia: "",
        };
        return {
          ...p,
          horariosOutraUnidade: {
            ...p.horariosOutraUnidade,
            [dia]: { ...atual, [campo]: valor },
          },
        };
      })
    );
  }

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Professores
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Cadastro de docentes: indique se acumulam cargo e se atuam em outra
          unidade escolar. Para professores em outra unidade, informe quantas
          aulas eles já têm por lá em cada dia — o sistema soma com as aulas
          desta escola e avisa se ultrapassar 10 aulas diárias. Use o mesmo
          nome digitado no cadastro de aulas para o cruzamento funcionar.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button className="button-primary" onClick={handleAdicionar}>
          + Adicionar Professor
        </button>
      </div>

      {professores.length === 0 && (
        <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
          Nenhum professor cadastrado ainda.
        </p>
      )}

      {professores.map((prof) => (
        <div
          key={prof.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div className="cadastro-field" style={{ flex: 1, minWidth: 0 }}>
              <label className="cadastro-label">Nome do(a) professor(a)</label>
              <input
                className="cadastro-input"
                value={prof.nome}
                onChange={(e) => handleAtualizar(prof.id, "nome", e.target.value)}
                placeholder="Nome completo, igual ao usado no cadastro de aulas"
              />
            </div>
            <button
              className="button-danger"
              onClick={() => handleRemover(prof.id)}
              style={{ marginTop: "1.4rem" }}
            >
              Remover
            </button>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={prof.acumulaCargo}
                onChange={(e) => handleAtualizar(prof.id, "acumulaCargo", e.target.checked)}
              />
              Acumula cargo
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={prof.atuaOutraUnidade}
                onChange={(e) => handleAtualizar(prof.id, "atuaOutraUnidade", e.target.checked)}
              />
              Atua em outra unidade escolar
            </label>
          </div>

          {prof.atuaOutraUnidade && (
            <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "0.75rem" }}>
              <div className="cadastro-field" style={{ marginBottom: "0.75rem", maxWidth: "320px" }}>
                <label className="cadastro-label">Nome da outra unidade (opcional)</label>
                <input
                  className="cadastro-input"
                  value={prof.outraUnidadeNome || ""}
                  onChange={(e) => handleAtualizar(prof.id, "outraUnidadeNome", e.target.value)}
                  placeholder="Ex: EE Escola Vizinha"
                />
              </div>

              <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.5rem" }}>
                Aulas por dia na outra unidade
              </label>
              <div className="horario-wrapper">
                <table className="horario-table log-table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Aulas na outra unidade</th>
                      <th>Horário de referência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasSemana.map((dia) => {
                      const info = prof.horariosOutraUnidade[dia];
                      return (
                        <tr key={dia}>
                          <td>{dia}</td>
                          <td>
                            <input
                              className="cadastro-input"
                              type="number"
                              min={0}
                              max={10}
                              style={{ width: "80px" }}
                              value={info?.aulasNoDia ?? 0}
                              onChange={(e) =>
                                handleAtualizarDia(
                                  prof.id,
                                  dia,
                                  "aulasNoDia",
                                  Math.max(0, Math.min(10, Number(e.target.value) || 0))
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="cadastro-input"
                              value={info?.horarioReferencia ?? ""}
                              onChange={(e) =>
                                handleAtualizarDia(prof.id, dia, "horarioReferencia", e.target.value)
                              }
                              placeholder="Ex: 13h às 18h20"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
