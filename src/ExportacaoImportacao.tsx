import { useState } from "react";
import type { HorariosPorGrupo } from "./types";
import { getGrupos, getSlotsPorGrupo, getDiasSemana, obterConfiguracao, salvarConfiguracao } from "./scheduleConfig";
import { salvarHorario } from "./api";

interface ExportacaoImportacaoProps {
  horarios: HorariosPorGrupo;
  onHorariosAtualizados: () => void;
}

export function ExportacaoImportacao({
  horarios,
  onHorariosAtualizados,
}: ExportacaoImportacaoProps) {
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const grupos = getGrupos();
  const diasSemana = getDiasSemana();
  const config = obterConfiguracao();

  // ========== EXPORTAÇÕES ==========

  function downloadJSON(data: any, nomeArquivo: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCSV(conteudo: string, nomeArquivo: string) {
    const blob = new Blob(["\ufeff" + conteudo], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarHorariosJSON() {
    try {
      setProcessando(true);
      const dados = {
        versao: "1.0",
        dataExportacao: new Date().toISOString(),
        horarios,
        configuracao: {
          nomeEscola: config.nomeEscola,
          grupos: grupos.map((g) => ({
            id: g.id,
            nome: g.nome,
            descricao: g.descricao,
          })),
          diasSemana: diasSemana,
        },
      };
      downloadJSON(dados, `horarios-escolar-${new Date().toISOString().split("T")[0]}.json`);
      setMensagem("Horários exportados com sucesso!");
      setTimeout(() => setMensagem(null), 3000);
    } catch (error: any) {
      alert(`Erro ao exportar: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  }

  async function exportarHorariosCSV() {
    try {
      setProcessando(true);
      const linhas: string[] = [];
      linhas.push("Grupo,Dia,Horário,Disciplina,Professor,Turma");

      grupos.forEach((grupo) => {
        const horarioGrupo = horarios[grupo.id];
        if (!horarioGrupo) return;

        const slots = getSlotsPorGrupo()[grupo.id] || [];
        diasSemana.forEach((dia) => {
          const slotsDia = horarioGrupo[dia] || {};
          slots.forEach((slot) => {
            if (slot.tipo !== "aula") return;
            const aula = slotsDia[slot.id];
            if (aula) {
              linhas.push(
                [
                  grupo.nome,
                  dia,
                  slot.label,
                  aula.disciplina || "",
                  aula.professor || "",
                  aula.turma || "",
                ]
                  .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                  .join(",")
              );
            }
          });
        });
      });

      downloadCSV(linhas.join("\n"), `horarios-escolar-${new Date().toISOString().split("T")[0]}.csv`);
      setMensagem("Horários exportados em CSV com sucesso!");
      setTimeout(() => setMensagem(null), 3000);
    } catch (error: any) {
      alert(`Erro ao exportar: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  }

  async function exportarConfiguracao() {
    try {
      setProcessando(true);
      const dados = {
        versao: "1.0",
        dataExportacao: new Date().toISOString(),
        configuracao: config,
      };
      downloadJSON(dados, `configuracao-escola-${new Date().toISOString().split("T")[0]}.json`);
      setMensagem("Configuração exportada com sucesso!");
      setTimeout(() => setMensagem(null), 3000);
    } catch (error: any) {
      alert(`Erro ao exportar: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  }

  async function exportarBackupCompleto() {
    try {
      setProcessando(true);
      const dados = {
        versao: "1.0",
        dataExportacao: new Date().toISOString(),
        tipo: "backup_completo",
        horarios,
        configuracao: config,
        metadados: {
          totalGrupos: grupos.length,
          totalDias: diasSemana.length,
          totalAulas: Object.values(horarios).reduce((acc, h) => {
            if (!h) return acc;
            let count = 0;
            Object.values(h).forEach((dia) => {
              if (dia) {
                Object.values(dia).forEach((aula) => {
                  if (aula) count++;
                });
              }
            });
            return acc + count;
          }, 0),
        },
      };
      downloadJSON(dados, `backup-completo-${new Date().toISOString().split("T")[0]}.json`);
      setMensagem("Backup completo exportado com sucesso!");
      setTimeout(() => setMensagem(null), 3000);
    } catch (error: any) {
      alert(`Erro ao exportar backup: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  }

  // ========== IMPORTAÇÕES ==========

  async function importarHorariosJSON(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      const texto = await file.text();
      const dados = JSON.parse(texto);

      if (!dados.horarios) {
        throw new Error("Arquivo inválido: não contém horários");
      }

      if (
        !confirm(
          `Tem certeza que deseja importar os horários?\n\nIsso irá substituir os horários atuais.`
        )
      ) {
        return;
      }

      // Valida e importa os horários
      const horariosImportados = dados.horarios as HorariosPorGrupo;
      let importados = 0;
      let erros = 0;

      for (const grupoId in horariosImportados) {
        const horarioGrupo = horariosImportados[grupoId];
        if (!horarioGrupo) continue;

        for (const dia in horarioGrupo) {
          const slotsDia = horarioGrupo[dia];
          if (!slotsDia) continue;

          for (const slotId in slotsDia) {
            const aula = slotsDia[slotId];
            if (!aula) continue;

            try {
              await salvarHorario(
                grupoId,
                dia,
                parseInt(slotId),
                aula.disciplina || "",
                aula.professor || "",
                aula.turma || ""
              );
              importados++;
            } catch (error) {
              console.error(`Erro ao importar ${grupoId}/${dia}/${slotId}:`, error);
              erros++;
            }
          }
        }
      }

      setMensagem(
        `Importação concluída! ${importados} aulas importadas${erros > 0 ? `, ${erros} erros` : ""}.`
      );
      setTimeout(() => setMensagem(null), 5000);
      onHorariosAtualizados();
    } catch (error: any) {
      alert(`Erro ao importar: ${error.message}`);
    } finally {
      setProcessando(false);
      // Limpa o input para permitir reimportação do mesmo arquivo
      event.target.value = "";
    }
  }

  async function importarHorariosCSV(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      const texto = await file.text();
      const linhas = texto.split("\n").filter((l) => l.trim());

      if (linhas.length < 2) {
        throw new Error("Arquivo CSV inválido ou vazio");
      }

      // Pula o cabeçalho
      const dados = linhas.slice(1).map((linha) => {
        // Remove BOM se presente
        const linhaLimpa = linha.replace(/^\ufeff/, "");
        // Parse CSV simples (considera aspas)
        const valores: string[] = [];
        let valorAtual = "";
        let dentroAspas = false;

        for (let i = 0; i < linhaLimpa.length; i++) {
          const char = linhaLimpa[i];
          if (char === '"') {
            if (dentroAspas && linhaLimpa[i + 1] === '"') {
              valorAtual += '"';
              i++;
            } else {
              dentroAspas = !dentroAspas;
            }
          } else if (char === "," && !dentroAspas) {
            valores.push(valorAtual);
            valorAtual = "";
          } else {
            valorAtual += char;
          }
        }
        valores.push(valorAtual);

        return {
          grupo: valores[0]?.replace(/^"|"$/g, "") || "",
          dia: valores[1]?.replace(/^"|"$/g, "") || "",
          horario: valores[2]?.replace(/^"|"$/g, "") || "",
          disciplina: valores[3]?.replace(/^"|"$/g, "") || "",
          professor: valores[4]?.replace(/^"|"$/g, "") || "",
          turma: valores[5]?.replace(/^"|"$/g, "") || "",
        };
      });

      if (
        !confirm(
          `Tem certeza que deseja importar ${dados.length} registros do CSV?\n\nIsso irá adicionar/substituir os horários correspondentes.`
        )
      ) {
        return;
      }

      let importados = 0;
      let erros = 0;

      for (const registro of dados) {
        // Encontra o grupo pelo nome
        const grupo = grupos.find((g) => g.nome === registro.grupo);
        if (!grupo) {
          erros++;
          continue;
        }

        // Encontra o slot pelo label
        const slots = getSlotsPorGrupo()[grupo.id] || [];
        const slot = slots.find((s) => s.label === registro.horario);
        if (!slot || slot.tipo !== "aula") {
          erros++;
          continue;
        }

        // Verifica se o dia existe
        if (!diasSemana.includes(registro.dia)) {
          erros++;
          continue;
        }

        try {
          await salvarHorario(
            grupo.id,
            registro.dia,
            slot.id,
            registro.disciplina,
            registro.professor,
            registro.turma
          );
          importados++;
        } catch (error) {
          console.error(`Erro ao importar ${registro.grupo}/${registro.dia}:`, error);
          erros++;
        }
      }

      setMensagem(
        `Importação CSV concluída! ${importados} registros importados${erros > 0 ? `, ${erros} erros` : ""}.`
      );
      setTimeout(() => setMensagem(null), 5000);
      onHorariosAtualizados();
    } catch (error: any) {
      alert(`Erro ao importar CSV: ${error.message}`);
    } finally {
      setProcessando(false);
      event.target.value = "";
    }
  }

  async function importarConfiguracao(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      const texto = await file.text();
      const dados = JSON.parse(texto);

      if (!dados.configuracao) {
        throw new Error("Arquivo inválido: não contém configuração");
      }

      if (
        !confirm(
          `Tem certeza que deseja importar a configuração?\n\nIsso irá substituir a configuração atual da escola. A página será recarregada após a importação.`
        )
      ) {
        return;
      }

      salvarConfiguracao(dados.configuracao);
      setMensagem("Configuração importada com sucesso! Recarregando...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      alert(`Erro ao importar configuração: ${error.message}`);
      setProcessando(false);
      event.target.value = "";
    }
  }

  async function importarBackupCompleto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      const texto = await file.text();
      const dados = JSON.parse(texto);

      if (!dados.horarios || !dados.configuracao) {
        throw new Error("Arquivo inválido: não é um backup completo");
      }

      if (
        !confirm(
          `ATENÇÃO: Isso irá substituir TODOS os horários e a configuração atual!\n\nTem certeza que deseja continuar?`
        )
      ) {
        return;
      }

      // Primeiro importa a configuração
      salvarConfiguracao(dados.configuracao);
      
      // Aguarda um pouco para garantir que a configuração foi salva
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Depois importa os horários
      const horariosImportados = dados.horarios as HorariosPorGrupo;
      let importados = 0;
      let erros = 0;

      for (const grupoId in horariosImportados) {
        const horarioGrupo = horariosImportados[grupoId];
        if (!horarioGrupo) continue;

        for (const dia in horarioGrupo) {
          const slotsDia = horarioGrupo[dia];
          if (!slotsDia) continue;

          for (const slotId in slotsDia) {
            const aula = slotsDia[slotId];
            if (!aula) continue;

            try {
              await salvarHorario(
                grupoId,
                dia,
                parseInt(slotId),
                aula.disciplina || "",
                aula.professor || "",
                aula.turma || ""
              );
              importados++;
            } catch (error) {
              console.error(`Erro ao importar ${grupoId}/${dia}/${slotId}:`, error);
              erros++;
            }
          }
        }
      }

      setMensagem(
        `Backup restaurado! ${importados} aulas importadas${erros > 0 ? `, ${erros} erros` : ""}. Recarregando...`
      );
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      alert(`Erro ao restaurar backup: ${error.message}`);
      setProcessando(false);
      event.target.value = "";
    }
  }

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Exportação e Importação de Dados
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Exporte ou importe horários, configurações e backups completos do sistema.
        </p>
      </div>

      {mensagem && (
        <div
          style={{
            padding: "0.75rem",
            background: "#d1fae5",
            border: "1px solid #10b981",
            borderRadius: "8px",
            marginBottom: "1rem",
            color: "#065f46",
          }}
        >
          {mensagem}
        </div>
      )}

      {processando && (
        <div
          style={{
            padding: "0.75rem",
            background: "#dbeafe",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            marginBottom: "1rem",
            color: "#1e40af",
          }}
        >
          Processando... Por favor, aguarde.
        </div>
      )}

      {/* EXPORTAÇÕES */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#1f2937" }}>
          📤 Exportar Dados
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Horários (JSON)
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Exporta todos os horários em formato JSON, incluindo metadados.
            </p>
            <button
              className="button-primary"
              onClick={exportarHorariosJSON}
              disabled={processando}
            >
              📥 Exportar JSON
            </button>
          </div>

          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Horários (CSV/Excel)
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Exporta horários em formato CSV compatível com Excel.
            </p>
            <button
              className="button-primary"
              onClick={exportarHorariosCSV}
              disabled={processando}
            >
              📊 Exportar CSV
            </button>
          </div>

          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Configuração
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Exporta a configuração da escola (grupos, horários, dias).
            </p>
            <button
              className="button-primary"
              onClick={exportarConfiguracao}
              disabled={processando}
            >
              ⚙️ Exportar Config
            </button>
          </div>

          <div style={{ padding: "1rem", background: "#fef3c7", borderRadius: "8px", border: "2px solid #fbbf24" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Backup Completo
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Exporta tudo: horários + configuração em um único arquivo.
            </p>
            <button
              className="button-primary"
              onClick={exportarBackupCompleto}
              disabled={processando}
            >
              💾 Backup Completo
            </button>
          </div>
        </div>
      </div>

      {/* IMPORTAÇÕES */}
      <div>
        <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#1f2937" }}>
          📥 Importar Dados
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Horários (JSON)
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Importa horários de um arquivo JSON exportado anteriormente.
            </p>
            <label className="button-primary" style={{ cursor: "pointer", display: "inline-block" }}>
              📤 Importar JSON
              <input
                type="file"
                accept=".json"
                onChange={importarHorariosJSON}
                disabled={processando}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              Horários (CSV/Excel)
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Importa horários de um arquivo CSV (formato: Grupo,Dia,Horário,Disciplina,Professor,Turma).
            </p>
            <label className="button-primary" style={{ cursor: "pointer", display: "inline-block" }}>
              📊 Importar CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={importarHorariosCSV}
                disabled={processando}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ padding: "1rem", background: "#fee2e2", borderRadius: "8px", border: "2px solid #ef4444" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              ⚠️ Configuração
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Importa configuração da escola. A página será recarregada.
            </p>
            <label className="button-danger" style={{ cursor: "pointer", display: "inline-block" }}>
              ⚙️ Importar Config
              <input
                type="file"
                accept=".json"
                onChange={importarConfiguracao}
                disabled={processando}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ padding: "1rem", background: "#fee2e2", borderRadius: "8px", border: "2px solid #ef4444" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
              ⚠️ Restaurar Backup
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
              Restaura backup completo. Substitui TUDO e recarrega a página.
            </p>
            <label className="button-danger" style={{ cursor: "pointer", display: "inline-block" }}>
              💾 Restaurar Backup
              <input
                type="file"
                accept=".json"
                onChange={importarBackupCompleto}
                disabled={processando}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Informações */}
      <div style={{ marginTop: "2rem", padding: "1rem", background: "#eff6ff", borderRadius: "8px" }}>
        <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 600 }}>
          ℹ️ Informações Importantes
        </h4>
        <ul style={{ fontSize: "0.75rem", color: "#1e40af", margin: 0, paddingLeft: "1.5rem" }}>
          <li>Exportações são feitas no formato escolhido e baixadas automaticamente.</li>
          <li>Importações de horários adicionam/substituem os dados existentes.</li>
          <li>Importações de configuração ou backup completo recarregam a página.</li>
          <li>Recomenda-se fazer backup antes de importar dados.</li>
          <li>Arquivos CSV devem seguir o formato: Grupo,Dia,Horário,Disciplina,Professor,Turma</li>
        </ul>
      </div>
    </section>
  );
}

