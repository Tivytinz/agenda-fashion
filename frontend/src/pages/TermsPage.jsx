import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LEGAL_CONTACT_EMAIL,
  TERMS_VERSION
} from "../config/legal";

export function TermsPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title =
      "Termos de uso | Agenda Fashion";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="container page-content narrow-page legal-page">
      <Link className="back-link" to="/">
        ← Voltar ao Agenda Fashion
      </Link>

      <header className="workspace-heading legal-heading">
        <div>
          <p className="eyebrow">Regras claras</p>
          <h1>Termos de uso</h1>
          <p>
            Estes termos explicam como funciona o Agenda Fashion, seus planos, pagamentos e responsabilidades.
          </p>
          <small>
            Versão vigente: {TERMS_VERSION}
          </small>
        </div>
      </header>

      <section className="panel legal-section">
        <h2>1. Serviço e responsável</h2>
        <p>
          O Agenda Fashion é uma plataforma brasileira de descoberta e agendamento para profissionais e negócios de beleza e estética. Dúvidas, solicitações legais e suporte podem ser enviados para <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>2. Contas e informações cadastradas</h2>
        <p>
          A pessoa usuária deve fornecer informações verdadeiras, manter seus dados atualizados e proteger suas credenciais. Profissionais e negócios são responsáveis pela exatidão dos serviços, preços, horários, imagens e demais informações publicados em seus perfis.
        </p>
        <p>
          O Agenda Fashion pode limitar ou suspender contas usadas para fraude, abuso, tentativa de invasão, conteúdo ilegal ou violação destes termos, preservado o direito de esclarecimento quando aplicável.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>3. Agendamentos</h2>
        <p>
          O Agenda Fashion facilita o encontro entre clientes e profissionais. O atendimento de beleza é prestado pelo profissional ou negócio escolhido, que responde pela execução, qualidade, preço e condições específicas do serviço.
        </p>
        <p>
          A disponibilidade exibida depende das configurações mantidas pelo negócio. Cancelamentos e alterações devem respeitar as regras informadas no fluxo de agendamento e a legislação aplicável.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>4. Planos e limites</h2>
        <p>
          O plano Grátis custa R$ 0,00, não exige cartão e oferece até 10 agendamentos por mês, 1 profissional e 2 serviços. Os planos pagos vigentes são Autônoma por R$ 49,90/mês, Studio por R$ 99,90/mês e Salão por R$ 199,90/mês, com os limites apresentados na página de planos antes da contratação.
        </p>
        <p>
          O Agenda Fashion pode alterar preços ou limites futuros mediante informação clara antes da próxima contratação ou renovação. Períodos já pagos não têm o valor alterado retroativamente.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>5. Pagamento e renovação</h2>
        <p>
          Os planos pagos possuem ciclo mensal. A cobrança é processada por PIX através do Asaas e o plano somente é ativado depois da confirmação do pagamento. Não existe taxa de adesão nem cobrança em cartão pelo Agenda Fashion nesse fluxo.
        </p>
        <p>
          Uma nova cobrança PIX pode ser gerada para o ciclo seguinte enquanto a renovação estiver ativa. A assinatura pode ser cancelada na área “Plano e assinatura”; o acesso pago continua até o fim do período já quitado e, depois, o negócio retorna ao plano Grátis.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>6. Reembolso e arrependimento</h2>
        <p>
          Solicitações de arrependimento ou reembolso serão analisadas conforme o Código de Defesa do Consumidor e demais regras aplicáveis. O pedido deve ser enviado para <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>, com identificação da conta e do pagamento. Fora das hipóteses legais ou de falha comprovada do serviço, períodos já iniciados não geram reembolso proporcional automático.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>7. WhatsApp e comunicações</h2>
        <p>
          Avisos automáticos e orientações de marketing pelo WhatsApp dependem de autorização específica. A pessoa pode desativar as preferências na conta ou usar os comandos de cancelamento informados nas mensagens. O agendamento continua disponível sem consentimento para marketing.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>8. Privacidade</h2>
        <p>
          O tratamento de dados pessoais, cookies, ferramentas de medição e direitos da pessoa titular estão descritos na <Link to="/privacidade">Política de Privacidade</Link>, que integra estes termos.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>9. Disponibilidade e responsabilidade</h2>
        <p>
          O Agenda Fashion adota medidas para manter a plataforma segura e disponível, mas manutenções, falhas externas ou eventos fora de seu controle podem causar interrupções. Nada nestes termos exclui direitos garantidos por lei nem responsabilidade que não possa ser legalmente afastada.
        </p>
      </section>

      <section className="panel legal-section">
        <h2>10. Alterações e contato</h2>
        <p>
          Mudanças relevantes nestes termos serão apresentadas com nova data de versão. O uso continuado após a comunicação representa concordância com a versão vigente, sem reduzir direitos legais já adquiridos.
        </p>
        <p>
          Contato: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </main>
  );
}
