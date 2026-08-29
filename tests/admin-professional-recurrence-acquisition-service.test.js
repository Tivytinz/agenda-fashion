const {
  agruparPorOrigemAquisicao,
  normalizarAquisicao,
} = require(
  "../src/services/adminProfessionalRecurrenceAcquisitionService"
);

describe(
  "adminProfessionalRecurrenceAcquisitionService",
  () => {
    test(
      "mantem origens oficiais e problemas de atribuicao separados",
      () => {
        const grupos =
          agruparPorOrigemAquisicao([
            {
              usuario_id: 1,
              classificacao_atribuicao: "oficial",
              origem: "google",
            },
            {
              usuario_id: 2,
              classificacao_atribuicao: "oficial",
              origem: "meta",
            },
            {
              usuario_id: 3,
              classificacao_atribuicao: "organico",
              origem: "instagram",
            },
            {
              usuario_id: 4,
              classificacao_atribuicao:
                "rastreamento_incompleto",
              origem: "google",
            },
            {
              usuario_id: 5,
              classificacao_atribuicao:
                "identidade_nao_oficial",
              origem: "meta",
            },
            {
              usuario_id: 6,
              classificacao_atribuicao: "sem_evidencia",
              origem: "google",
            },
            {
              usuario_id: 7,
              classificacao_atribuicao: "sem_evidencia",
              origem: null,
            },
          ]);

        expect(
          grupos.map((grupo) => ({
            chave: grupo.chave,
            quantidade: grupo.linhas.length,
          }))
        ).toEqual([
          {
            chave: "oficial:google",
            quantidade: 1,
          },
          {
            chave: "oficial:meta",
            quantidade: 1,
          },
          {
            chave: "organico:instagram",
            quantidade: 1,
          },
          {
            chave:
              "rastreamento_incompleto:google",
            quantidade: 1,
          },
          {
            chave:
              "identidade_nao_oficial:meta",
            quantidade: 1,
          },
          {
            chave:
              "sem_evidencia:sem_evidencia",
            quantidade: 2,
          },
        ]);
      }
    );

    test(
      "nao promove classificacao desconhecida para origem confiavel",
      () => {
        expect(
          normalizarAquisicao({
            classificacao_atribuicao: "qualquer_coisa",
            origem: "google",
          })
        ).toEqual({
          classificacao: "sem_evidencia",
          origem: "sem_evidencia",
        });
      }
    );
  }
);
