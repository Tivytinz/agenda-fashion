const {
  ESTADOS_PROXIMA_ACAO_ATIVACAO,
  resolverProximaAcaoAtivacao,
} = require(
  "../src/services/activationNextActionService"
);

describe(
  "activationNextActionService",
  () => {
    test.each([
      [
        "prioriza serviço ativo quando toda a ativação está pendente",
        {
          possui_servico: false,
          possui_servico_ativo: false,
          agenda_configurada: false,
          negocio_publicado: false,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .GARANTIR_SERVICO_ATIVO,
      ],
      [
        "pede revisão da publicação depois do primeiro serviço quando o perfil ainda não está no ar",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: false,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .REVISAR_PUBLICACAO,
      ],
      [
        "não usa agenda como gate para negócio publicado",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: true,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .CONQUISTAR_PRIMEIRO_AGENDAMENTO,
      ],
      [
        "prioriza divulgação antes do primeiro agendamento",
        {
          possui_servico_ativo: true,
          agenda_configurada: true,
          negocio_publicado: true,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .CONQUISTAR_PRIMEIRO_AGENDAMENTO,
      ],
      [
        "conclui a ativação depois do primeiro agendamento",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: true,
          primeiro_agendamento_recebido: true,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .ATIVADO,
      ],
      [
        "volta para serviço ativo quando uma operação já ativada perde todos os serviços ativos",
        {
          possui_servico: true,
          possui_servico_ativo: false,
          agenda_configurada: true,
          negocio_publicado: true,
          primeiro_agendamento_recebido: true,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .GARANTIR_SERVICO_ATIVO,
      ],
    ])(
      "%s",
      (
        _descricao,
        ativacao,
        estadoEsperado
      ) => {
        const resultado =
          resolverProximaAcaoAtivacao(
            ativacao
          );

        expect(
          resultado.estado
        ).toBe(
          estadoEsperado
        );
      }
    );

    test(
      "leva à gestão quando já existem somente serviços inativos",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico: true,
            possui_servico_ativo: false,
          });

        expect(resultado.acao).toEqual({
          tipo: "NAVEGAR",
          rotulo: "Gerenciar serviços",
          destino: "/painel/servicos",
        });
      }
    );

    test(
      "leva diretamente ao cadastro do primeiro serviço quando a ativação ainda não começou",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico: false,
            possui_servico_ativo: false,
          });

        expect(resultado).toMatchObject({
          estado:
            ESTADOS_PROXIMA_ACAO_ATIVACAO
              .GARANTIR_SERVICO_ATIVO,
          concluido: false,
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Cadastrar primeiro serviço",
            destino: "/painel/servicos/novo?onboarding=servico",
          },
        });
      }
    );

    test(
      "leva à revisão do negócio quando o serviço está pronto mas a publicação ainda não aconteceu",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico: true,
            possui_servico_ativo: true,
            agenda_configurada: false,
            negocio_publicado: false,
          });

        expect(resultado).toMatchObject({
          estado:
            ESTADOS_PROXIMA_ACAO_ATIVACAO
              .REVISAR_PUBLICACAO,
          concluido: false,
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Revisar meu negócio",
            destino: "/painel/negocio",
          },
        });
      }
    );

    test(
      "usa compartilhamento rastreável como ação para conquistar o primeiro agendamento sem exigir agenda personalizada",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico_ativo: true,
            agenda_configurada: false,
            negocio_publicado: true,
            primeiro_agendamento_recebido: false,
          });

        expect(resultado).toMatchObject({
          estado:
            ESTADOS_PROXIMA_ACAO_ATIVACAO
              .CONQUISTAR_PRIMEIRO_AGENDAMENTO,
          concluido: false,
          acao: {
            tipo: "COMPARTILHAR_PERFIL",
            rotulo: "Compartilhar perfil",
          },
        });
        expect(
          resultado.acao.destino
        ).toBeUndefined();
      }
    );

    test(
      "marca somente o primeiro agendamento como conclusão da ativação",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico_ativo: true,
            agenda_configurada: false,
            negocio_publicado: true,
            primeiro_agendamento_recebido: true,
          });

        expect(resultado).toMatchObject({
          estado:
            ESTADOS_PROXIMA_ACAO_ATIVACAO
              .ATIVADO,
          concluido: true,
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Abrir agenda",
            destino: "/painel/agenda",
          },
        });
      }
    );
  }
);
