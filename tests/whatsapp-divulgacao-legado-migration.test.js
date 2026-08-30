const fs = require("fs");
const path = require("path");

describe(
  "Saneamento de lembretes antigos de divulgação",
  () => {
    test(
      "cancela somente divulgação pendente sem agenda confirmada",
      () => {
        const caminho = path.join(
          __dirname,
          "../database/migrations/059_cancelar_divulgacao_sem_agenda.sql"
        );

        const sql = fs
          .readFileSync(
            caminho,
            "utf8"
          )
          .replace(/\s+/g, " ");

        expect(sql).toContain(
          "UPDATE whatsapp_mensagens wm"
        );
        expect(sql).toContain(
          "wm.tipo = 'LEMBRETE_DIVULGAR_NEGOCIO'"
        );
        expect(sql).toContain(
          "status = 'CANCELED'"
        );
        expect(sql).toContain(
          "ac.configurado_em IS NOT NULL"
        );
        expect(sql).toContain(
          "un.ativo = TRUE"
        );
        expect(sql).toContain(
          "un.papel IN ( 'dono', 'profissional' )"
        );
        expect(sql).not.toContain(
          "wm.tipo = 'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO'"
        );
      }
    );
  }
);
