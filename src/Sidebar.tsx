import {
  SquaresFour,
  CalendarBlank,
  GearSix,
} from "@phosphor-icons/react";
import logo from "./assets/logo.svg";
import type { AbaId } from "./App";

interface SidebarProps {
  abaAtiva: AbaId;
  horarioAtivo: boolean;
  onPainelPrincipal: () => void;
  onHorarioDeAulas: () => void;
  onConfiguracao: () => void;
  podeConfigurar: boolean;
  usuarioNome?: string;
  usuarioPerfilLabel?: string;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function Sidebar({
  abaAtiva,
  horarioAtivo,
  onPainelPrincipal,
  onHorarioDeAulas,
  onConfiguracao,
  podeConfigurar,
  usuarioNome,
  usuarioPerfilLabel,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Logo" className="sidebar-brand-logo" />
        <div className="sidebar-brand-text">
          <span>CONTROLE DE</span>
          <span>HORÁRIO ESCOLAR</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={
            "sidebar-link " + (abaAtiva === "dashboard" ? "sidebar-link-active" : "")
          }
          onClick={onPainelPrincipal}
        >
          <SquaresFour size={19} weight={abaAtiva === "dashboard" ? "fill" : "regular"} />
          Painel Principal
        </button>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Horário Escolar</div>
          <button
            type="button"
            className={"sidebar-link " + (horarioAtivo ? "sidebar-link-active" : "")}
            onClick={onHorarioDeAulas}
          >
            <CalendarBlank size={19} weight={horarioAtivo ? "fill" : "regular"} />
            Horário de Aulas
          </button>
        </div>

        {podeConfigurar && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Configurações</div>
            <button
              type="button"
              className={
                "sidebar-link " + (abaAtiva === "configuracao" ? "sidebar-link-active" : "")
              }
              onClick={onConfiguracao}
            >
              <GearSix size={19} weight={abaAtiva === "configuracao" ? "fill" : "regular"} />
              Configuração da Escola
            </button>
          </div>
        )}
      </nav>

      {usuarioNome && (
        <div className="sidebar-profile">
          <span className="sidebar-profile-avatar">{iniciais(usuarioNome)}</span>
          <div className="sidebar-profile-text">
            <span className="sidebar-profile-name">{usuarioNome}</span>
            {usuarioPerfilLabel && (
              <span className="sidebar-profile-role">{usuarioPerfilLabel}</span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
