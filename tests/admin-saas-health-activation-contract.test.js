jest.mock(
  "../src/repositories/adminSaasHealthRepository",
  () => ({})
);

const {
  mapearPendencias,
  escolherProximaAcao,
} = require(
  "../src/services/adminSaasHealthService"
);

function perfilElegivel(sobrescritas = {}) {
  return {
    tem_negocio: true,
    negocio_nome: "Studio Ana",
    areas: ["unhas"],
    setor: "unhas",
    negocio_whatsapp: "11987654321",
    cidade: "São Paulo",
    estado: "SP",
    bairro: "Centro",
    endereco: "Rua das Flores",
    numero: "10",
    cep: "01001000",
    localizacao_url: "https://maps.google.com/",
    descricao: null,
    possui_servico_ativo: true,
    perfil_basico_completo: true,
    publicado: false,
    disponibilidade_inicializada: false,
    primeiro_agendamento_valido: false,
    ...sobrescritas,
  };
}

describe(
  "contrato de ativação da saúde do SaaS",
  () => {
    test(
      "prioriza publicação sobre disponibilidade quando os dois reparos técnicos coexistem",
      () => {
        const pendencias =
          mapearPendencias(
            perfilElegivel()
          );

        expect(
          escolherProximaAcao(
            pendencias
          )
        ).toEqual({
          codigo: "publicacao",
          rotulo: "Reprocessar publicação automática",
          tipo: "sistema",
        });
      }
    );

    test(
      "replica o critério do runtime para CEP e localização",
      () => {
        const pendencias =
          mapearPendencias(
            perfilElegivel({
              cep: "01001-000",
              localizacao_url: "valor-legado-nao-vazio",
            })
          );

        const codigos =
          pendencias.map(
            (item) => item.codigo
          );

        expect(codigos)
          .toContain("cep");
        expect(codigos)
          .toContain("localizacao");
      }
    );

    test(
      "mantém descrição opcional e disponibilidade fora da ação de ativação",
      () => {
        const pendencias =
          mapearPendencias(
            perfilElegivel({
              publicado: true,
              primeiro_agendamento_valido: true,
            })
          );

        expect(pendencias)
          .toEqual([
            {
              codigo: "disponibilidade",
              rotulo: "Reprocessar disponibilidade inicial",
              tipo: "sistema",
            },
            {
              codigo: "descricao",
              rotulo: "Adicionar descrição (opcional)",
              tipo: "recomendacao",
            },
          ]);
      }
    );
  }
);
