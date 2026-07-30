import { useEffect, useState } from "react";
import type { Perfil } from "./App";
import { PERFIS_LABEL } from "./App";
import type { Usuario } from "./api";
import { cadastrarUsuario, listarUsuarios, removerUsuario } from "./api";

const PERFIS: Perfil[] = [
  "direcao",
  "vice_direcao",
  "coordenacao",
  "goe",
  "aoe",
  "professor",
];

interface UsuariosProps {
  usuarioAtualId?: number;
}

export function Usuarios({ usuarioAtualId }: UsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("professor");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function carregar() {
    setCarregando(true);
    listarUsuarios()
      .then((lista) => {
        setUsuarios(lista);
        setErro("");
      })
      .catch((error: any) => setErro(error.message || "Erro ao carregar usuários."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErro("Preencha nome, email e senha.");
      return;
    }
    if (senha.length < 4) {
      setErro("A senha deve ter pelo menos 4 caracteres.");
      return;
    }

    try {
      setSalvando(true);
      await cadastrarUsuario(email.trim().toLowerCase(), nome.trim(), senha, perfil);
      setMensagem(`Usuário "${nome.trim()}" cadastrado com sucesso!`);
      setNome("");
      setEmail("");
      setSenha("");
      setPerfil("professor");
      carregar();
      setTimeout(() => setMensagem(""), 4000);
    } catch (error: any) {
      setErro(error.message || "Erro ao cadastrar usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(usuario: Usuario) {
    if (!confirm(`Remover o acesso de "${usuario.nome}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await removerUsuario(usuario.id);
      carregar();
    } catch (error: any) {
      alert(error.message || "Erro ao remover usuário.");
    }
  }

  return (
    <section className="cadastro-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Usuários</h2>
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Cadastre os acessos da coordenação, GOE, AOE e professores. Apenas
          Direção e Vice-direção podem cadastrar/editar horários e usuários —
          os demais perfis têm acesso somente de consulta.
        </p>
      </div>

      <form
        onSubmit={handleCadastrar}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
          background: "#f9fafb",
        }}
      >
        <div className="cadastro-grid" style={{ marginBottom: "0.75rem" }}>
          <div className="cadastro-field">
            <label className="cadastro-label">Nome completo</label>
            <input
              className="cadastro-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do(a) usuário(a)"
            />
          </div>
          <div className="cadastro-field">
            <label className="cadastro-label">Email</label>
            <input
              className="cadastro-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div className="cadastro-field">
            <label className="cadastro-label">Senha provisória</label>
            <input
              className="cadastro-input"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <div className="cadastro-field">
            <label className="cadastro-label">Perfil</label>
            <select
              className="cadastro-select"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as Perfil)}
            >
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {PERFIS_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro && (
          <p style={{ fontSize: "0.8rem", color: "#b91c1c", marginBottom: "0.75rem" }}>
            {erro}
          </p>
        )}
        {mensagem && (
          <p style={{ fontSize: "0.8rem", color: "#059669", marginBottom: "0.75rem" }}>
            {mensagem}
          </p>
        )}

        <button className="button-primary" type="submit" disabled={salvando}>
          {salvando ? "Cadastrando..." : "+ Cadastrar usuário"}
        </button>
      </form>

      <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
        Usuários cadastrados
      </h3>

      {carregando ? (
        <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Carregando...</p>
      ) : (
        <div className="horario-wrapper">
          <table className="horario-table log-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{PERFIS_LABEL[u.perfil as Perfil] || u.perfil}</td>
                  <td>
                    {u.id !== usuarioAtualId && (
                      <button
                        className="button-danger"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
                        onClick={() => handleRemover(u)}
                      >
                        Remover
                      </button>
                    )}
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
