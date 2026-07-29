import { useState } from "react";
import type { Perfil } from "./App";
import { PIN_DIRECAO, PIN_VICE_DIRECAO } from "./App";
import logo from "./assets/logo.svg";
import { cadastrarUsuario as apiCadastrarUsuario, fazerLogin as apiFazerLogin } from "./api";
import "./AuthScreen.css";

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
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo e título */}
        <div className="auth-header">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h1 className="auth-title">Sistema de Horário Escolar</h1>
          <p className="auth-subtitle">Organização de horários por grupo de turmas</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            onClick={() => setModo("login")}
            className={"auth-tab " + (modo === "login" ? "auth-tab-active" : "")}
          >
            Login
          </button>
          <button
            onClick={() => setModo("cadastro")}
            className={"auth-tab " + (modo === "cadastro" ? "auth-tab-active" : "")}
          >
            Cadastro
          </button>
          <button
            onClick={() => setModo("rapido")}
            className={"auth-tab " + (modo === "rapido" ? "auth-tab-active" : "")}
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
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                placeholder="seu@email.com"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Senha</label>
              <input
                type="password"
                value={senhaLogin}
                onChange={(e) => setSenhaLogin(e.target.value)}
                placeholder="••••••••"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">
                PIN (opcional - apenas para Direção/Vice-direção)
              </label>
              <input
                type="password"
                value={pinLogin}
                onChange={(e) => setPinLogin(e.target.value)}
                placeholder="PIN administrativo"
                className="auth-input"
              />
            </div>

            {erroLogin && <div className="auth-error">{erroLogin}</div>}

            <button type="submit" className="auth-submit">
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
            <div className="auth-field">
              <label className="auth-label">Nome completo</label>
              <input
                type="text"
                value={nomeCadastro}
                onChange={(e) => setNomeCadastro(e.target.value)}
                placeholder="Seu nome"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={emailCadastro}
                onChange={(e) => setEmailCadastro(e.target.value)}
                placeholder="seu@email.com"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Perfil</label>
              <select
                value={perfilCadastro}
                onChange={(e) => setPerfilCadastro(e.target.value as Perfil)}
                className="auth-input"
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
              <div className="auth-field">
                <label className="auth-label">PIN (opcional)</label>
                <input
                  type="password"
                  value={pinCadastro}
                  onChange={(e) => setPinCadastro(e.target.value)}
                  placeholder="PIN para perfil administrativo"
                  className="auth-input"
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Senha</label>
              <input
                type="password"
                value={senhaCadastro}
                onChange={(e) => setSenhaCadastro(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Confirmar senha</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Digite a senha novamente"
                className="auth-input"
                required
              />
            </div>

            {erroCadastro && <div className="auth-error">{erroCadastro}</div>}

            <button type="submit" className="auth-submit">
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
            <div className="auth-field">
              <label className="auth-label">Nome</label>
              <input
                type="text"
                value={nomeRapido}
                onChange={(e) => setNomeRapido(e.target.value)}
                placeholder="Seu nome"
                className="auth-input"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Perfil</label>
              <select
                value={perfilRapido}
                onChange={(e) => setPerfilRapido(e.target.value as Perfil)}
                className="auth-input"
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
              <div className="auth-field">
                <label className="auth-label">PIN (opcional)</label>
                <input
                  type="password"
                  value={pinRapido}
                  onChange={(e) => setPinRapido(e.target.value)}
                  placeholder="PIN para perfil administrativo"
                  className="auth-input"
                />
              </div>
            )}

            <button type="submit" className="auth-submit">
              Entrar rapidamente
            </button>

            <p className="auth-hint">
              Login rápido não requer cadastro, mas seus dados não serão salvos.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
