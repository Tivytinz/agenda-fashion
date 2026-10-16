# Matriz de permissões administrativas

**Versão:** 1.0 — 16/10/2026. **Decisão de produto:** somente `admin`,
conforme orientação do responsável pelo AF nesta revisão.

Fonte canônica de autorização por ação para RN25, RF40 e RF41 da Especificação
v1.17. A [matriz de requisitos](./admin-requisitos-matriz.md) mede cobertura
funcional e permanece separada. Esta revisão não cria APIs de gestão.

## Papel único e fronteiras

| Identidade | Acesso administrativo |
| --- | --- |
| Sem sessão ou sessão inválida | Nenhuma rota privada; normalmente 401 |
| Cliente, profissional ou dona sem permissão admin ativa | Nenhuma rota privada; 403, mesmo com papel/flags forjados no request |
| Admin inativo, conta inativa ou autorização revogada | Sem acesso; recusa na sessão ou na consulta de autorização |
| `admin` ativo | Todas as 39 ações privadas abaixo, sujeitas às condições de domínio |

O papel vem de `usuarios_administradores`, separado de `usuarios_negocios`.
Dona não recebe administração global. Admin não substitui vínculo ou propriedade
nas APIs do negócio; não há bypass global das rotas de dona/profissional.

`auth` valida identidade e sessão. `authAdmin` consulta o banco em cada request,
exigindo conta e autorização ativas com `papel = admin`. O backend monta
`req.admin`; JWT, headers, query e corpo não escolhem privilégios. A sessão
não expõe mais flag `superadmin`.

A migration 115 converte vínculos `superadmin` em `admin`, sem criar admins nem
reativar vínculos/contas. Admins já ativos passam a acessar auditoria e operações
financeiras antes reservadas ao nível removido. O script `promover-admin.js`
aceita somente `admin`; não existe API de autopromoção.

## Matriz por ação

**Sim:** autorização do admin, sujeita a payload, configuração, integridade,
idempotência e disponibilidade; não garante HTTP 200. **Delegado:** callback sem
JWT, com state de uso único e revalidação do admin original; não é gestão aberta.

**41 ações HTTP: 39 privadas e 2 callbacks OAuth.** Auditoria identifica o evento
transversal registrado antes da mutação e seu resultado. `—` indica que a ação
não gera esse evento; leituras e teste de provedor não entram como mutações.
Isso não significa ausência de logs ou trilhas de domínio.

| ID | Ação | Endpoint | Admin | Auditoria |
| --- | --- | --- | --- | --- |
| AP-001 | Consultar resumo da plataforma | `GET /admin/dashboard` | Sim | — |
| AP-002 | Consultar usuários | `GET /admin/usuarios` | Sim | — |
| AP-003 | Consultar trilha de auditoria | `GET /admin/auditoria` | Sim | — |
| AP-004 | Revisar tentativa de auditoria vencida | `POST /admin/auditoria/:id/revisao` | Sim | `auditoria_revisar` |
| AP-005 | Consultar negócios | `GET /admin/negocios` | Sim | — |
| AP-006 | Consultar agendamentos | `GET /admin/agendamentos` | Sim | — |
| AP-007 | Consultar Marketing legado | `GET /admin/marketing` | Sim | — |
| AP-008 | Consultar resumo de mídia | `GET /admin/marketing/resumo` | Sim | — |
| AP-009 | Consultar campanhas atribuídas | `GET /admin/marketing/campanhas` | Sim | — |
| AP-010 | Consultar conversões | `GET /admin/marketing/conversoes` | Sim | — |
| AP-011 | Consultar Google Analytics 4 | `GET /admin/marketing/ga4` | Sim | — |
| AP-012 | Consultar funil profissional | `GET /admin/marketing/funil-profissionais` | Sim | — |
| AP-013 | Consultar recorrência profissional | `GET /admin/marketing/recorrencia-profissionais` | Sim | — |
| AP-014 | Consultar perfis incompletos | `GET /admin/saude/perfis-incompletos` | Sim | — |
| AP-015 | Consultar saúde operacional | `GET /admin/saude/operacional` | Sim | — |
| AP-016 | Consultar maturidade de no-show | `GET /admin/saude/ml-no-show` | Sim | — |
| AP-017 | Consultar templates e entregas WhatsApp | `GET /admin/whatsapp/templates` | Sim | — |
| AP-018 | Listar campanhas próprias do AF | `GET /admin/marketing/gestao-campanhas` | Sim | — |
| AP-019 | Criar campanha própria do AF | `POST /admin/marketing/gestao-campanhas` | Sim | `campanha_criar` |
| AP-020 | Atualizar campanha própria do AF | `PATCH /admin/marketing/gestao-campanhas/:id` | Sim | `campanha_atualizar` |
| AP-021 | Consultar eficiência e custos de mídia | `GET /admin/marketing/custos` | Sim | — |
| AP-022 | Listar gastos de mídia | `GET /admin/marketing/gastos` | Sim | — |
| AP-023 | Registrar gasto manual de mídia | `POST /admin/marketing/gastos` | Sim | `gasto_registrar` |
| AP-024 | Consultar contribuição e operações financeiras | `GET /admin/financeiro/contribuicao` | Sim | — |
| AP-025 | Criar fonte de contribuição | `POST /admin/financeiro/contribuicao/fontes` | Sim | `contribuicao_fonte_criar` |
| AP-026 | Registrar débito ou crédito de contribuição | `POST /admin/financeiro/contribuicao/custos` | Sim | `contribuicao_custo_registrar` |
| AP-027 | Registrar cobertura factual de contribuição | `POST /admin/financeiro/contribuicao/cobertura` | Sim | `contribuicao_cobertura_registrar` |
| AP-028 | Consultar integrações de contribuição | `GET /admin/financeiro/contribuicao/sync` | Sim | — |
| AP-029 | Criar integração de contribuição | `POST /admin/financeiro/contribuicao/sync/integracoes` | Sim | `contribuicao_integracao_criar` |
| AP-030 | Atualizar integração de contribuição | `PATCH /admin/financeiro/contribuicao/sync/integracoes/:id` | Sim | `contribuicao_integracao_atualizar` |
| AP-031 | Executar sincronização de contribuição | `POST /admin/financeiro/contribuicao/sync/integracoes/:id/executar` | Sim | `contribuicao_sincronizar` |
| AP-032 | Iniciar autorização TikTok Ads | `POST /admin/marketing/custos-integracoes/tiktok_ads/autorizacao` | Sim | `tiktok_oauth_iniciar` |
| AP-033 | Concluir autorização TikTok Ads | `GET /admin/marketing/custos-integracoes/tiktok_ads/callback` | Delegado | `tiktok_oauth_concluir` |
| AP-034 | Iniciar autorização Pinterest Ads | `POST /admin/marketing/custos-integracoes/pinterest_ads/autorizacao` | Sim | `pinterest_oauth_iniciar` |
| AP-035 | Concluir autorização Pinterest Ads | `GET /admin/marketing/custos-integracoes/pinterest_ads/callback` | Delegado | `pinterest_oauth_concluir` |
| AP-036 | Consultar integrações de mídia | `GET /admin/marketing/custos-integracoes` | Sim | — |
| AP-037 | Listar campanhas externas do provedor | `GET /admin/marketing/custos-integracoes/:provedor/campanhas` | Sim | — |
| AP-038 | Testar acesso ao provedor de mídia | `POST /admin/marketing/custos-integracoes/:provedor/testar` | Sim | — |
| AP-039 | Vincular campanha externa à campanha do AF | `POST /admin/marketing/custos-integracoes/vinculos` | Sim | `midia_vincular` |
| AP-040 | Sincronizar gastos de mídia | `POST /admin/marketing/custos-integracoes/:provedor/sincronizar` | Sim | `midia_sincronizar` |
| AP-041 | Consultar Analytics V2 por seção | `GET /admin/analytics-v2/:secao` | Sim | — |

## Controles e condições

| Família / IDs | Controle e limites |
| --- | --- |
| Todas as ações privadas | `auth` → `authAdmin`; conta e permissão ativas, com autorização consultada pelo ID autenticado. Ambos os routers aplicam `no-store`. |
| AP-003–004: auditoria | `adminAuditService` valida ator e papel admin. Revisão exige tentativa vencida e evidência estruturada; não presume resultado HTTP nem apaga evento. |
| AP-019–020, 023: campanhas/mídia | `authAdmin`, ledger e services de campanhas/custos. Criar/editar campanhas próprias e registrar gasto manual; preservar UTM e validações. |
| AP-025–027: contribuição | Controller deriva `adminAutorizado` de `req.admin.papel`; `adminContributionOperationsService` exige `true`. Fonte, débito/crédito e cobertura factual exigem validação/motivo/idempotência. Correções por crédito referenciado, sem apagar débitos. |
| AP-029–031: sync contribuição | Mesmo vínculo de autorização; `contributionCostSyncService` exige `true`. Flags do payload não autorizam criar/alterar/sincronizar integração. |
| AP-032, 034: iniciar OAuth | `authAdmin`, ledger e service OAuth. State criado no servidor e associado ao ator; sem redirect arbitrário. |
| AP-033, 035: concluir OAuth | Services TikTok/Pinterest validam e consomem state; `adminAuditOAuthService` reconsulta admin ativo antes de trocar/persistir credencial. State ausente, expirado ou reutilizado e ator revogado não autorizam conclusão. |
| AP-036–040: integrações de mídia | `authAdmin`, orquestrador e ledger nas mutações. Vínculo explícito de campanha; AP-038 só testa acesso. Credenciais não são devolvidas ao navegador. |
| AP-041: Analytics V2 | Seções válidas: `overview`, `acquisition`, `journey`, `retention`, `revenue`. Consultar indicador não concede novas escritas. |

Se o registro inicial de auditoria falha, a mutação é recusada. Se a gravação do
resultado falha após executar a ação, a tentativa fica pendente para investigação;
a resposta HTTP isolada não comprova o efeito final.

## O que faz a auditoria

Registra quem fez a ação, papel naquele momento, ação, alvo, instante e resultado
HTTP. Ajuda a investigar criação de campanhas, lançamentos financeiros,
sincronizações e revisões. O ledger não grava corpo livre, token ou segredo de
provedor; o identificador da requisição é armazenado como hash.

Consultar não altera o domínio. Revisar acrescenta avaliação e referência de
evidência; não altera os registros originais. Banco bloqueia UPDATE, DELETE e
TRUNCATE de eventos e revisões. Eventos antigos podem mostrar `superadmin`:
é histórico preservado, não um segundo papel atual. Marcos financeiros antigos
também permanecem como snapshots, sem reescrita da autorização vigente na época.

## Sem concessão nesta versão

Não há endpoint neste inventário para edição/exclusão genérica de usuário,
negócio ou reserva, impersonação, gestão de papéis, exclusão de auditoria, refund,
reativação de negócio arquivado ou alteração direta de assinatura de terceiros.
A menção de “gestão” em RF40 não concede essas ações por si só.

Novas operações exigem contrato nesta matriz, guard de backend, trilha quando
sensíveis e teste de recusa antes da exposição. Prefixo `/admin` ou opção no menu
não concedem acesso. Esta matriz fecha o papel único e todos os fluxos atuais;
futuras operações continuam exigindo definição própria, sem novos níveis.

## Verificação e manutenção

- `admin-permissions-matrix.test.js` confronta a matriz com os dois routers,
  verifica guards/ledger e exercita consulta/revisão para admin com controllers
  e services reais, usando doubles de DB e ledger.
- `authorization-route-matrix.test.js` cobre anônimos e papel forjado nas 39
  rotas privadas; `auth-admin.test.js` valida admin único e recusa papel legado.
- Testes de contribuição/sync verificam permissões derivadas do backend e
  casos permitidos/recusados. OAuth cobre state, uso único e revogação.
- `admin-role-migration.integration.test.js` verifica conversão, inatividade,
  preservação de histórico e recusa de novos vínculos superadmin.

A matriz não certifica toda combinação de payload/recurso/concorrência. RF41
continua dependendo de evidência operacional representativa; documentar o ledger
não fecha o requisito sozinho. O CI deve corresponder ao commit exato do PR.
