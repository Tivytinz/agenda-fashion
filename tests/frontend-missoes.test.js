const fs = require(
  "fs"
);

const path = require(
  "path"
);

function ler(
  caminho
) {
  return fs.readFileSync(
    path.resolve(
      __dirname,
      caminho
    ),
    "utf8"
  );
}

describe(
  "objetivos do frontend",
  () => {
    test(
      "dashboard do dono torna crescimento e capacidade visíveis",
      () => {
        const html =
          ler(
            "../agendamento-nails/html/dashboard-dono.html"
          );

        const javascript =
          ler(
            "../agendamento-nails/js/dashboard-dono.js"
          );

        expect(
          html
        ).toContain(
          "Sua agenda está ganhando força"
        );

        expect(
          html
        ).toContain(
          "Capacidade do mês"
        );

        expect(
          javascript
        ).toContain(
          "mensagem_crescimento_visualizada"
        );

        expect(
          `${html}\n${javascript}`
        ).toContain(
          "percentual_capacidade"
        );
      }
    );

    test(
      "home apresenta o AF como destino para descobrir e agendar beleza",
      () => {
        const html =
          ler(
            "../agendamento-nails/html/inicio.html"
          );

        expect(
          html
        ).toContain(
          "Seu próximo serviço de beleza está aqui"
        );

        expect(
          html
        ).toContain(
          "Serviços para você agendar"
        );

        expect(
          html
        ).toContain(
          "Negócios de beleza em destaque"
        );
      }
    );

    test(
      "admin apresenta a jornada sem expor a palavra missão",
      () => {
        const html =
          ler(
            "../agendamento-nails/html/admin.html"
          );

        expect(
          html
        ).toContain(
          "Jornada de descoberta e agendamento"
        );

        expect(
          html
        ).not.toContain(
          "Missão das telas"
        );
      }
    );

    test(
      "dashboard profissional prioriza o dia e o próximo atendimento",
      () => {
        const html =
          ler(
            "../agendamento-nails/html/dashboard-profissional.html"
          );

        const javascript =
          ler(
            "../agendamento-nails/js/dashboard-profissional.js"
          );

        expect(
          html.indexOf(
            "proximoAtendimento"
          )
        ).toBeLessThan(
          html.indexOf(
            "agendamentosHoje"
          )
        );

        expect(
          html
        ).toContain(
          "O que precisa da sua atenção agora"
        );

        expect(
          javascript
        ).toContain(
          '"agenda-profissional.html"'
        );

        expect(
          javascript
        ).not.toContain(
          '"painel-profissional.html"'
        );

        expect(
          javascript
        ).not.toContain(
          '"agendamentos-profissional.html"'
        );
      }
    );

    test(
      "assinatura usa progresso e mantém a comparação transparente nos planos",
      () => {
        const assinaturaHtml =
          ler(
            "../agendamento-nails/html/minha-assinatura.html"
          );

        const assinaturaJs =
          ler(
            "../agendamento-nails/js/minha-assinatura.js"
          );

        const planosHtml =
          ler(
            "../agendamento-nails/html/planos.html"
          );

        expect(
          assinaturaHtml
        ).toContain(
          "Agendamentos conquistados"
        );

        expect(
          assinaturaJs
        ).not.toContain(
          "agendamentos disponíveis neste mês"
        );

        expect(
          planosHtml
        ).toContain(
          "Compare a capacidade mensal"
        );
      }
    );
  }
);
