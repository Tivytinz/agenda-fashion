const DEFINITIONS = {
  CAC: {
    title: "CAC · Custo de Aquisição",
    description:
      "Quanto foi investido, em média, para conquistar uma nova assinatura ativada de profissional. Quanto menor, melhor, desde que a qualidade da aquisição seja mantida."
  },
  ROAS: {
    title: "ROAS · Retorno sobre investimento em anúncios",
    description:
      "Compara a receita atribuída à campanha com o valor investido. Ex.: ROAS 1,20x significa R$ 1,20 de receita atribuída para cada R$ 1,00 investido. Não desconta custos operacionais, impostos ou margem e, portanto, não representa lucro."
  },
  CPA: {
    title: "CPA · Custo por aquisição",
    description:
      "No AF, mostra quanto foi gasto, em média, para gerar um agendamento concluído em campanhas com objetivo Cliente."
  },
  CPS: {
    title: "CPS · Custo por sessão",
    description:
      "Divide o investimento do período pelas sessões atribuídas a campanhas com cobertura financeira. Indica quanto custou, em média, trazer uma visita mensurável."
  },
  CPC: {
    title: "CPC · Custo por clique",
    description:
      "Valor médio pago por cada clique no anúncio. É uma métrica da plataforma de mídia e ajuda a avaliar o custo para trazer tráfego."
  },
  UTM: {
    title: "UTM · Identificação do tráfego",
    description:
      "Parâmetros adicionados ao link para registrar origem, mídia e campanha. A UTM é a atribuição direta preferencial; sem ela, o AF só resolve a campanha quando existe um vínculo único e verificado com a plataforma."
  },
  ATRIBUICAO: {
    title: "Atribuição direta e assistida",
    description:
      "Atribuição direta usa a UTM oficial recebida na visita. A assistida recupera a campanha por uma identidade ou vínculo único e verificado da plataforma, mantendo o método visível para auditoria."
  },
  COBERTURA: {
    title: "Cobertura de atribuição e financeira",
    description:
      "A cobertura de atribuição mede a parcela do tráfego pago ligada com segurança a uma campanha. A financeira mede a parcela dessas sessões em campanhas com investimento no período. O padrão operacional é 100% em ambas."
  },
  COORTE: {
    title: "Coorte",
    description:
      "Grupo de profissionais que entrou no AF dentro do período selecionado. Os marcos mostram o que esse mesmo grupo já alcançou depois do cadastro; a régua respeita janelas mínimas de ativação e monetização."
  },
  CONVERSAO: {
    title: "Taxa de conversão",
    description:
      "Percentual das sessões atribuídas que chegaram ao resultado medido, como um agendamento concluído."
  }
};

export function MarketingMetricGlossary({ terms = Object.keys(DEFINITIONS) }) {
  const definitions = terms
    .map((term) => DEFINITIONS[term])
    .filter(Boolean);

  if (!definitions.length) return null;

  return (
    <aside className="marketing-metric-help" aria-label="Ajuda sobre métricas de marketing">
      <details className="marketing-metric-glossary">
        <summary>Entenda as métricas desta tela</summary>
        <div className="marketing-metric-glossary-grid">
          {definitions.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </details>
    </aside>
  );
}
