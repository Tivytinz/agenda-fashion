# Visão geral administrativa do Agenda Fashion

## Objetivo

A rota `/admin` é a visão executiva de métricas do Agenda Fashion. Ela existe para responder como o AF está performando como produto e negócio no período selecionado, sem misturar filas operacionais, registros individuais ou saúde técnica da infraestrutura.

## Responsabilidades da Visão Geral

A tela deve exibir somente indicadores agregados do AF, organizados por contexto:

- resumo executivo do período;
- ativação da coorte profissional;
- monetização;
- retenção dos negócios;
- demanda de clientes finais;
- sinais agregados do marketplace.

O resumo executivo deve priorizar poucos KPIs que representem o funil completo do AF. A hierarquia atual é:

1. cadastros profissionais;
2. ativações, definidas pelo primeiro agendamento válido;
3. agendamentos registrados no período;
4. assinaturas pagas.

A taxa de ativação da coorte é `primeiros agendamentos válidos / cadastros profissionais`. Quando não houver cadastros no recorte, a taxa deve ser exibida como indisponível (`—`), e não como `0%`.

Os números de ativação preservam a semântica atual do funil profissional: são marcos atingidos pela coorte e não devem ser apresentados automaticamente como conversões adjacentes quando a compatibilidade legada permitir contagens não monotônicas. O primeiro agendamento válido ignora reservas canceladas. Por isso, a interface não deve numerar os marcos como uma sequência obrigatória.

Checkout representa intenção de compra; somente assinatura com pagamento válido representa monetização. A taxa de assinatura da coorte é `assinaturas pagas / cadastros profissionais`.

Retenção administrativa baseada em primeiro e segundo agendamento acompanha repetição de uso do negócio e não equivale, por si só, a cliente recorrente ou atendimento realizado.

## Semântica da demanda

Os indicadores de demanda são sessões distintas por evento no período:

- **Sessões na página inicial**: sessões com `tela_visualizada` na página `inicio`;
- **Sessões que viram perfis**: sessões com `perfil_visualizado`;
- **Sessões que iniciaram agendamento**: sessões com `agendamento_iniciado`;
- **Sessões com reserva criada**: sessões com `agendamento_concluido`;
- **Clientes distintos que agendaram**: identidades distintas observadas nos agendamentos do período.

Essas quatro contagens de sessão são sinais independentes. A Visão Geral não deve tratá-las como uma conversão sequencial sem uma coorte que garanta a passagem ordenada entre eventos.

## Hierarquia e densidade visual

A Visão Geral deve ser rápida de ler. Explicações técnicas e ressalvas de cálculo devem ficar em controles de detalhe, como `Como interpretar`, em vez de ocupar permanentemente o espaço principal da tela.

A página deve priorizar:

- valores absolutos essenciais;
- taxas semanticamente confiáveis;
- rótulos que indiquem exatamente a entidade medida;
- leitura mobile sem exigir interpretação analítica avançada.

Comparações com período anterior só devem ser adicionadas quando existir contrato explícito de janela comparável no backend. A interface não deve derivar tendências aproximadas usando períodos incompatíveis.

## O que não pertence à Visão Geral

Não devem aparecer na `/admin`:

- readiness da aplicação ou do banco;
- fila de ativações pendentes;
- nomes de profissionais prioritários;
- pendências individuais como sem serviço, sem agenda ou sem publicação;
- busca de negócios ou agendamentos;
- ações operacionais sobre registros individuais.

Esses dados continuam disponíveis nos módulos especializados.

## Arquitetura da navegação administrativa

A navegação principal do Admin possui cinco módulos:

1. **Visão geral** — métricas agregadas do AF;
2. **Ativação** — profissionais, bloqueios e avanço até o primeiro agendamento válido;
3. **Operação** — negócios, agendamentos e marketplace em nível operacional;
4. **Marketing** — aquisição, atribuição, mídia paga, custos e eficiência;
5. **WhatsApp** — comunicação, automações e operação da integração.

`Minha conta` não é um módulo do AF e, por isso, não ocupa o mesmo nível da navegação administrativa. Ela permanece acessível pelo menu de conta/avatar do cabeçalho.

## Período e consistência

O seletor de período da Visão Geral deve controlar apenas métricas compatíveis com recorte temporal. Quando um indicador obrigatório do novo período falhar, a tela não pode rotular dados antigos como se pertencessem ao novo período.

Indicadores opcionais também não podem reutilizar dados de outro período silenciosamente. Se não houver valor confiável para o recorte carregado, a interface deve mostrar indisponibilidade (`—`) ou mensagem de amostra insuficiente, conforme a métrica.
