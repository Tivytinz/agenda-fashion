const {
  campanhaAusenteSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
} = require(
  "../src/repositories/marketingAttributionSql"
);

describe(
  "SQL compartilhado de atribuição",
  () => {
    test(
      "mantém no funil os mesmos identificadores pagos aceitos pelo frontend",
      () => {
        const atribuicao =
          criarAtribuicaoUsuarioSql(
            "mua"
          );

        expect(atribuicao.paidClick)
          .toContain("mua.gbraid");
        expect(atribuicao.paidClick)
          .toContain("mua.wbraid");
        expect(atribuicao.paidClick)
          .toContain("mua.msclkid");
        expect(atribuicao.paidClick)
          .toContain("mua.ttclid");
        expect(atribuicao.paidClick)
          .toContain("mua.epik");
        expect(atribuicao.campanha)
          .toContain("'(sem campanha)'");
      }
    );

    test(
      "preserva a identidade exata e só assiste a atribuição com vínculo verificado e único",
      () => {
        const vinculo =
          criarVinculoCampanhaOficialSql({
            origem: "e.origem",
            midia: "e.midia",
            campanha: "e.campanha",
            momento: "e.created_at",
          });

        expect(vinculo).not.toMatch(
          /candidata\.ativo\s*=\s*TRUE/i
        );
        expect(vinculo).toContain(
          "LOWER(candidata.utm_campaign)"
        );
        expect(vinculo).toContain(
          "marketing_campanha_vinculos"
        );
        expect(vinculo).toContain(
          "marketing_custo_sincronizacoes"
        );
        expect(vinculo).toContain(
          "sincronizacao.status = 'sucesso'"
        );
        expect(vinculo).toContain(
          "sincronizacao.campanhas_nao_vinculadas = 0"
        );
        expect(vinculo).toContain(
          "sincronizacao.reconciliacao_campanhas_completa = TRUE"
        );
        expect(vinculo).toContain(
          "e.created_at"
        );
        expect(vinculo).toContain(
          "COUNT(DISTINCT vinculo_unico.campanha_id)"
        );
        expect(vinculo).toContain(
          "COUNT(DISTINCT vinculo_identidade.campanha_id)"
        );
        expect(vinculo).toContain(
          "IN ('', '(sem campanha)', 'sem campanha', 'organico', 'orgânico')"
        );
        expect(vinculo).toContain(
          "metodo_resolucao"
        );
        expect(vinculo).toContain(
          "'vinculo_plataforma'"
        );
        expect(vinculo).toContain(
          "'vinculo_unico'"
        );
        expect(
          campanhaAusenteSql(
            "e.campanha"
          )
        ).toContain("(sem campanha)");
      }
    );
  }
);
