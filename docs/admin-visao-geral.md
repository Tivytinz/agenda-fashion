# Visão geral administrativa do Agenda Fashion

## Objetivo

A rota `/admin` é a visão executiva de métricas do Agenda Fashion. Ela existe para responder como o AF está performando como produto e negócio no período selecionado, sem misturar filas operacionais, registros individuais ou saúde técnica da infraestrutura.

## Responsabilidades da Visão Geral

A tela deve exibir somente indicadores agregados do AF, organizados por contexto:

- resumo do período;
- marcos de ativação da coorte;
- monetização;
- retenção;
- demanda de clientes finais;
- sinais agregados do marketplace.

Os números de marcos de ativação preservam a semântica atual do funil profissional: são marcos atingidos pela coorte e não devem ser apresentados automaticamente como conversões adjacentes quando a compatibilidade legada permitir contagens não monotônicas. O primeiro agendamento válido ignora reservas canceladas.

Checkout representa intenção de compra; somente assinatura com pagamento válido representa monetização.

Retenção administrativa baseada em primeiro e segundo agendamento não equivale, por si só, a cliente recorrente ou atendimento realizado.

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
