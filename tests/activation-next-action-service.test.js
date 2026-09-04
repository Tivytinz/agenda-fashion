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
          possui_servico_ativo: false,
          agenda_configurada: false,
          negocio_publicado: false,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .GARANTIR_SERVICO_ATIVO,
      ],
      [
        "avança para confirmação da agenda depois do serviço",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: false,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .CONFIRMAR_AGENDA,
      ],
      [
        "preserva a agenda como prioridade para negócio legado já publicado",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: true,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .CONFIRMAR_AGENDA,
      ],
      [
        "pede revisão da publicação quando serviço e agenda estão prontos",
        {
          possui_servico_ativo: true,
          agenda_configurada: true,
          negocio_publicado: false,
          primeiro_agendamento_recebido: false,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .REVISAR_PUBLICACAO,
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
          agenda_configurada: true,
          negocio_publicado: true,
          primeiro_agendamento_recebido: true,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .ATIVADO,
      ],
      [
        "volta para serviço ativo quando uma operação já ativada perde todos os serviços ativos",
        {
          possui_servico_ativo: false,
          agenda_configurada: true,
          negocio_publicado: true,
          primeiro_agendamento_recebido: true,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .GARANTIR_SERVICO_ATIVO,
      ],
      [
        "volta para agenda quando uma operação já ativada perde a configuração confirmada",
        {
          possui_servico_ativo: true,
          agenda_configurada: false,
          negocio_publicado: true,
          primeiro_agendamento_recebido: true,
        },
        ESTADOS_PROXIMA_ACAO_ATIVACAO
          .CONFIRMAR_AGENDA,
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
      "não chama ausência de serviço ativo de primeiro serviço",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico_ativo: false,
          });

        expect(resultado).toMatchObject({
          estado:
            ESTADOS_PROXIMA_ACAO_ATIVACAO
              .GARANTIR_SERVICO_ATIVO,
          concluido: false,
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Gerenciar serviços",
            destino: "/painel/servicos",
          },
        });
        expect(
          resultado.titulo
            .toLowerCase()
        ).not.toContain(
          "primeiro"
        );
      }
    );

    test(
      "usa compartilhamento rastreável como ação para conquistar o primeiro agendamento",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico_ativo: true,
            agenda_configurada: true,
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
      "marca somente o estado final como concluído",
      () => {
        const resultado =
          resolverProximaAcaoAtivacao({
            possui_servico_ativo: true,
            agenda_configurada: true,
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
