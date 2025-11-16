// Serviços de API para comunicação com o backend

const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3000";

// Função auxiliar para fazer requisições
async function fetchAPI(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = localStorage.getItem("auth_token");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  return response.json();
}

// ---------- Autenticação ----------

export interface Usuario {
  id: number;
  email: string;
  nome: string;
  perfil: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export async function cadastrarUsuario(
  email: string,
  nome: string,
  senha: string,
  perfil: string,
  pin?: string
): Promise<Usuario> {
  const response = await fetchAPI("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, nome, senha, perfil, pin }),
  });
  return response.usuario;
}

export async function fazerLogin(
  email: string,
  senha: string,
  pin?: string
): Promise<LoginResponse> {
  const response = await fetchAPI("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha, pin }),
  });
  
  // Salva o token
  localStorage.setItem("auth_token", response.token);
  localStorage.setItem("auth_usuario", JSON.stringify(response.usuario));
  
  return response;
}

export async function verificarSessao(): Promise<Usuario | null> {
  try {
    const response = await fetchAPI("/api/auth/me");
    return response.usuario;
  } catch {
    // Token inválido ou expirado
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_usuario");
    return null;
  }
}

export async function fazerLogout(): Promise<void> {
  try {
    await fetchAPI("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignora erro
  } finally {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_usuario");
  }
}

// ---------- Horários ----------

export interface HorarioCompleto {
  [dia: string]: {
    [slotId: number]: {
      disciplina: string;
      professor: string;
      turma: string;
    } | null;
  };
}

export interface HorariosPorGrupo {
  [grupoId: string]: HorarioCompleto;
}

export async function buscarHorarios(): Promise<HorariosPorGrupo> {
  return await fetchAPI("/api/horarios");
}

export async function buscarHorariosGrupo(grupoId: string): Promise<HorarioCompleto> {
  return await fetchAPI(`/api/horarios/${grupoId}`);
}

export async function salvarHorario(
  grupoId: string,
  dia: string,
  slotId: number,
  disciplina: string,
  professor: string,
  turma: string
): Promise<void> {
  await fetchAPI("/api/horarios", {
    method: "POST",
    body: JSON.stringify({ grupoId, dia, slotId, disciplina, professor, turma }),
  });
}

export async function limparHorario(
  grupoId: string,
  dia: string,
  slotId: number
): Promise<void> {
  await fetchAPI("/api/horarios", {
    method: "DELETE",
    body: JSON.stringify({ grupoId, dia, slotId }),
  });
}

export async function limparGrupo(grupoId: string): Promise<void> {
  await fetchAPI(`/api/horarios/grupo/${grupoId}`, {
    method: "DELETE",
  });
}

// ---------- Histórico ----------

export interface HistoricoAlteracao {
  id: number;
  tipoAlteracao: "criar" | "atualizar" | "deletar" | "limpar";
  tabela: string;
  registroId: number | null;
  grupoId: string | null;
  dia: string | null;
  slotId: number | null;
  campoAlterado: string | null;
  valorAnterior: any;
  valorNovo: any;
  usuario: {
    id: number;
    nome: string;
    perfil: string;
  };
  timestamp: string;
  detalhes: string | null;
}

export interface EstatisticasHistorico {
  totalAlteracoes: number;
  totalUsuarios: number;
  totalGrupos: number;
  primeiraAlteracao: string | null;
  ultimaAlteracao: string | null;
  porTipo: Array<{ tipo: string; quantidade: number }>;
  porUsuario: Array<{ nome: string; perfil: string; quantidade: number }>;
}

export interface Snapshot {
  id: number;
  nome: string;
  descricao: string | null;
  dados: HorariosPorGrupo;
  usuario: {
    id: number;
    nome: string;
    perfil: string;
  };
  criadoEm: string;
}

export async function buscarHistorico(filtros?: {
  grupoId?: string;
  dia?: string;
  usuarioId?: number;
  tipoAlteracao?: string;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
}): Promise<HistoricoAlteracao[]> {
  const params = new URLSearchParams();
  if (filtros?.grupoId) params.append("grupoId", filtros.grupoId);
  if (filtros?.dia) params.append("dia", filtros.dia);
  if (filtros?.usuarioId) params.append("usuarioId", filtros.usuarioId.toString());
  if (filtros?.tipoAlteracao) params.append("tipoAlteracao", filtros.tipoAlteracao);
  if (filtros?.dataInicio) params.append("dataInicio", filtros.dataInicio);
  if (filtros?.dataFim) params.append("dataFim", filtros.dataFim);
  if (filtros?.limite) params.append("limite", filtros.limite.toString());

  return await fetchAPI(`/api/historico?${params.toString()}`);
}

export async function buscarHistoricoHorario(
  grupoId: string,
  dia: string,
  slotId: number
): Promise<HistoricoAlteracao[]> {
  return await fetchAPI(`/api/historico/horario/${grupoId}/${dia}/${slotId}`);
}

export async function buscarEstatisticasHistorico(filtros?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<EstatisticasHistorico> {
  const params = new URLSearchParams();
  if (filtros?.dataInicio) params.append("dataInicio", filtros.dataInicio);
  if (filtros?.dataFim) params.append("dataFim", filtros.dataFim);

  return await fetchAPI(`/api/historico/estatisticas?${params.toString()}`);
}

// ---------- Snapshots ----------

export async function criarSnapshot(
  nome: string,
  descricao: string | null,
  dados: HorariosPorGrupo
): Promise<Snapshot> {
  return await fetchAPI("/api/snapshots", {
    method: "POST",
    body: JSON.stringify({ nome, descricao, dados }),
  });
}

export async function buscarSnapshots(limite?: number): Promise<Snapshot[]> {
  const params = limite ? `?limite=${limite}` : "";
  return await fetchAPI(`/api/snapshots${params}`);
}

export async function buscarSnapshot(id: number): Promise<Snapshot> {
  return await fetchAPI(`/api/snapshots/${id}`);
}

export async function deletarSnapshot(id: number): Promise<void> {
  await fetchAPI(`/api/snapshots/${id}`, {
    method: "DELETE",
  });
}

