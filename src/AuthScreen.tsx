import { useState } from "react";
import type { Perfil } from "./App";
import logo from "./assets/logo.svg";
import { fazerLogin as apiFazerLogin } from "./api";
import "./AuthScreen.css";

interface AuthScreenProps {
  onLogin: (nome: string, perfil: Perfil) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [pinLogin, setPinLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleLogin() {
    setErroLogin("");

    if (!emailLogin.trim() || !senhaLogin.trim()) {
      setErroLogin("Preencha email e senha.");
      return;
    }

    try {
      setCarregando(true);
      const resultado = await apiFazerLogin(
        emailLogin.trim(),
        senhaLogin,
        pinLogin.trim() || undefined
      );
      onLogin(resultado.usuario.nome, resultado.usuario.perfil as Perfil);
    } catch (error: any) {
      setErroLogin(error.message || "Erro ao fazer login.");
    } finally {
      setCarregando(false);
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

          <button type="submit" className="auth-submit" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="auth-hint">
          Ainda não tem uma conta? Peça para a Direção ou Vice-direção da sua
          escola cadastrar o seu acesso em Configurações → Usuários.
        </p>
      </div>
    </div>
  );
}
