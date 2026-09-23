# Backup e recuperação do banco crítico

> **Papel documental:** runbook de continuidade do PostgreSQL crítico. Metas de RPO/RTO só são consideradas comprovadas com evidência operacional de backup/PITR e restore medido.

> Decisão operacional P0 — setembro de 2026.

Este runbook cobre o PostgreSQL crítico do Agenda Fashion e materializa o
critério CA-NFR-07. Ele não transforma a existência de um volume, snapshot de
manutenção ou deployment bem-sucedido em evidência de recuperação.

## Objetivos

As metas do produto são:

- **RPO ≤ 1 hora** para o banco crítico;
- **RTO ≤ 4 horas** para recuperação controlada.

RPO mede o maior intervalo de dados que pode ser perdido. RTO mede o tempo
entre o início do procedimento de recuperação e a disponibilidade de uma cópia
íntegra e utilizável.

## Estado verificado em 22/09/2026

A inspeção somente leitura do ambiente `production` confirmou que o serviço
`agenda-fashion` utiliza o serviço PostgreSQL `Postgres` e que esse banco possui
volume persistente.

As APIs disponíveis nesta sessão não expuseram evidência suficiente de:

- PITR habilitado e saudável;
- agenda recorrente de backups de volume;
- teste de restauração já executado com RPO/RTO medidos.

Existe evidência de snapshot associado a manutenção de segurança, mas esse
snapshot não substitui uma política recorrente de backup nem um exercício de
restauração.

A configuração definitiva de PITR e schedules deve ser confirmada no painel ou
CLI da Railway antes de qualquer declaração de conformidade.

## Decisão de engenharia

**O AF não considera CA-NFR-07 atendido por operação real enquanto não existir
evidência de backup recorrente/PITR e de uma restauração controlada medida.**

Até essa evidência existir:

1. o risco fica explícito como pendência operacional P0;
2. nenhuma mensagem interna ou externa deve afirmar que RPO/RTO estão
   cumpridos;
3. alterações em backup, PITR, retenção ou infraestrutura de produção exigem
   autorização explícita antes da execução;
4. o procedimento abaixo é a condição de saída para conformidade operacional.

Essa decisão formaliza a pendência e impede uma declaração de conformidade sem
evidência. Como a plataforma possui mecanismos de backup/PITR que ainda precisam
ser confirmados e exercitados neste ambiente, ela **não fecha sozinha o
CA-NFR-07** e **não equivale** a um restore test aprovado.

## Condição de saída

Antes de marcar recuperação como comprovada, executar em ambiente isolado de
produção ou equivalente:

1. confirmar a política de backup/PITR e registrar o último ponto recuperável;
2. escolher um instante de restauração controlado;
3. iniciar a restauração para uma instância isolada, sem apontar o aplicativo
   de produção para ela;
4. registrar horário de início e término;
5. validar migrations/schema, integridade das tabelas críticas e uma amostra de
   usuários, negócios, serviços, agendamentos, assinaturas e eventos;
6. calcular o RPO observado entre o ponto escolhido e o último dado recuperado;
7. calcular o RTO observado até a cópia restaurada estar pronta para smoke test;
8. registrar evidências e resultado.

A aprovação exige simultaneamente:

- RPO observado ≤ 1 hora;
- RTO observado ≤ 4 horas;
- nenhuma falha de integridade crítica;
- nenhuma credencial ou dado pessoal incluído em logs/evidências.

## Registro de exercício

Preencher um registro para cada restore test:

```text
Data:
Ambiente de origem:
Ambiente restaurado:
Tipo de backup/PITR:
Ponto solicitado:
Último dado recuperado:
Início da restauração:
Fim da restauração:
RPO observado:
RTO observado:
Migrations/schema:
Integridade crítica:
Smoke test:
Responsável:
Resultado: APROVADO | REPROVADO
Observações:
```

Em caso de reprovação, preservar a evidência, abrir correção de infraestrutura e
repetir o exercício. Nunca ajustar a medição para encaixar na meta.

## Segurança

- Não restaurar produção sobre produção durante exercício.
- Não copiar segredos para documentação, issues ou logs.
- O ambiente isolado deve ter acesso restrito e ser removido conforme a política
  operacional após a validação.
- Mudança de provedor, retenção, PITR ou estratégia de backup é uma decisão de
  infraestrutura e deve atualizar este documento e, quando durável, o
  `AGENTS.md`.
