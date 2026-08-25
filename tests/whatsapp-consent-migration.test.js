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
  }
);
