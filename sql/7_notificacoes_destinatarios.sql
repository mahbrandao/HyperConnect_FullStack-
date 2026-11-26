-- =====================================================================
-- HYPERCONNECT — CORREÇÃO: notificações pessoais indo pra todo mundo
-- Roda depois de 1..6. Pode rodar mais de uma vez.
--
-- Problema: o tipo 'project_assigned' ("Você foi definido(a) como
-- vendedor(a)...", "Você foi adicionado(a) à equipe de instalação...")
-- também era enviado em broadcast para TODO o time gerente. Resultado:
-- o gerente via mensagens escritas pra outra pessoa.
-- =====================================================================

-- 1) 'project_assigned' passa a ir SÓ para a pessoa atribuída
delete from public.notification_routing where type_code = 'project_assigned';

-- 2) Limpa as cópias que já foram entregues por engano: remove o
--    destinatário de 'project_assigned' quando ele não é o vendedor do
--    projeto nem está na equipe de instalação desse projeto.
delete from public.notification_recipients nr
using public.notifications n
where nr.notification_id = n.id
  and n.type_code = 'project_assigned'
  and not exists (
    select 1 from public.projects p
    where p.id = n.project_id and p.vendedor_id = nr.profile_id
  )
  and not exists (
    select 1 from public.project_installers pi
    where pi.project_id = n.project_id and pi.profile_id = nr.profile_id
  );

-- 3) Notificação que ficou sem nenhum destinatário é apagada
delete from public.notifications n
where not exists (select 1 from public.notification_recipients nr where nr.notification_id = n.id);
