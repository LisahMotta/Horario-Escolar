import { useState, useEffect } from "react";
import type {
  HistoricoAlteracao,
  EstatisticasHistorico,
  Snapshot,
  HorariosPorGrupo,
} from "./api";
import {
  buscarHistorico,
  buscarEstatisticasHistorico,
  buscarSnapshots,
  criarSnapshot,
  deletarSnapshot,
  buscarSnapshot,
} from "./api";
import { getGrupos } from "./scheduleConfig";

interface HistoricoAlteracoesProps {
  usuarioId?: number;
  horariosAtuais?: HorariosPorGrupo;
  onRestaurarSnapshot?: (dados: HorariosPorGrupo) => void;
}

const TIPOS_ALTERACAO_LABEL: Record<string, string> = {
  criar: "Criado",
  atualizar: "Atualizado",
  deletar: "Deletado",
  limpar: "Limpo",
};

const TIPOS_ALTERACAO_COR: Record<string, string> = {
  criar: "#10b981",
  atualizar: "#3b82f6",
  deletar: "#ef4444",
  limpar: "#f59e0b",
};

export function HistoricoAlteracoes({
  usuarioId,
  horariosAtuais,
  onRestaurarSnapshot,
}: HistoricoAlteracoesProps) {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasHistorico | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<"historico" | "snapshots" | "estatisticas">("historico");

  // Filtros
  const [filtroGrupo, setFiltroGrupo] = useState<string>("");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>("");
  const [filtroDataFim, setFiltroDataFim] = useState<string>("");
  const [limite, setLimite] = useState<number>(100);

  // Snapshot
  const [nomeSnapshot, setNomeSnapshot] = useState("");
  const [descricaoSnapshot, setDescricaoSnapshot] = useState("");
  const [snapshotSelecionado, setSnapshotSelecionado] = useState<number | null>(null);

  const grupos = getGrupos();
  const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  useEffect(() => {
    carregarDados();
  }, [aba, filtroGrupo, filtroDia, filtroTipo, filtroDataInicio, filtroDataFim, limite]);

  async function carregarDados() {
    setCarregando(true);
    try {
      if (aba === "historico") {
        const dados = await buscarHistorico({
          grupoId: filtroGrupo || undefined,
          dia: filtroDia || undefined,
          usuarioId: usuarioId,
          tipoAlteracao: filtroTipo || undefined,
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
          limite,
        });
        setHistorico(dados);
      } else if (aba === "snapshots") {
        const dados = await buscarSnapshots(50);
        setSnapshots(dados);
      } else if (aba === "estatisticas") {
        const dados = await buscarEstatisticasHistorico({
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
        });
        setEstatisticas(dados);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar dados do histórico.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleCriarSnapshot(horarios: HorariosPorGrupo) {
    if (!nomeSnapshot.trim()) {
      const nome = prompt("Nome do snapshot (ex: Horário de Março 2025):");
      if (!nome || !nome.trim()) {
        return;
      }
      setNomeSnapshot(nome.trim());
    }

    try {
      await criarSnapshot(
        nomeSnapshot.trim() || `Snapshot ${new Date().toLocaleString("pt-BR")}`,
        descricaoSnapshot.trim() || null,
        horarios
      );
      alert("Snapshot criado com sucesso!");
      setNomeSnapshot("");
      setDescricaoSnapshot("");
      carregarDados();
    } catch (error: any) {
      alert(`Erro ao criar snapshot: ${error.message}`);
    }
  }

  async function handleDeletarSnapshot(id: number) {
    if (!confirm("Tem certeza que deseja deletar este snapshot?")) {
      return;
    }

    try {
      await deletarSnapshot(id);
      alert("Snapshot deletado com sucesso!");
      carregarDados();
    } catch (error: any) {
      alert(`Erro ao deletar snapshot: ${error.message}`);
    }
  }

  async function handleRestaurarSnapshot(id: number) {
    if (!confirm("Tem certeza que deseja restaurar este snapshot? Isso substituirá o horário atual.")) {
      return;
    }

    try {
      const snapshot = await buscarSnapshot(id);
      if (onRestaurarSnapshot) {
        onRestaurarSnapshot(snapshot.dados);
        alert("Snapshot restaurado com sucesso!");
      }
    } catch (error: any) {
      alert(`Erro ao restaurar snapshot: ${error.message}`);
    }
  }

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Histórico de Alterações
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Visualize todas as alterações feitas nos horários, com informações sobre quem alterou, quando e o que foi modificado.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        <button
          onClick={() => setAba("historico")}
          style={{
            padding: "0.75rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: aba === "historico" ? "2px solid #667eea" : "2px solid transparent",
            color: aba === "historico" ? "#667eea" : "#6b7280",
            fontWeight: aba === "historico" ? 600 : 400,
          }}
        >
          Histórico
        </button>
        <button
          onClick={() => setAba("snapshots")}
          style={{
            padding: "0.75rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: aba === "snapshots" ? "2px solid #667eea" : "2px solid transparent",
            color: aba === "snapshots" ? "#667eea" : "#6b7280",
            fontWeight: aba === "snapshots" ? 600 : 400,
          }}
        >
          Versões (Snapshots)
        </button>
        <button
          onClick={() => setAba("estatisticas")}
          style={{
            padding: "0.75rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: aba === "estatisticas" ? "2px solid #667eea" : "2px solid transparent",
            color: aba === "estatisticas" ? "#667eea" : "#6b7280",
            fontWeight: aba === "estatisticas" ? 600 : 400,
          }}
        >
          Estatísticas
        </button>
      </div>

      {/* Filtros (apenas para histórico) */}
      {aba === "historico" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <select
            className="cadastro-select"
            value={filtroGrupo}
            onChange={(e) => setFiltroGrupo(e.target.value)}
            style={{ minWidth: "150px" }}
          >
            <option value="">Todos os grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>

          <select
            className="cadastro-select"
            value={filtroDia}
            onChange={(e) => setFiltroDia(e.target.value)}
            style={{ minWidth: "120px" }}
          >
            <option value="">Todos os dias</option>
            {diasSemana.map((dia) => (
              <option key={dia} value={dia}>
                {dia}
              </option>
            ))}
          </select>

          <select
            className="cadastro-select"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ minWidth: "120px" }}
          >
            <option value="">Todos os tipos</option>
            <option value="criar">Criado</option>
            <option value="atualizar">Atualizado</option>
            <option value="limpar">Limpo</option>
            <option value="deletar">Deletado</option>
          </select>

          <input
            type="date"
            className="cadastro-input"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            placeholder="Data início"
            style={{ minWidth: "140px" }}
          />

          <input
            type="date"
            className="cadastro-input"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            placeholder="Data fim"
            style={{ minWidth: "140px" }}
          />

          <input
            type="number"
            className="cadastro-input"
            value={limite}
            onChange={(e) => setLimite(parseInt(e.target.value) || 100)}
            placeholder="Limite"
            style={{ width: "80px" }}
            min={1}
            max={1000}
          />
        </div>
      )}

      {/* Conteúdo da aba Histórico */}
      {aba === "historico" && (
        <div>
          {carregando ? (
            <p style={{ textAlign: "center", padding: "2rem" }}>Carregando...</p>
          ) : historico.length === 0 ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
              Nenhuma alteração encontrada com os filtros selecionados.
            </p>
          ) : (
            <div className="horario-wrapper">
              <table className="horario-table log-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>Tipo</th>
                    <th>Grupo</th>
                    <th>Dia</th>
                    <th>Aula</th>
                    <th>Campo</th>
                    <th>Valor Anterior</th>
                    <th>Valor Novo</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: "0.8rem" }}>
                        {new Date(item.timestamp).toLocaleString("pt-BR")}
                      </td>
                      <td>
                        {item.usuario.nome}
                        <br />
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {item.usuario.perfil}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            background: TIPOS_ALTERACAO_COR[item.tipoAlteracao] + "20",
                            color: TIPOS_ALTERACAO_COR[item.tipoAlteracao],
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {TIPOS_ALTERACAO_LABEL[item.tipoAlteracao]}
                        </span>
                      </td>
                      <td>{item.grupoId || "—"}</td>
                      <td>{item.dia || "—"}</td>
                      <td>{item.slotId !== null ? `Slot ${item.slotId}` : "—"}</td>
                      <td>{item.campoAlterado || "—"}</td>
                      <td style={{ fontSize: "0.8rem", maxWidth: "150px" }}>
                        {item.valorAnterior !== null
                          ? typeof item.valorAnterior === "string"
                            ? item.valorAnterior || "vazio"
                            : JSON.stringify(item.valorAnterior)
                          : "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem", maxWidth: "150px" }}>
                        {item.valorNovo !== null
                          ? typeof item.valorNovo === "string"
                            ? item.valorNovo || "vazio"
                            : JSON.stringify(item.valorNovo)
                          : "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>{item.detalhes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da aba Snapshots */}
      {aba === "snapshots" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
              Criar Nova Versão
            </h3>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                className="cadastro-input"
                value={nomeSnapshot}
                onChange={(e) => setNomeSnapshot(e.target.value)}
                placeholder="Nome da versão (ex: Horário de Março 2025)"
                style={{ flex: 1 }}
              />
              <input
                className="cadastro-input"
                value={descricaoSnapshot}
                onChange={(e) => setDescricaoSnapshot(e.target.value)}
                placeholder="Descrição (opcional)"
                style={{ flex: 1 }}
              />
            </div>
            <button
              className="button-primary"
              onClick={() => {
                if (!horariosAtuais) {
                  alert("Horários atuais não disponíveis.");
                  return;
                }
                handleCriarSnapshot(horariosAtuais);
              }}
              disabled={!horariosAtuais}
              style={{ marginTop: "0.5rem" }}
            >
              💾 Criar Snapshot dos Horários Atuais
            </button>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem" }}>
              💡 Cria uma versão completa do horário atual para restaurar depois.
            </p>
          </div>

          {carregando ? (
            <p style={{ textAlign: "center", padding: "2rem" }}>Carregando...</p>
          ) : snapshots.length === 0 ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
              Nenhum snapshot criado ainda.
            </p>
          ) : (
            <div className="horario-wrapper">
              <table className="horario-table log-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Criado por</th>
                    <th>Data/Hora</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td>
                        <strong>{snapshot.nome}</strong>
                      </td>
                      <td>{snapshot.descricao || "—"}</td>
                      <td>
                        {snapshot.usuario.nome}
                        <br />
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {snapshot.usuario.perfil}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>
                        {new Date(snapshot.criadoEm).toLocaleString("pt-BR")}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="button-primary"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => handleRestaurarSnapshot(snapshot.id)}
                          >
                            ⏪ Restaurar
                          </button>
                          <button
                            className="button-danger"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => handleDeletarSnapshot(snapshot.id)}
                          >
                            🗑️ Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da aba Estatísticas */}
      {aba === "estatisticas" && estatisticas && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Total de Alterações
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {estatisticas.totalAlteracoes}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Usuários Ativos
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {estatisticas.totalUsuarios}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                Grupos Modificados
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {estatisticas.totalGrupos}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Alterações por Tipo
              </h3>
              <div className="horario-wrapper">
                <table className="horario-table log-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estatisticas.porTipo.map((item) => (
                      <tr key={item.tipo}>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              background: TIPOS_ALTERACAO_COR[item.tipo] + "20",
                              color: TIPOS_ALTERACAO_COR[item.tipo],
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {TIPOS_ALTERACAO_LABEL[item.tipo]}
                          </span>
                        </td>
                        <td>{item.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Top 10 Usuários Mais Ativos
              </h3>
              <div className="horario-wrapper">
                <table className="horario-table log-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Perfil</th>
                      <th>Alterações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estatisticas.porUsuario.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.nome}</td>
                        <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                          {item.perfil}
                        </td>
                        <td>{item.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

