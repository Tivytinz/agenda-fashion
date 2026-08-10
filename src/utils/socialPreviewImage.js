const zlib = require("zlib");

const LARGURA = 1200;
const ALTURA = 630;

let imagemEmCache = null;

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^
        (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const nome = Buffer.from(tipo, "ascii");
  const tamanho = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  tamanho.writeUInt32BE(dados.length);
  checksum.writeUInt32BE(
    crc32(Buffer.concat([nome, dados]))
  );

  return Buffer.concat([tamanho, nome, dados, checksum]);
}

function desenharRetangulo(pixels, x, y, largura, altura, cor) {
  for (let linha = y; linha < y + altura; linha += 1) {
    for (let coluna = x; coluna < x + largura; coluna += 1) {
      const indice = (linha * LARGURA + coluna) * 4;
      pixels[indice] = cor[0];
      pixels[indice + 1] = cor[1];
      pixels[indice + 2] = cor[2];
      pixels[indice + 3] = 255;
    }
  }
}

function desenharLetra(pixels, desenho, inicioX, inicioY, escala) {
  desenho.forEach((linha, y) => {
    [...linha].forEach((pixel, x) => {
      if (pixel === "1") {
        desenharRetangulo(
          pixels,
          inicioX + x * escala,
          inicioY + y * escala,
          escala,
          escala,
          [255, 255, 255]
        );
      }
    });
  });
}

function criarImagemPadrao() {
  if (imagemEmCache) return imagemEmCache;

  const pixels = Buffer.alloc(LARGURA * ALTURA * 4);
  desenharRetangulo(
    pixels,
    0,
    0,
    LARGURA,
    ALTURA,
    [197, 36, 107]
  );

  const letraA = [
    "01110",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001"
  ];
  const letraF = [
    "11111",
    "10000",
    "10000",
    "11110",
    "10000",
    "10000",
    "10000"
  ];
  const escala = 48;
  const larguraLetra = 5 * escala;
  const espaco = escala;
  const inicioX = Math.floor(
    (LARGURA - (larguraLetra * 2 + espaco)) / 2
  );
  const inicioY = Math.floor((ALTURA - 7 * escala) / 2);

  desenharLetra(pixels, letraA, inicioX, inicioY, escala);
  desenharLetra(
    pixels,
    letraF,
    inicioX + larguraLetra + espaco,
    inicioY,
    escala
  );

  const linhas = Buffer.alloc(ALTURA * (1 + LARGURA * 4));

  for (let y = 0; y < ALTURA; y += 1) {
    const destino = y * (1 + LARGURA * 4);
    linhas[destino] = 0;
    pixels.copy(
      linhas,
      destino + 1,
      y * LARGURA * 4,
      (y + 1) * LARGURA * 4
    );
  }

  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(LARGURA, 0);
  cabecalho.writeUInt32BE(ALTURA, 4);
  cabecalho[8] = 8;
  cabecalho[9] = 6;

  imagemEmCache = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", cabecalho),
    chunk("IDAT", zlib.deflateSync(linhas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);

  return imagemEmCache;
}

module.exports = {
  ALTURA,
  LARGURA,
  criarImagemPadrao
};
