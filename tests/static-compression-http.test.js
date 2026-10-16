const fs = require("fs");
const path = require("path");
const http = require("http");
const { gunzipSync } = require("zlib");
const app = require("../src/server");

describe("compressão HTTP dos assets da build", () => {
  let server;
  let port;
  const build = path.resolve(__dirname, "../agendamento-nails/react-app");
  const html = fs.readFileSync(path.join(build, "index.html"), "utf8");

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    port = server.address().port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  function get(url, encoding) {
    return new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: url,
        headers: { "Accept-Encoding": encoding } }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode,
          headers: response.headers, body: Buffer.concat(chunks) }));
        response.on("error", reject);
      }).on("error", reject);
    });
  }

  test.each(["js", "css"])("entrega %s compactado com conteúdo idêntico e cache preservado", async (extension) => {
    const asset = html.match(new RegExp(`/assets/[^"\\s]+\\.${extension}`))?.[0];
    expect(asset).toBeDefined();
    const plain = await get(asset, "identity");
    const gzip = await get(asset, "gzip");
    expect(plain.status).toBe(200);
    expect(gzip.status).toBe(200);
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(gzip.headers["content-encoding"]).toBe("gzip");
    expect(gzip.headers.vary).toContain("Accept-Encoding");
    expect(plain.headers.vary).toContain("Accept-Encoding");
    expect(gzip.headers["cache-control"]).toContain("immutable");
    expect(gzip.headers["content-type"]).toBe(plain.headers["content-type"]);
    expect(gunzipSync(gzip.body)).toEqual(plain.body);
    expect(gzip.body.length).toBeLessThan(plain.body.length / 2);
  });

  test("preserva imagens e documentos fora da compressão textual de assets", async () => {
    const image = await get("/assets/home/salon-hero-mobile.webp", "gzip");
    expect(image.status).toBe(200);
    expect(image.headers["content-encoding"]).toBeUndefined();
    const document = await get("/entrar", "gzip");
    expect(document.status).toBe(200);
    expect(document.headers["content-encoding"]).toBeUndefined();
    expect(document.headers["cache-control"]).toContain("no-store");
  });
});
