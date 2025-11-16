import { useState } from "react";
import type { Perfil } from "./App";
import logo from "./assets/logo.svg";
import { cadastrarUsuario as apiCadastrarUsuario, fazerLogin as apiFazerLogin } from "./api";

const PERFIS_LABEL: Record<Perfil, string> = {
  direcao: "Direção",
  vice_direcao: "Vice-direção",
  coordenacao: "Coordenação",
  goe: "GOE",
  aoe: "AOE",
  professor: "Professor(a)",
};

interface AuthScreenProps {
  onLogin: (nome: string, perfil: Perfil) => void;
  onLoginRapido?: (nome: string, perfil: Perfil) => void;
}

export function AuthScreen({ onLogin, onLoginRapido }: AuthScreenProps) {
  const [modo, setModo] = useState<"login" | "cadastro" | "rapido">("login");
  
  // Estados para login
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [pinLogin, setPinLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");

  // Estados para cadastro
  const [nomeCadastro, setNomeCadastro] = useState("");
  const [emailCadastro, setEmailCadastro] = useState("");
  const [senhaCadastro, setSenhaCadastro] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [perfilCadastro, setPerfilCadastro] = useState<Perfil>("professor");
  const [pinCadastro, setPinCadastro] = useState("");
  const [erroCadastro, setErroCadastro] = useState("");

  // Estados para login rápido
  const [nomeRapido, setNomeRapido] = useState("");
  const [perfilRapido, setPerfilRapido] = useState<Perfil>("professor");
  const [pinRapido, setPinRapido] = useState("");

  async function handleLogin() {
    setErroLogin("");
    
    if (!emailLogin.trim() || !senhaLogin.trim()) {
      setErroLogin("Preencha email e senha.");
      return;
    }

    try {
      const resultado = await apiFazerLogin(
        emailLogin.trim(),
        senhaLogin,
        pinLogin.trim() || undefined
      );
      onLogin(resultado.usuario.nome, resultado.usuario.perfil as Perfil);
    } catch (error: any) {
      setErroLogin(error.message || "Erro ao fazer login.");
    }
  }

  async function handleCadastro() {
    setErroCadastro("");

    if (!nomeCadastro.trim()) {
      setErroCadastro("Digite seu nome.");
      return;
    }

    if (!emailCadastro.trim()) {
      setErroCadastro("Digite um email.");
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailCadastro)) {
      setErroCadastro("Email inválido.");
      return;
    }

    if (!senhaCadastro.trim() || senhaCadastro.length < 4) {
      setErroCadastro("Senha deve ter pelo menos 4 caracteres.");
      return;
    }

    if (senhaCadastro !== confirmarSenha) {
      setErroCadastro("As senhas não coincidem.");
      return;
    }

    try {
      await apiCadastrarUsuario(
        emailCadastro.trim().toLowerCase(),
        nomeCadastro.trim(),
        senhaCadastro,
        perfilCadastro,
        pinCadastro.trim() || undefined
      );

      alert("Cadastro realizado com sucesso! Faça login para continuar.");
      setModo("login");
      setEmailLogin(emailCadastro.trim().toLowerCase());
      setNomeCadastro("");
      setEmailCadastro("");
      setSenhaCadastro("");
      setConfirmarSenha("");
      setPinCadastro("");
    } catch (error: any) {
      setErroCadastro(error.message || "Erro ao cadastrar usuário.");
    }
  }

  function handleLoginRapido() {
    if (!nomeRapido.trim()) {
      alert("Digite um nome para login.");
      return;
    }

    // Validação de PIN para perfis administrativos (opcional)
    if (perfilRapido === "direcao" || perfilRapido === "vice_direcao") {
      if (pinRapido.trim()) {
        const pinCorreto =
          perfilRapido === "direcao" ? PIN_DIRECAO : PIN_VICE_DIRECAO;
        if (pinRapido.trim() !== pinCorreto) {
          alert("PIN incorreto para este perfil.");
          return;
        }
      }
    }

    if (onLoginRapido) {
      onLoginRapido(nomeRapido.trim(), perfilRapido);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          padding: "2.5rem",
          maxWidth: "450px",
          width: "100%",
        }}
      >
        {/* Logo e título */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={logo}
            alt="Logo"
            style={{ width: "80px", height: "80px", marginBottom: "1rem" }}
          />
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#1f2937" }}>
            Sistema de Horário Escolar
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            Organização de horários por grupo de turmas
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
            onClick={() => setModo("login")}
            style={{
              flex: 1,
              padding: "0.75rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderBottom: modo === "login" ? "2px solid #667eea" : "2px solid transparent",
              color: modo === "login" ? "#667eea" : "#6b7280",
              fontWeight: modo === "login" ? 600 : 400,
              transition: "all 0.2s",
            }}
          >
            Login
          </button>
          <button
            onClick={() => setModo("cadastro")}
            style={{
              flex: 1,
              padding: "0.75rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderBottom: modo === "cadastro" ? "2px solid #667eea" : "2px solid transparent",
              color: modo === "cadastro" ? "#667eea" : "#6b7280",
              fontWeight: modo === "cadastro" ? 600 : 400,
              transition: "all 0.2s",
            }}
          >
            Cadastro
          </button>
          <button
            onClick={() => setModo("rapido")}
            style={{
              flex: 1,
              padding: "0.75rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderBottom: modo === "rapido" ? "2px solid #667eea" : "2px solid transparent",
              color: modo === "rapido" ? "#667eea" : "#6b7280",
              fontWeight: modo === "rapido" ? 600 : 400,
              transition: "all 0.2s",
            }}
          >
            Rápido
          </button>
        </div>

        {/* Formulário de Login */}
        {modo === "login" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                placeholder="seu@email.com"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Senha
              </label>
              <input
                type="password"
                value={senhaLogin}
                onChange={(e) => setSenhaLogin(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                PIN (opcional - apenas para Direção/Vice-direção)
              </label>
              <input
                type="password"
                value={pinLogin}
                onChange={(e) => setPinLogin(e.target.value)}
                placeholder="PIN administrativo"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {erroLogin && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                }}
              >
                {erroLogin}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#5568d3")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#667eea")}
            >
              Entrar
            </button>
          </form>
        )}

        {/* Formulário de Cadastro */}
        {modo === "cadastro" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCadastro();
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Nome completo
              </label>
              <input
                type="text"
                value={nomeCadastro}
                onChange={(e) => setNomeCadastro(e.target.value)}
                placeholder="Seu nome"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={emailCadastro}
                onChange={(e) => setEmailCadastro(e.target.value)}
                placeholder="seu@email.com"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Perfil
              </label>
              <select
                value={perfilCadastro}
                onChange={(e) => setPerfilCadastro(e.target.value as Perfil)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              >
                <option value="professor">Professor(a)</option>
                <option value="coordenacao">Coordenação</option>
                <option value="goe">GOE</option>
                <option value="aoe">AOE</option>
                <option value="vice_direcao">Vice-direção</option>
                <option value="direcao">Direção</option>
              </select>
            </div>

            {(perfilCadastro === "direcao" || perfilCadastro === "vice_direcao") && (
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  PIN (opcional)
                </label>
                <input
                  type="password"
                  value={pinCadastro}
                  onChange={(e) => setPinCadastro(e.target.value)}
                  placeholder="PIN para perfil administrativo"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Senha
              </label>
              <input
                type="password"
                value={senhaCadastro}
                onChange={(e) => setSenhaCadastro(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Digite a senha novamente"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            {erroCadastro && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                }}
              >
                {erroCadastro}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#5568d3")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#667eea")}
            >
              Criar conta
            </button>
          </form>
        )}

        {/* Login Rápido (sem cadastro) */}
        {modo === "rapido" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLoginRapido();
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Nome
              </label>
              <input
                type="text"
                value={nomeRapido}
                onChange={(e) => setNomeRapido(e.target.value)}
                placeholder="Seu nome"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Perfil
              </label>
              <select
                value={perfilRapido}
                onChange={(e) => setPerfilRapido(e.target.value as Perfil)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              >
                <option value="professor">Professor(a)</option>
                <option value="coordenacao">Coordenação</option>
                <option value="goe">GOE</option>
                <option value="aoe">AOE</option>
                <option value="vice_direcao">Vice-direção</option>
                <option value="direcao">Direção</option>
              </select>
            </div>

            {(perfilRapido === "direcao" || perfilRapido === "vice_direcao") && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  PIN (opcional)
                </label>
                <input
                  type="password"
                  value={pinRapido}
                  onChange={(e) => setPinRapido(e.target.value)}
                  placeholder="PIN para perfil administrativo"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#5568d3")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#667eea")}
            >
              Entrar rapidamente
            </button>

            <p
              style={{
                marginTop: "1rem",
                fontSize: "0.75rem",
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              Login rápido não requer cadastro, mas seus dados não serão salvos.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

