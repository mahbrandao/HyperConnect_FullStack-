# HyperConnect — Guia da apresentação

Sistema de gestão para uma empresa de **energia solar e automação**: projetos, agenda,
documentos, pagamentos, equipe e notificações, tudo num lugar só, com uma visão
diferente para cada área da empresa.

**Tecnologias:** Next.js 15 + React 19 + TypeScript + Tailwind CSS no front-end,
Supabase (banco PostgreSQL, login, armazenamento de arquivos e regras de segurança)
no back-end, publicado na Vercel.

---

## 1. Contas de demonstração

Todas usam a mesma senha. Ela não está escrita aqui de propósito: o arquivo fica no
GitHub, e senha não deve ficar exposta.

| Perfil | Nome | E-mail |
|---|---|---|
| Gerente | Ricardo Almeida | gerente@hyperconnect.demo |
| Administração | Fernanda Costa | admin@hyperconnect.demo |
| Vendas | Lucas Pereira | vendas@hyperconnect.demo |
| Vendas | Juliana Rocha | vendas2@hyperconnect.demo |
| Instalação | Carlos Mendes | instalacao@hyperconnect.demo |
| Instalação | Bruno Santos | instalacao2@hyperconnect.demo |
| Instalação | Diego Lima | instalacao3@hyperconnect.demo |

> Os e-mails usam o domínio fictício `.demo` para não pertencerem a ninguém de verdade.
> Todos os clientes, valores e documentos são fictícios.

---

## 2. O que já está cadastrado

### Projetos (10)

| Projeto | Cliente | Serviço | Etapa | Valor | Situação do pagamento |
|---|---|---|---|---|---|
| Usina Solar – Fazenda Boa Vista | Laura Martins | Instalação fotovoltaica | Aprovado | R$ 205.000 | Entrada de 30% paga |
| Galpão Logística Sul | TransSul Logística | Instalação fotovoltaica | Em Instalação | R$ 135.000 | 2 parcelas pagas |
| Mercado Bom Preço | Antônio Ribeiro | Instalação fotovoltaica | Concluído | R$ 73.000 | Quitado |
| Residência Oliveira | Carla Oliveira | Instalação fotovoltaica | Em Instalação | R$ 33.000 | Entrada paga |
| Residência Martins | Beatriz Martins | Instalação fotovoltaica | Orçamento | R$ 28.000 | Nada pago |
| Condomínio Jardim das Flores | Roberto Faria | Carregador de carro elétrico | Orçamento | R$ 22.000 | Nada pago |
| Escritório Contábil Nunes | Rafael Nunes | Automação de painel | Aprovado | R$ 17.000 | Entrada paga |
| Padaria Pão Dourado | Helena Castro | Configuração de inversor | Em Instalação | R$ 4.500 | Paga após instalação |
| Clínica Vida Plena | Dra. Patrícia Gomes | Manutenção | Manutenção | R$ 2.800 | 50% pago |
| Residência Souza | Marcos Souza | Limpeza | Concluído | R$ 650 | Quitado |

Cada projeto tem vendedor responsável, equipe de instalação, datas, forma de
pagamento, progresso, prioridade e observações técnicas.

### Agenda (17 compromissos)
Concentrados entre **23/11 e 04/12/2026**: instalações, visitas técnicas, manutenções,
reuniões e um treinamento NR-10. Destaques para mostrar:
- **26/11 às 09:00:** "Apresentação do HyperConnect para a diretoria".
- **26/11 às 07:30** e **27/11 às 18:30:** compromissos fora do horário comercial, que aparecem normalmente na visão Semana.
- Um compromisso **cancelado** (23/11) e um **concluído** (03/11).

### Documentos (24 PDFs)
Contratos, RG, contas de água, orçamentos e memoriais descritivos. Alguns projetos
estão **de propósito com documentos faltando**, para mostrar o controle de pendências.

### Também cadastrado
- **Funcionários:** cadastro de RH de todas as contas.
- **Notificações:** o sininho já tem avisos de projetos, compromissos e documentos.

---

## 3. Funcionalidades

### Login e contas
- Login por e-mail e senha, com opção de **recuperar a senha** por e-mail.
- **Cadastro com aprovação:** quem se cadastra sozinho fica "aguardando aprovação" até um gerente ou admin definir a área da pessoa (tela **Aprovações**).
- O gerente também pode criar a conta direto pela tela **Funcionários** (marcando "Dar acesso ao sistema"). A conta já nasce aprovada, com senha provisória.
- No **Perfil**, cada pessoa altera nome, telefone e e-mail.

### Visão Geral (dashboard): uma por área
- **Gerente:** receita total da carteira, quanto já foi recebido e quanto falta, pipeline por etapa, todos os projetos e o resumo das equipes.
- **Administração:** projetos ativos, clientes e **status dos documentos** de cada projeto (o que está em ordem e o que falta).
- **Vendas:** só os projetos do próprio vendedor, com valor total vendido e pipeline.
- **Instalação:** só os projetos em que a pessoa está na equipe, separados em "em instalação", "manutenção", "aguardando início" e "concluídos".

### Projetos
- Lista com filtro por etapa e busca por projeto ou cliente.
- Etapas: **Orçamento → Aprovado → Em Instalação → Manutenção → Concluído**.
- Página de detalhes com valores, período, equipe, progresso, observações e **fotos**.
- **Progresso:** muda sozinho conforme a etapa e pode ser ajustado manualmente. A mesma informação aparece em todas as telas.
- **Equipe de instalação:** vários instaladores por projeto.

### Agenda
- Visões **Mês, Semana e Lista**.
- Criar, **editar**, cancelar, reativar e excluir compromissos.
- Clicar num dia ou horário vazio já abre um compromisso novo com a data preenchida.
- Cada compromisso pode ter projeto, local e equipe de instalação.
- Gerente e admin veem tudo. As outras pessoas veem os compromissos que criaram ou em que estão na equipe.

### Documentos
- Visão **por projeto**, com checklist dos obrigatórios (**Contrato, RG e Conta de água**), e visão com **todos os documentos**.
- **Pré-visualização** dentro do sistema, sem precisar baixar: PDF, imagens e arquivos do Office.
- Enviar, baixar, editar (inclusive trocar o arquivo) e excluir documentos.

### Pagamentos
- Total contratado, recebido e a receber.
- Cada projeto aparece como **pago, parcial ou pendente**, com o histórico de pagamentos.
- Registrar pagamento parcial ou **quitar o saldo** com um clique.
- Acesso: administração e vendas (o vendedor registra pagamentos só dos próprios projetos).

### Notificações
O banco gera avisos automaticamente e manda para as pessoas certas, por exemplo:
projeto criado ou com etapa alterada, projeto atrasado ou com prazo próximo,
compromisso novo, alterado, cancelado ou chegando, documento enviado ou pendente,
e pagamento pendente ou recebido.

---

## 4. Quem pode o quê

| | Gerente | Admin | Vendas | Instalação |
|---|:-:|:-:|:-:|:-:|
| Ver todos os projetos | ✅ | ✅ | ✅ | ✅ |
| Editar dados do projeto | ✅ | ✅ | ✅ | — (só a equipe) |
| Agenda | Tudo | Tudo | Os seus | Os seus |
| Documentos | ✅ | ✅ | — | — |
| Pagamentos | — | ✅ | Só os seus | — |
| Funcionários e aprovações | ✅ | — | — | — |

As regras ficam no **banco de dados** (Row Level Security do Supabase), não só na tela.
Mesmo quem tentar burlar o front-end não consegue ler nem alterar o que não tem permissão.

---

## 5. Possíveis perguntas

**Os dados são reais?**
Não. São fictícios, criados para a demonstração, mas o sistema funciona de verdade:
tudo é salvo no banco e aparece para as outras contas na hora.

**Onde ficam os dados e os arquivos?**
No Supabase: banco PostgreSQL para as informações e armazenamento privado para os
documentos e fotos. Os arquivos só abrem por links temporários, gerados para quem
está logado.

**Como funciona a segurança?**
Login pelo Supabase Auth e regras de acesso no próprio banco (RLS), por área e por
dono do registro. A chave de administrador do banco só é usada no servidor, nunca no
navegador.

**Por que cada perfil vê uma tela diferente?**
Cada área precisa de informações diferentes: o gerente acompanha o negócio, a
administração cuida de documentos e cobranças, o vendedor acompanha suas vendas e o
instalador vê só o trabalho dele.

**Como o progresso do projeto é calculado?**
Cada etapa sugere uma porcentagem (Orçamento 5%, Aprovado 25%, Em Instalação 70%,
Concluído 100%), e quem edita pode ajustar. O valor salvo é o mesmo em todas as telas.

**Como o sistema sabe o que falta pagar?**
Cada pagamento registrado é descontado do valor a receber do projeto. Quando chega a
zero, o projeto aparece como pago.

**Dá para mudar quais documentos são obrigatórios?**
Sim. A lista fica num único lugar do código (`lib/documentRules.ts`) e vale para todas
as telas.

**Funciona no celular?**
Funciona no navegador do celular. O layout foi pensado principalmente para computador.

**O que vocês fariam a seguir?**
Ideias: app de celular para a equipe de campo, envio automático de lembretes por
WhatsApp ou e-mail, relatórios de geração de energia dos clientes e assinatura
digital de contratos.

---

## 6. Roteiro sugerido para a demonstração

1. **Gerente:** Visão Geral (receita e pipeline) → abrir um projeto → editar a etapa e mostrar o progresso mudando.
2. **Agenda:** visão Semana, criar um compromisso clicando num horário, depois editar.
3. **Admin:** status dos documentos → Documentos → **visualizar um contrato** → Pagamentos → registrar um pagamento.
4. **Vendas:** mostrar que o vendedor só vê o que é dele.
5. **Instalação:** mostrar a visão do técnico, com o trabalho do dia.
6. **Sininho:** as notificações geradas pelas ações acima.

> Dica: deixe os logins salvos no navegador, ou abra cada perfil numa janela anônima
> diferente, para trocar de conta rápido.
