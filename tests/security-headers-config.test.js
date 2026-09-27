const {
  obterContentSecurityPolicy,
} = require(
  "../src/config/securityHeaders"
);

describe("Content Security Policy", () => {
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
