const fs = require("fs");
const path = require("path");

describe(
  "migration de consentimento comprovável do WhatsApp",
  () => {
    const migration =
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../database/migrations/054_consentimento_comprovavel_optout_global.sql"
        ),
        "utf8"
      );
    const durableOptoutMigration =
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../database/migrations/055_optout_global_duravel_whatsapp.sql"
        ),
        "utf8"
      );

    test(
      "revoga somente autorização ativa sem último evento explícito de consentimento",
      () => {
        expect(migration).toContain(
          "consentimento.escopo = 'OPERACIONAL_CLIENTE'"
        );
        expect(migration).toContain(
          "consentimento.agendamento_id IS NULL"
        );
        expect(migration).toContain(
          "consentimento.created_at DESC"
        );
        expect(migration).toContain(
          ") <> 'CONSENTIDO'"
        );
        expect(migration).toContain(
          "whatsapp_notificacoes_consentido_em = NULL"
        );
        expect(migration).toContain(
          "'revogacao-sem-evidencia-v1'"
        );
        expect(migration).toContain(
          "usuario.whatsapp IS NOT NULL"
        );
        expect(migration).toContain(
          "usuario.whatsapp ~ '^[0-9]{10,13}$'"
        );
      }
    );

    test(
      "cancela a fila afetada e registra opt-out global separadamente",
      () => {
        expect(migration).toContain(
          "Consentimento legado sem evidência foi revogado."
        );
        expect(migration).toContain(
          "'GLOBAL_OPTOUT'"
        );
        expect(migration).toContain(
          "'MIGRACAO'"
        );
      }
    );

    test(
      "revoga agendamentos anteriores ao opt-out sem apagar um novo aceite",
      () => {
        expect(
          durableOptoutMigration
        ).toContain(
          "whatsapp_consentido_em = NULL"
        );
        expect(
          durableOptoutMigration
        ).toMatch(
          /whatsapp_consentido_em\s+<= optout\.recebido_em/
        );
        expect(
          durableOptoutMigration
        ).toContain(
          "'optout-global-retroativo-v1'"
        );
        expect(
          durableOptoutMigration
        ).toContain(
          "whatsapp_interacoes_optout_telefone_idx"
        );
        expect(
          durableOptoutMigration
        ).toContain(
          "'CANCELAMENTO_AGENDAMENTO_CLIENTE'"
        );
      }
    );
  }
);
