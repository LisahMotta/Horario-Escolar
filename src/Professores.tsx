import { useState } from "react";
import type { ProfessorInfo } from "./api";
import {
  atualizarProfessor,
  criarProfessor,
  importarProfessores,
  removerProfessor,
} from "./api";
import { getDiasSemana, getGrupos, getTurmasPorGrupo } from "./scheduleConfig";

interface ProfessoresProps {
  professores: ProfessorInfo[];
  onProfessoresChange: () => void;
  onLog?: (acao: string, detalhes: string) => void;
}

interface FormularioProfessor {
  nome: string;
  disciplinasTexto: string;
  turmas: string[];
  acumulaCargo: boolean;
  atuaOutraUnidade: boolean;
  outraUnidadeNome: string;
  horariosOutraUnidade: Record<
    string,
    { aulasNoDia: number; horarioReferencia?: string }
  >;
}

function formularioVazio(): FormularioProfessor {
  return {
    nome: "",
    disciplinasTexto: "",
    turmas: [],
    acumulaCargo: false,
    atuaOutraUnidade: false,
    outraUnidadeNome: "",
    horariosOutraUnidade: {},
  };
}

function parseDisciplinas(texto: string): string[] {
  return texto
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function Professores({
  professores,
  onProfessoresChange,
  onLog,
}: ProfessoresProps) {
  const diasSemana = getDiasSemana();
  const grupos = getGrupos();

  // Um único formulário, sempre no mesmo lugar: cadastra, limpa e fica
  // pronto para o próximo professor (em vez de abrir um bloco novo a cada
  // clique). O mesmo formulário também é usado para editar um professor já
  // cadastrado — nesse caso ele é pré-preenchido e "Cadastrar" vira "Salvar
  // alterações".
  const [form, setForm] = useState<FormularioProfessor>(() => formularioVazio());
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const [textoImportacao, setTextoImportacao] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<{
    criados: number;
    duplicados: string[];
  } | null>(null);

  function atualizarCampo<K extends keyof FormularioProfessor>(
    campo: K,
    valor: FormularioProfessor[K]
  ) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function alternarTurma(turma: string) {
    setForm((f) => ({
      ...f,
      turmas: f.turmas.includes(turma)
        ? f.turmas.filter((t) => t !== turma)
        : [...f.turmas, turma],
    }));
  }

  function atualizarDia(
    dia: string,
    campo: "aulasNoDia" | "horarioReferencia",
    valor: number | string
  ) {
    setForm((f) => {
      const atual = f.horariosOutraUnidade[dia] || {
        aulasNoDia: 0,
        horarioReferencia: "",
      };
      return {
        ...f,
        horariosOutraUnidade: {
          ...f.horariosOutraUnidade,
          [dia]: { ...atual, [campo]: valor },
        },
      };
    });
  }

  function iniciarEdicao(p: ProfessorInfo) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      disciplinasTexto: p.disciplinas.join(", "),
      turmas: p.turmas,
      acumulaCargo: p.acumulaCargo,
      atuaOutraUnidade: p.atuaOutraUnidade,
      outraUnidadeNome: p.outraUnidadeNome || "",
      horariosOutraUnidade: p.horariosOutraUnidade,
    });
    setErro(null);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formularioVazio());
    setErro(null);
  }

  async function handleSalvar() {
    const nome = form.nome.trim();
    if (!nome) {
      setErro("Informe o nome do professor.");
      return;
    }

    const dados = {
      nome,
      disciplinas: parseDisciplinas(form.disciplinasTexto),
      turmas: form.turmas,
      acumulaCargo: form.acumulaCargo,
      atuaOutraUnidade: form.atuaOutraUnidade,
      outraUnidadeNome: form.outraUnidadeNome.trim(),
      horariosOutraUnidade: form.horariosOutraUnidade,
    };

    setSalvando(true);
    setErro(null);
    try {
      if (editandoId) {
        await atualizarProfessor(editandoId, dados);
        onLog?.("editar_professor", `Professor atualizado: ${nome}.`);
      } else {
        await criarProfessor(dados);
        onLog?.("cadastrar_professor", `Professor cadastrado: ${nome}.`);
      }
      onProfessoresChange();
      // Limpa e mantém o mesmo formulário aberto e pronto para o próximo
      // cadastro — não abre um bloco novo.
      setEditandoId(null);
      setForm(formularioVazio());
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao salvar professor."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(p: ProfessorInfo) {
    if (!confirm(`Remover "${p.nome}" do cadastro de professores?`)) return;
    try {
      await removerProfessor(p.id);
      onLog?.("remover_professor", `Professor removido: ${p.nome}.`);
      onProfessoresChange();
      if (editandoId === p.id) cancelarEdicao();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Erro ao remover professor."
      );
    }
  }

  async function handleImportar() {
    const nomes = textoImportacao
      .split(/\r?\n|;/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (nomes.length === 0) return;

    setImportando(true);
    setResultadoImportacao(null);
    try {
      const resultado = await importarProfessores(nomes);
      onLog?.(
        "importar_professores",
        `${resultado.criados.length} professor(es) importado(s)` +
          (resultado.duplicados.length
            ? `, ${resultado.duplicados.length} ignorado(s) por já existir(em).`
            : ".")
      );
      setResultadoImportacao({
        criados: resultado.criados.length,
        duplicados: resultado.duplicados,
      });
      setTextoImportacao("");
      onProfessoresChange();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Erro ao importar professores."
      );
    } finally {
      setImportando(false);
    }
  }

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Professores
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Cadastre um professor por vez: nome, disciplinas que leciona, se
          acumula cargo e se atua em outra unidade escolar. Ao clicar em
          "Cadastrar", o professor é salvo e o campo já fica pronto para o
          próximo, sem abrir um bloco novo. Para professores em outra unidade,
          informe quantas aulas eles já têm por lá em cada dia — o sistema
          soma com as aulas desta escola e avisa se ultrapassar 10 aulas
          diárias. Use o mesmo nome digitado no cadastro de aulas para o
          cruzamento funcionar.
        </p>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          <div className="cadastro-field" style={{ flex: "1 1 220px" }}>
            <label className="cadastro-label">Nome do(a) professor(a)</label>
            <input
              className="cadastro-input"
              value={form.nome}
              onChange={(e) => atualizarCampo("nome", e.target.value)}
              placeholder="Nome completo, igual ao usado no cadastro de aulas"
            />
          </div>
          <div className="cadastro-field" style={{ flex: "1 1 220px" }}>
            <label className="cadastro-label">
              Disciplinas (separadas por vírgula)
            </label>
            <input
              className="cadastro-input"
              value={form.disciplinasTexto}
              onChange={(e) =>
                atualizarCampo("disciplinasTexto", e.target.value)
              }
              placeholder="Ex: Matemática, Física"
            />
          </div>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label
            className="cadastro-label"
            style={{ display: "block", marginBottom: "0.4rem" }}
          >
            Turmas atribuídas
          </label>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Ao montar o horário, escolher este professor já vai sugerir só
            estas turmas — e elas entram automaticamente se você usar
            "Gerar horário automaticamente".
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              background: "#f9fafb",
              borderRadius: "8px",
              padding: "0.75rem",
            }}
          >
            {grupos.map((g) => {
              const turmasDoGrupo = getTurmasPorGrupo(g.id);
              if (turmasDoGrupo.length === 0) return null;
              return (
                <div key={g.id}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#4b5563",
                      display: "block",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {g.nome}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    {turmasDoGrupo.map((turma) => (
                      <label
                        key={turma}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.turmas.includes(turma)}
                          onChange={() => alternarTurma(turma)}
                        />
                        {turma}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
            }}
          >
            <input
              type="checkbox"
              checked={form.acumulaCargo}
              onChange={(e) =>
                atualizarCampo("acumulaCargo", e.target.checked)
              }
            />
            Acumula cargo
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
            }}
          >
            <input
              type="checkbox"
              checked={form.atuaOutraUnidade}
              onChange={(e) =>
                atualizarCampo("atuaOutraUnidade", e.target.checked)
              }
            />
            Atua em outra unidade escolar
          </label>
        </div>

        {form.atuaOutraUnidade && (
          <div
            style={{
              background: "#f9fafb",
              borderRadius: "8px",
              padding: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div
              className="cadastro-field"
              style={{ marginBottom: "0.75rem", maxWidth: "320px" }}
            >
              <label className="cadastro-label">
                Nome da outra unidade (opcional)
              </label>
              <input
                className="cadastro-input"
                value={form.outraUnidadeNome}
                onChange={(e) =>
                  atualizarCampo("outraUnidadeNome", e.target.value)
                }
                placeholder="Ex: EE Escola Vizinha"
              />
            </div>

            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
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
                    const info = form.horariosOutraUnidade[dia];
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
                              atualizarDia(
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
                              atualizarDia(dia, "horarioReferencia", e.target.value)
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

        {erro && (
          <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            {erro}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            className="button-primary"
            onClick={handleSalvar}
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : editandoId
              ? "Salvar alterações"
              : "Cadastrar"}
          </button>
          {editandoId && (
            <button
              className="button-secondary"
              onClick={cancelarEdicao}
              disabled={salvando}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <button
          className="button-secondary"
          onClick={() => setMostrarImportacao((v) => !v)}
        >
          {mostrarImportacao
            ? "Fechar importação em lote"
            : "Importar lista de professores"}
        </button>

        {mostrarImportacao && (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "1rem",
              marginTop: "0.75rem",
              background: "#fff",
            }}
          >
            <p style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: "0.5rem" }}>
              Cole um nome por linha. Os professores são cadastrados sem
              disciplina definida ainda — depois é só clicar em "Editar" na
              lista abaixo para completar as disciplinas e o restante de cada
              um.
            </p>
            <textarea
              className="cadastro-input"
              style={{ width: "100%", minHeight: "120px", fontFamily: "inherit" }}
              value={textoImportacao}
              onChange={(e) => setTextoImportacao(e.target.value)}
              placeholder={"Ex:\nMaria Silva\nJoão Souza\nAna Pereira"}
            />
            <div style={{ marginTop: "0.75rem" }}>
              <button
                className="button-primary"
                onClick={handleImportar}
                disabled={importando || !textoImportacao.trim()}
              >
                {importando ? "Importando..." : "Importar"}
              </button>
            </div>
            {resultadoImportacao && (
              <p style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
                {resultadoImportacao.criados} professor(es) importado(s).
                {resultadoImportacao.duplicados.length > 0 && (
                  <>
                    {" "}
                    {resultadoImportacao.duplicados.length} ignorado(s) por já
                    constar(em) no cadastro:{" "}
                    {resultadoImportacao.duplicados.join(", ")}.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        Professores cadastrados ({professores.length})
      </h3>
      {professores.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
          Nenhum professor cadastrado ainda.
        </p>
      ) : (
        <div className="horario-wrapper">
          <table className="horario-table log-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Disciplinas</th>
                <th>Turmas</th>
                <th>Acumula cargo</th>
                <th>Outra unidade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {professores.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.disciplinas.length > 0 ? p.disciplinas.join(", ") : "—"}</td>
                  <td>{p.turmas.length > 0 ? p.turmas.join(", ") : "—"}</td>
                  <td>{p.acumulaCargo ? "Sim" : "Não"}</td>
                  <td>{p.atuaOutraUnidade ? p.outraUnidadeNome || "Sim" : "Não"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="button-secondary" onClick={() => iniciarEdicao(p)}>
                        Editar
                      </button>
                      <button className="button-danger" onClick={() => handleRemover(p)}>
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
