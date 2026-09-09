jest.mock(
  "../src/repositories/configuracoesRepository",
  () => ({})
);

jest.mock(
  "../src/utils/uploadCloudinary",
  () => {
    const enviar = jest.fn();
    enviar.remover = jest.fn();
    return enviar;
  }
);

const {
  avaliarPublicacao,
} = require(
  "../src/services/configuracoesService"
);

function negocioCompleto(
  alteracoes = {}
) {
  return {
    nome: "Studio Agenda Fashion",
    descricao: "",
    foto_url: null,
    complemento: "",
    areas: ["Unhas"],
    setor: "Unhas",
    whatsapp: "62999999999",
    cidade: "Goiânia",
    estado: "GO",
    bairro: "Centro",
    endereco: "Rua das Flores",
    numero: "10",
    cep: "74000123",
    localizacao_url: "https://maps.google.com/?q=studio",
    possui_servico_ativo: true,
    publicado: false,
    publicacao_exige_agenda: false,
    agenda_configurada: false,
    ...alteracoes,
  };
}

describe(
  "elegibilidade de publicação v2",
  () => {
    test(
      "publica perfil completo com serviço ativo sem exigir personalização da agenda",
      () => {
        expect(
          avaliarPublicacao(
            negocioCompleto()
          )
        ).toEqual({
          publicado: false,
          pode_publicar: true,
          pendencias: [],
        });
      }
    );

    test(
      "mantém descrição, foto e complemento opcionais",
      () => {
        const resultado =
          avaliarPublicacao(
            negocioCompleto({
              descricao: "",
              foto_url: null,
              complemento: "",
            })
          );

        expect(resultado.pode_publicar).toBe(true);
        expect(resultado.pendencias).toEqual([]);
      }
    );

    test(
      "não transforma remoção do gate de agenda em publicação de perfil incompleto",
      () => {
        const resultado =
          avaliarPublicacao(
            negocioCompleto({
              bairro: "",
              endereco: "",
              numero: "",
              localizacao_url: "",
            })
          );

        expect(resultado.pode_publicar).toBe(false);
        expect(resultado.pendencias).toEqual(
          expect.arrayContaining([
            "bairro",
            "endereço",
            "número",
            "link do Google Maps",
          ])
        );
      }
    );

    test(
      "exige WhatsApp e CEP estruturalmente válidos antes de publicar",
      () => {
        const resultado =
          avaliarPublicacao(
            negocioCompleto({
              whatsapp: "123",
              cep: "7400",
            })
          );

        expect(resultado.pode_publicar).toBe(false);
        expect(resultado.pendencias).toEqual(
          expect.arrayContaining([
            "WhatsApp",
            "CEP",
          ])
        );
      }
    );

    test(
      "continua exigindo pelo menos um serviço ativo",
      () => {
        const resultado =
          avaliarPublicacao(
            negocioCompleto({
              possui_servico_ativo: false,
            })
          );

        expect(resultado.pode_publicar).toBe(false);
        expect(resultado.pendencias).toContain(
          "pelo menos um serviço ativo"
        );
      }
    );
  }
);
