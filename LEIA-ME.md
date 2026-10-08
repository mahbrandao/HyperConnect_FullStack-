# HyperConnect — Full Stack (Next.js + Supabase)

## 1) Banco de dados (Supabase) — só na primeira vez
No painel do Supabase abra **SQL Editor** e rode, **um por vez e nesta ordem**,
o conteúdo dos arquivos da pasta `sql/`:

1. `sql/1_schema.sql`
2. `sql/2_notificacoes.sql`
3. `sql/3_aprovacoes.sql`
4. `sql/4_correcao_notificacoes.sql`
5. `sql/5_ajustes_v2.sql`
6. `sql/6_equipe_instalacao.sql`   ← **novo** (equipe com vários instaladores)

(Se você já rodou os anteriores, rode só o **6**. Ele é seguro de rodar mais de uma vez.)

## 2) Variáveis de ambiente
Copie `.env.local.example` para `.env.local` e preencha
(Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # SECRETA: nunca compartilhe nem suba pro GitHub
```

## 3) Rodar
```bash
npm install
npm run dev
```
Abra http://localhost:3000. Se abrir na 3001, ainda existe um servidor antigo
rodando: feche todos os terminais e finalize os processos "node".

## 4) Primeiro acesso
Crie sua conta em `/register` (ou Authentication → Users no Supabase) e, no
Table Editor → `profiles`, mude a coluna `team` do seu usuário para `gerente`.
Depois disso, crie os funcionários pela tela **Funcionários** (marcando
"Dar acesso ao sistema"): a conta já nasce aprovada, com senha provisória.

## O que é real (Supabase), sem nenhum dado inventado
Login/cadastro/recuperar senha · Aprovações (só Gerente) · Funcionários ·
Projetos (fotos, valores, forma de pagamento, entrada, responsáveis, excluir) ·
Pagamentos · Documentos · Agenda · Notificações (sino) · Dashboards dos 4 perfis.

## Novidades desta versão
- Cada projeto pode ter **vários instaladores** (equipe). Escolha na criação do
  projeto ou adicione/remova depois na tela de detalhes (gerente, admin ou o
  vendedor do projeto).
- O perfil **Instalação não vê valores nem pagamentos** (campos escondidos nos
  projetos, no editor e bloqueio da página de Pagamentos).
- Vendas e Instalação agora enxergam o **nome** dos colegas nos projetos.
