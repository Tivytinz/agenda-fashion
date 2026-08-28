const service = require(
  "../src/services/googleAnalyticsReportingService"
);

function expectedAdminFilter() {
  return {
    notExpression: {
      filter: {
        fieldName: "landingPage",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: "/admin",
          caseSensitive: false
        }
      }
    }
  };
}

describe("googleAnalyticsReportingService · tráfego interno", () => {
  test("exclui landing pages administrativas de todos os relatórios", () => {
    const periodo = {
      dataInicio: "2026-08-01",
      dataFim: "2026-08-28"
    };
    const requests = service.montarRequests(periodo);

    expect(requests).toHaveLength(5);
    for (const request of requests) {
      expect(request.dimensionFilter)
        .toEqual(expectedAdminFilter());
    }

    expect(
      service.montarLocationRequest(periodo).dimensionFilter
    ).toEqual(expectedAdminFilter());
  });

  test("expõe um filtro estável para qualquer subrota /admin", () => {
    expect(service.adminLandingPageFilter()).toEqual(
      expectedAdminFilter()
    );
  });
});
