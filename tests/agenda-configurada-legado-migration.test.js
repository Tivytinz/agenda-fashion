const fs = require("fs");
const path = require("path");

describe(
  "migração de recuperação da agenda configurada",
  () => {
    test(
      "recupera apenas legado com evidência persistida de edição",
      () => {
        const migration =
          fs.readFileSync(
            path.join(
              __dirname,
              "../database/migrations/058_backfill_agenda_configurada_legado.sql"
            ),
            "utf8"
          );

        expect(
          migration
        ).toMatch(
          /UPDATE\s+agenda_configuracoes/i
        );

        expect(
          migration
        ).toMatch(
          /ac\.configurado_em\s+IS\s+NULL/i
        );

        expect(
          migration
        ).toMatch(
          /FROM\s+agenda_horarios/i
        );

        expect(
          migration
        ).toMatch(
          /updated_at\s*>\s*created_at/i
        );

        expect(
          migration
        ).toMatch(
          /configurado_em_recuperado[\s\S]*IS\s+NOT\s+NULL/i
        );
      }
    );
  }
);
