import { useState, useEffect, useMemo } from "react";
import type { HorariosPorGrupo } from "./types";
import { getGrupos, getSlotsPorGrupo, getDiasSemana } from "./scheduleConfig";
import { buscarEstatisticasHistorico } from "./api";
import type { EstatisticasHistorico } from "./api";

interface DashboardProps {
  horarios: HorariosPorGrupo;
}

export function Dashboard({ horarios }: DashboardProps) {
  const [estatisticasHistorico, setEstatisticasHistorico] = useState<EstatisticasHistorico | null>(null);

  const grupos = getGrupos();
  const diasSemana = getDiasSemana();

  useEffect(() => {
    async function carregarEstatisticas() {
      try {
        const stats = await buscarEstatisticasHistorico();
        setEstatisticasHistorico(stats);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      }
    }
    carregarEstatisticas();
  }, []);

  // Calcula estatísticas dos horários
  const estatisticas = useMemo(() => {
    const stats = {
      totalAulas: 0,
      totalProfessores: 0,
      totalTurmas: 0,
      totalDisciplinas: 0,
      gruposComHorario: 0,
      aulasPorGrupo: {} as Record<string, number>,
      professores: new Set<string>(),
      turmas: new Set<string>(),
      disciplinas: new Set<string>(),
      cargaPorProfessor: {} as Record<string, number>,
      cargaPorTurma: {} as Record<string, number>,
      cargaPorDisciplina: {} as Record<string, number>,
      ocupacaoPorDia: {} as Record<string, number>,
      ocupacaoPorGrupo: {} as Record<string, number>,
    };

    grupos.forEach((grupo) => {
      const horarioGrupo = horarios[grupo.id];
      if (!horarioGrupo) return;

      let aulasGrupo = 0;
      const slots = getSlotsPorGrupo()[grupo.id] || [];

      diasSemana.forEach((dia) => {
        const slotsDia = horarioGrupo[dia] || {};
        let aulasDia = 0;

        slots.forEach((slot) => {
          if (slot.tipo !== "aula") return;
          const aula = slotsDia[slot.id];
          if (aula) {
            aulasGrupo++;
            aulasDia++;
            stats.totalAulas++;

            if (aula.professor) {
              const prof = aula.professor.trim();
              stats.professores.add(prof);
              stats.cargaPorProfessor[prof] = (stats.cargaPorProfessor[prof] || 0) + 1;
            }

            if (aula.turma) {
              const turma = aula.turma.trim();
              stats.turmas.add(turma);
              stats.cargaPorTurma[turma] = (stats.cargaPorTurma[turma] || 0) + 1;
            }

            if (aula.disciplina) {
              const disc = aula.disciplina.trim();
              stats.disciplinas.add(disc);
              stats.cargaPorDisciplina[disc] = (stats.cargaPorDisciplina[disc] || 0) + 1;
            }
          }
        });

        stats.ocupacaoPorDia[dia] = (stats.ocupacaoPorDia[dia] || 0) + aulasDia;
      });

      if (aulasGrupo > 0) {
        stats.gruposComHorario++;
        stats.aulasPorGrupo[grupo.id] = aulasGrupo;
        stats.ocupacaoPorGrupo[grupo.id] = aulasGrupo;
      }
    });

    stats.totalProfessores = stats.professores.size;
    stats.totalTurmas = stats.turmas.size;
    stats.totalDisciplinas = stats.disciplinas.size;

    return stats;
  }, [horarios, grupos, diasSemana]);

  // Top 10 professores com mais aulas
  const topProfessores = useMemo(() => {
    return Object.entries(estatisticas.cargaPorProfessor)
      .map(([professor, aulas]) => ({ professor, aulas }))
      .sort((a, b) => b.aulas - a.aulas)
      .slice(0, 10);
  }, [estatisticas.cargaPorProfessor]);

  // Top 10 turmas com mais aulas
  const topTurmas = useMemo(() => {
    return Object.entries(estatisticas.cargaPorTurma)
      .map(([turma, aulas]) => ({ turma, aulas }))
      .sort((a, b) => b.aulas - a.aulas)
      .slice(0, 10);
  }, [estatisticas.cargaPorTurma]);

  // Top 10 disciplinas mais frequentes
  const topDisciplinas = useMemo(() => {
    return Object.entries(estatisticas.cargaPorDisciplina)
      .map(([disciplina, aulas]) => ({ disciplina, aulas }))
      .sort((a, b) => b.aulas - a.aulas)
      .slice(0, 10);
  }, [estatisticas.cargaPorDisciplina]);

  // Distribuição de ocupação por dia
  const ocupacaoPorDiaArray = useMemo(() => {
    return diasSemana.map((dia) => ({
      dia,
      aulas: estatisticas.ocupacaoPorDia[dia] || 0,
    }));
  }, [estatisticas.ocupacaoPorDia, diasSemana]);

  // Distribuição de ocupação por grupo
  const ocupacaoPorGrupoArray = useMemo(() => {
    return grupos.map((grupo) => ({
      grupo: grupo.nome,
      aulas: estatisticas.ocupacaoPorGrupo[grupo.id] || 0,
    }));
  }, [estatisticas.ocupacaoPorGrupo, grupos]);

  // Calcula média de aulas por dia
  const mediaAulasPorDia = useMemo(() => {
    const total = ocupacaoPorDiaArray.reduce((sum, item) => sum + item.aulas, 0);
    return diasSemana.length > 0 ? (total / diasSemana.length).toFixed(1) : "0";
  }, [ocupacaoPorDiaArray, diasSemana.length]);

  // Calcula taxa de ocupação geral
  const taxaOcupacao = useMemo(() => {
    let totalSlots = 0;
    let slotsPreenchidos = 0;

    grupos.forEach((grupo) => {
      const slots = getSlotsPorGrupo()[grupo.id] || [];
      const numAulas = slots.filter((s) => s.tipo === "aula").length;
      totalSlots += numAulas * diasSemana.length;

      const horarioGrupo = horarios[grupo.id];
      if (horarioGrupo) {
        diasSemana.forEach((dia) => {
          const slotsDia = horarioGrupo[dia] || {};
          slots.forEach((slot) => {
            if (slot.tipo === "aula") {
              if (slotsDia[slot.id]) {
                slotsPreenchidos++;
              }
            }
          });
        });
      }
    });

    return totalSlots > 0 ? ((slotsPreenchidos / totalSlots) * 100).toFixed(1) : "0";
  }, [horarios, grupos, diasSemana]);

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Dashboard - Estatísticas do Sistema
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Visão geral das estatísticas e métricas do sistema de horários.
        </p>
      </div>

      {/* Cards de Métricas Principais */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Total de Aulas
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {estatisticas.totalAulas}
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Professores
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {estatisticas.totalProfessores}
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Turmas
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {estatisticas.totalTurmas}
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Disciplinas
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {estatisticas.totalDisciplinas}
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Taxa de Ocupação
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {taxaOcupacao}%
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            background: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Média Aulas/Dia
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>
            {mediaAulasPorDia}
          </div>
        </div>
      </div>

      {/* Gráficos e Tabelas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Distribuição por Dia */}
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Ocupação por Dia da Semana</h3>
          <div className="horario-wrapper">
            <table className="horario-table log-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Aulas</th>
                  <th>Visualização</th>
                </tr>
              </thead>
              <tbody>
                {ocupacaoPorDiaArray.map((item) => {
                  const maxAulas = Math.max(...ocupacaoPorDiaArray.map((i) => i.aulas), 1);
                  const porcentagem = (item.aulas / maxAulas) * 100;
                  return (
                    <tr key={item.dia}>
                      <td>{item.dia}</td>
                      <td>{item.aulas}</td>
                      <td>
                        <div
                          style={{
                            width: "100%",
                            height: "20px",
                            background: "#e5e7eb",
                            borderRadius: "4px",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              width: `${porcentagem}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                              transition: "width 0.3s",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: porcentagem > 50 ? "white" : "#374151",
                            }}
                          >
                            {item.aulas}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribuição por Grupo */}
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Ocupação por Grupo</h3>
          <div className="horario-wrapper">
            <table className="horario-table log-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Aulas</th>
                  <th>Visualização</th>
                </tr>
              </thead>
              <tbody>
                {ocupacaoPorGrupoArray.map((item) => {
                  const maxAulas = Math.max(...ocupacaoPorGrupoArray.map((i) => i.aulas), 1);
                  const porcentagem = (item.aulas / maxAulas) * 100;
                  return (
                    <tr key={item.grupo}>
                      <td>{item.grupo}</td>
                      <td>{item.aulas}</td>
                      <td>
                        <div
                          style={{
                            width: "100%",
                            height: "20px",
                            background: "#e5e7eb",
                            borderRadius: "4px",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              width: `${porcentagem}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)",
                              transition: "width 0.3s",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: porcentagem > 50 ? "white" : "#374151",
                            }}
                          >
                            {item.aulas}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Rankings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Top Professores */}
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Top 10 Professores</h3>
          <div className="horario-wrapper">
            <table className="horario-table log-table">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Aulas</th>
                </tr>
              </thead>
              <tbody>
                {topProfessores.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", color: "#6b7280" }}>
                      Nenhum professor cadastrado
                    </td>
                  </tr>
                ) : (
                  topProfessores.map((item, idx) => (
                    <tr key={item.professor}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background:
                              idx === 0
                                ? "#fbbf24"
                                : idx === 1
                                ? "#94a3b8"
                                : idx === 2
                                ? "#f97316"
                                : "#e5e7eb",
                            textAlign: "center",
                            lineHeight: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            marginRight: "0.5rem",
                            color: idx < 3 ? "white" : "#374151",
                          }}
                        >
                          {idx + 1}
                        </span>
                        {item.professor}
                      </td>
                      <td>
                        <strong>{item.aulas}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Turmas */}
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Top 10 Turmas</h3>
          <div className="horario-wrapper">
            <table className="horario-table log-table">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Aulas</th>
                </tr>
              </thead>
              <tbody>
                {topTurmas.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", color: "#6b7280" }}>
                      Nenhuma turma cadastrada
                    </td>
                  </tr>
                ) : (
                  topTurmas.map((item, idx) => (
                    <tr key={item.turma}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background:
                              idx === 0
                                ? "#fbbf24"
                                : idx === 1
                                ? "#94a3b8"
                                : idx === 2
                                ? "#f97316"
                                : "#e5e7eb",
                            textAlign: "center",
                            lineHeight: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            marginRight: "0.5rem",
                            color: idx < 3 ? "white" : "#374151",
                          }}
                        >
                          {idx + 1}
                        </span>
                        {item.turma}
                      </td>
                      <td>
                        <strong>{item.aulas}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Disciplinas */}
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Top 10 Disciplinas</h3>
          <div className="horario-wrapper">
            <table className="horario-table log-table">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Aulas</th>
                </tr>
              </thead>
              <tbody>
                {topDisciplinas.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", color: "#6b7280" }}>
                      Nenhuma disciplina cadastrada
                    </td>
                  </tr>
                ) : (
                  topDisciplinas.map((item, idx) => (
                    <tr key={item.disciplina}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background:
                              idx === 0
                                ? "#fbbf24"
                                : idx === 1
                                ? "#94a3b8"
                                : idx === 2
                                ? "#f97316"
                                : "#e5e7eb",
                            textAlign: "center",
                            lineHeight: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            marginRight: "0.5rem",
                            color: idx < 3 ? "white" : "#374151",
                          }}
                        >
                          {idx + 1}
                        </span>
                        {item.disciplina}
                      </td>
                      <td>
                        <strong>{item.aulas}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Estatísticas de Atividade (do histórico) */}
      {estatisticasHistorico && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Estatísticas de Atividade</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Total de Alterações
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {estatisticasHistorico.totalAlteracoes}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Usuários Ativos
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {estatisticasHistorico.totalUsuarios}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Primeira Alteração
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {estatisticasHistorico.primeiraAlteracao
                  ? new Date(estatisticasHistorico.primeiraAlteracao).toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Última Alteração
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {estatisticasHistorico.ultimaAlteracao
                  ? new Date(estatisticasHistorico.ultimaAlteracao).toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo por Grupo */}
      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Resumo por Grupo</h3>
        <div className="horario-wrapper">
          <table className="horario-table log-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Total de Aulas</th>
                <th>Professores</th>
                <th>Turmas</th>
                <th>Disciplinas</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo) => {
                const horarioGrupo = horarios[grupo.id];
                if (!horarioGrupo) {
                  return (
                    <tr key={grupo.id}>
                      <td>{grupo.nome}</td>
                      <td colSpan={4} style={{ textAlign: "center", color: "#6b7280" }}>
                        Sem horário cadastrado
                      </td>
                    </tr>
                  );
                }

                const professoresGrupo = new Set<string>();
                const turmasGrupo = new Set<string>();
                const disciplinasGrupo = new Set<string>();
                let totalAulasGrupo = 0;
                const slots = getSlotsPorGrupo()[grupo.id] || [];

                diasSemana.forEach((dia) => {
                  const slotsDia = horarioGrupo[dia] || {};
                  slots.forEach((slot) => {
                    if (slot.tipo !== "aula") return;
                    const aula = slotsDia[slot.id];
                    if (aula) {
                      totalAulasGrupo++;
                      if (aula.professor) professoresGrupo.add(aula.professor.trim());
                      if (aula.turma) turmasGrupo.add(aula.turma.trim());
                      if (aula.disciplina) disciplinasGrupo.add(aula.disciplina.trim());
                    }
                  });
                });

                return (
                  <tr key={grupo.id}>
                    <td>
                      <strong>{grupo.nome}</strong>
                    </td>
                    <td>{totalAulasGrupo}</td>
                    <td>{professoresGrupo.size}</td>
                    <td>{turmasGrupo.size}</td>
                    <td>{disciplinasGrupo.size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

