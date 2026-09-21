# Machine Learning: risco de falta

## Objetivo

O primeiro caso de Machine Learning do Agenda Fashion prepara uma previsão de
risco de falta (`no-show`) antes do atendimento. A intenção futura é testar
intervenções úteis, como a melhor janela de lembrete, sem punir clientes nem
reduzir artificialmente a disponibilidade.

O resultado de produto será medido pela taxa de faltas entre agendamentos com
desfecho explícito. Cadastro, clique, criação de booking e previsão gerada não
são tratados como sucesso do modelo.

## Fase atual: fundação de dados

A migration `082_ml_no_show_data_foundation.sql` cria uma amostra auditável por
agendamento. Um worker opcional:

1. encontra agendamentos ainda não amostrados;
2. calcula somente atributos que já estavam disponíveis quando o booking foi
   criado;
3. usa apenas histórico cujo desfecho já havia ocorrido naquele momento;
4. rotula `falta` como positivo e `realizado` como negativo;
5. mantém agendamentos ativos e cancelados sem rótulo.

Quando houve reagendamento, o backfill reconstrói a data e o horário originais
com o primeiro registro do histórico, evitando usar como feature uma mudança
que só aconteceu depois da criação do booking.

O worker é ativado explicitamente com `ML_NO_SHOW_DATA_ENABLED=true`. Valores
opcionais:

- `ML_NO_SHOW_DATA_INTERVAL_MS`: intervalo entre 60.000 e 86.400.000 ms;
- `ML_NO_SHOW_DATA_BATCH_SIZE`: lote entre 1 e 500 registros.

A coleta é assíncrona e não participa da transação de criação ou mudança de
status do agendamento. Portanto, uma falha de ML não bloqueia o fluxo principal;
o ciclo seguinte repara amostras ausentes de forma idempotente.

## Atributos v1

- antecedência, em horas, entre criação e horário marcado;
- dia da semana e minuto do dia;
- duração congelada do serviço;
- existência de conta autenticada, sem copiar identidade;
- quantidade de atendimentos concluídos anteriores do mesmo Client;
- quantidade de faltas anteriores do mesmo Client;
- quantidade de atendimentos concluídos anteriores do negócio;
- quantidade de faltas anteriores do negócio.

Nome, telefone, WhatsApp, e-mail, observações, texto livre, campanha e origem de
marketing não fazem parte dessa base. Visitantes não são unidos por telefone;
como a política atual cria uma entidade Client conservadora por booking, eles
não recebem histórico pessoal inferido.

## Barreiras antes do treinamento

A base só é classificada como pronta quando possuir, no mínimo:

- 200 agendamentos rotulados;
- 20 faltas;
- 20 atendimentos realizados;
- cobertura mínima de 80% entre desfechos explícitos e compromissos já vencidos
  que ainda permanecem ativos.

Esses valores são uma barreira operacional inicial, não prova de qualidade. O
treinamento futuro ainda precisa separar dados por tempo, comparar contra um
baseline simples, medir precisão/recall, calibração e desempenho por negócio,
e rejeitar o modelo se houver instabilidade ou amostra insuficiente.

Antes do baseline, o backend expõe somente para administradores
`GET /admin/saude/ml-no-show`. O diagnóstico é agregado e não retorna nome,
telefone, WhatsApp, e-mail, texto livre ou identificadores de cliente. Ele mostra:

- prontidão global pelos gates acima;
- quantidade de negócios com amostras e com rótulos;
- participação da base rotulada concentrada nos negócios mais representados;
- cobertura de desfecho e prevalência de falta por negócio;
- comparação entre bookings com conta autenticada e visitantes;
- evolução mensal baseada na data de criação do booking.

Essas dimensões servem para detectar viés de cobertura, concentração e mudança
temporal antes do treino. Elas não liberam automaticamente um modelo para
produção nem substituem validação temporal, métricas de classificação e
calibração.

## Restrições duráveis

- o primeiro modelo começa em modo shadow;
- score não cancela, recusa, cobra, bloqueia ou reordena agendamentos;
- cliente e profissional não recebem rótulos negativos na interface;
- nenhuma decisão financeira usa esse score;
- ativar uma intervenção exige experimento controlado e métrica de redução de
  faltas, sem piorar cancelamentos, reclamações ou entregabilidade;
- parâmetros, versão de features, período de treino e métricas precisam ser
  auditáveis antes de promover qualquer modelo.

## Próximas fases

1. coletar e avaliar a maturidade real da base;
2. treinar um baseline reproduzível fora do caminho de requisição;
3. registrar versão e métricas do modelo;
4. gerar previsões somente em shadow;
5. comparar previsão com desfechos reais por tempo e por negócio;
6. somente depois, testar uma intervenção não punitiva.
