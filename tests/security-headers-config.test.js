const {
  obterContentSecurityPolicy,
} = require(
  "../src/config/securityHeaders"
);

describe("Content Security Policy", () => {
  test.each(["production", "development", undefined])(
    "preserva upgrade HTTPS fora dos testes (%s)",
    (environment) => {
      const previous = process.env.NODE_ENV;
      try {
        if (environment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = environment;
        expect(obterContentSecurityPolicy().directives["upgrade-insecure-requests"])
          .toEqual([]);
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      }
    }
  );

  test("permite assets HTTP no servidor local de testes sem remover as demais proteções", () => {
    const helmet = require("helmet");
    const express = require("express");
    const request = require("supertest");
    const app = express();
    app.use(helmet({ contentSecurityPolicy: obterContentSecurityPolicy() }));
    app.get("/", (req, res) => res.send("ok"));
    return request(app).get("/").expect(200).then((response) => {
      const header = response.headers["content-security-policy"];
      expect(header).not.toContain("upgrade-insecure-requests");
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src-attr 'none'");
      expect(header).toContain("object-src 'none'");
    });
  });

  test("permite somente scripts usados pelo AF", () => {
    const policy =
      obterContentSecurityPolicy();
    const scripts =
      policy.directives["script-src"];

    expect(scripts).toContain("'self'");
    expect(scripts).toContain(
      "https://accounts.google.com"
    );
    expect(scripts).toContain(
      "https://connect.facebook.net"
    );
    expect(scripts).toContain(
      "https://www.googletagmanager.com"
    );
    expect(scripts).not.toContain(
      "'unsafe-inline'"
    );
    expect(scripts).not.toContain(
      "https://static.cloudflareinsights.com"
    );
  });

  test("permite endpoints de coleta usados pelo GA4", () => {
    const policy =
      obterContentSecurityPolicy();
    const connections =
      policy.directives["connect-src"];

    expect(connections).toContain("'self'");
    expect(connections).toContain(
      "https://www.google-analytics.com"
    );
    expect(connections).toContain(
      "https://region1.google-analytics.com"
    );
    expect(connections).toContain(
      "https://analytics.google.com"
    );
  });

  test("bloqueia plugins e enquadramento externo", () => {
    const directives =
      obterContentSecurityPolicy()
        .directives;

    expect(directives["object-src"])
      .toEqual(["'none'"]);
    expect(directives["frame-ancestors"])
      .toEqual(["'self'"]);
  });
});
