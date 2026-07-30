# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Como rodar o projeto

Este app tem dois processos: o frontend (Vite) e o backend (Express + Postgres/Supabase). Os dois precisam estar rodando ao mesmo tempo, senão as chamadas de API falham com `ERR_CONNECTION_REFUSED`.

Antes de rodar pela primeira vez, configure a conexão com o banco:

```bash
cp .env.example .env
# edite o .env e cole a connection string do seu projeto Supabase
# (Project Settings → Database → Connection string → URI)
```

```bash
npm install

# Opção 1: sobe frontend e backend juntos
npm run dev:full

# Opção 2: em dois terminais separados
npm run server   # backend na porta 3000
npm run dev      # frontend na porta 5173 (http://localhost:5173)
```

## Primeiro acesso

Não existe mais cadastro público. No primeiro uso, o backend cria automaticamente
uma conta de Direção:

- **Email:** `direcao@escola.com`
- **Senha:** `trocar123`

Entre com essa conta e cadastre os demais usuários (coordenação, GOE, AOE,
professores) em **Configurações → Usuários**. Apenas Direção e Vice-direção
podem cadastrar/editar horários e usuários — os demais perfis têm acesso
somente de consulta. Não existe tela de troca de senha ainda, então recomenda-se
cuidado com esse acesso padrão.

### Perdeu o acesso de Direção?

A conta padrão só é criada se o banco estiver vazio (então, se você já tinha
um banco de um uso anterior do app, ela não é criada automaticamente). Para
criar ou resetar a senha de uma conta de Direção sem apagar nenhum outro
dado, rode:

```bash
npm run criar-admin -- seuemail@escola.com suasenha "Seu Nome"
```

Se o email já existir, só a senha é atualizada (e o perfil é garantido como
Direção). Se não existir, uma conta nova é criada.

## Deploy (Vercel + Supabase)

O backend (Express) roda como uma função serverless na Vercel, sob `/api`, e o
banco é um Postgres hospedado no Supabase — não há mais SQLite em produção.

### 1. Banco de dados (Supabase)

1. No seu projeto Supabase, vá em **Project Settings → Database → Connection string**.
2. Para uso em funções serverless, copie a string de **Connection pooling**
   (modo *Transaction*, porta `6543`) — evita esgotar o limite de conexões do
   Postgres quando a Vercel escala o backend em várias instâncias.
3. Guarde essa string; ela vira a variável `DATABASE_URL` no próximo passo.

O schema (tabelas, índices) e a conta padrão de Direção são criados
automaticamente na primeira requisição que a função recebe — não é preciso
rodar nenhuma migração manual.

### 2. Deploy (Vercel)

1. Importe este repositório em [vercel.com/new](https://vercel.com/new). A
   Vercel detecta automaticamente o projeto Vite (build `vite build`, saída
   em `dist/`) e a função serverless em `api/index.js`.
2. Em **Project Settings → Environment Variables**, adicione:
   - `DATABASE_URL` = a connection string do Supabase (passo anterior).
3. Faça o deploy. Depois de pronto, acesse a URL da Vercel e entre com a
   conta padrão (`direcao@escola.com` / `trocar123`) para cadastrar os
   demais usuários.

### Rodando `criar-admin` contra o Supabase de produção

Se precisar criar/resetar uma conta de Direção diretamente no banco de
produção (Supabase), rode localmente com a `DATABASE_URL` de produção:

```bash
DATABASE_URL="sua-connection-string-do-supabase" npm run criar-admin -- email@escola.com suasenha "Nome"
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
