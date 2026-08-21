const {
  especialidadeDaCategoria,
  normalizarEspecialidades,
} = require(
  "../src/domain/especialidadesNegocio"
);

describe(
  "Especialidades do negócio",
  () => {
    test(
      "normaliza aliases e mantém a ordem oficial sem duplicar",
      () => {
        expect(
          normalizarEspecialidades([
            "estética",
            "Unha",
            "unhas",
            "Cabelo",
            "bronzeamento",
          ])
        ).toEqual([
          "Unhas",
          "Cabelos",
          "Estética",
          "Bronzeamento",
        ]);
      }
    );

    test(
      "converte o setor antigo para manter negócios existentes editáveis",
      () => {
        expect(
          normalizarEspecialidades([], {
            setorLegado:
              "Salão de beleza",

            legado:
              true,
          })
        ).toEqual([
          "Outro",
        ]);
      }
    );

    test(
      "converte categoria do serviço em especialidade do negócio",
      () => {
        expect(
          especialidadeDaCategoria(
            "sobrancelha"
          )
        ).toBe(
          "Sobrancelhas"
        );
      }
    );

    test(
      "converte a categoria de bronzeamento em especialidade do negócio",
      () => {
        expect(
          especialidadeDaCategoria(
            "bronzeamento"
          )
        ).toBe(
          "Bronzeamento"
        );
      }
    );
  }
);
