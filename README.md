# Hyper Connect — Next.js

Conversão do protótipo exportado do Figma Make para **Next.js + TypeScript + Tailwind CSS**.

## Estrutura

- `app/` — rotas do Next.js (App Router)
- `components/` — componentes visuais e páginas reaproveitáveis
- `hooks/` — hooks reutilizáveis (`useUser`)
- `interfaces/` — contratos e tipos de domínio
- `data/` — dados mockados
- `providers/` — estado global da aplicação

## Rotas

- `/` — login
- `/register` — cadastro
- `/recover` — recuperação de senha
- `/app` — dashboard
- `/app/services`
- `/app/projects`
- `/app/agenda`
- `/app/documents`
- `/app/employees`

## Executar

```bash
npm install
npm run dev
```

O estado de usuário continua mockado e é compartilhado pelo `UserProvider`.
