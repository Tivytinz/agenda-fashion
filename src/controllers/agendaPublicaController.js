const db = require("../db");

function gerarDiasProximos(qtd = 7) {
  const dias = [];
  const hoje = new Date();

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);
    dias.push(data.toISOString().slice(0, 10));
  }

  return dias;
}

function gerarHorariosBase() {
  return [
    "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00"
  ];
}

async function buscarAgendaPublica(req, res) {
  try {
    const { slug, servicoId, profissionalId } = req.query;

    if (!slug || !servicoId || !profissionalId) {
      return res.status(400).json({
        erro: "Slug, serviço e profissional são obrigatórios."
      });
    }

    const negocioResult = await db.query(
      `
      SELECT id, nome, slug
      FROM negocios
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (negocioResult.rows.length === 0) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    const negocio = negocioResult.rows[0];

    const servicoResult = await db.query(
      `
      SELECT id, nome, valor, duracao_minutos
      FROM servicos_negocio
      WHERE id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [servicoId, negocio.id]
    );

    if (servicoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado nesse negócio." });
    }

    const profissionalResult = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        un.papel
      FROM usuarios_negocios un
      INNER JOIN usuarios u ON u.id = un.usuario_id
      WHERE un.usuario_id = $1
        AND un.negocio_id = $2
      LIMIT 1
      `,
      [profissionalId, negocio.id]
    );

    if (profissionalResult.rows.length === 0) {
      return res.status(404).json({ erro: "Profissional não pertence a esse negócio." });
    }

    const dias = gerarDiasProximos(7);
    const horariosBase = gerarHorariosBase();

    const agendamentosResult = await db.query(
  `
  SELECT
    TO_CHAR(data, 'YYYY-MM-DD') AS data,
    TO_CHAR(horario::time, 'HH24:MI') AS horario
  FROM agendamentos
  WHERE profissional_id = $1
    AND data BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
    AND status IN ('agendado', 'confirmado')
  `,
  [profissionalId]
);

    const bloqueiosResult = await db.query(
      `
      SELECT
        TO_CHAR(data_bloqueio, 'YYYY-MM-DD') AS data,
        TO_CHAR(hora_bloqueio, 'HH24:MI') AS horario
      FROM bloqueios_horarios
      WHERE profissional_id = $1
        AND data_bloqueio BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
      `,
      [profissionalId]
    );

    const ocupados = new Set(
      [...agendamentosResult.rows, ...bloqueiosResult.rows].map(
        (item) => `${item.data}_${item.horario}`
      )
    );

    const agora = new Date();
const hojeISO = agora.toISOString().slice(0, 10);

const horaAtual =
  String(agora.getHours()).padStart(2, "0") +
  ":" +
  String(agora.getMinutes()).padStart(2, "0");

const disponibilidade = dias.map((data) => {
  const horarios = horariosBase.filter((hora) => {
    const ocupado = ocupados.has(`${data}_${hora}`);

    const horarioPassado =
      data === hojeISO && hora <= horaAtual;

    return !ocupado && !horarioPassado;
  });

  return {
    data,
    horarios
  };
});

    return res.json({
      negocio,
      servico: servicoResult.rows[0],
      profissional: profissionalResult.rows[0],
      disponibilidade
    });

  } catch (err) {
    console.error("Erro ao buscar agenda pública:", err);
    return res.status(500).json({ erro: "Erro ao carregar agenda pública." });
  }
}

async function criarAgendamentoPublico(req, res) {
  try {
    let clienteId = req.user?.id || null;
const tipoUsuario = req.user?.tipo || null;

const {
  slug,
  servico_id,
  profissional_id,
  data,
  horario,
  cliente_nome,
  cliente_whatsapp
} = req.body;

if (clienteId && tipoUsuario !== "cliente") {
  return res.status(403).json({ erro: "Apenas clientes podem agendar." });
}

if (!clienteId) {
  if (!cliente_nome || !cliente_whatsapp) {
    return res.status(400).json({
      erro: "Informe nome e WhatsApp para agendar."
    });
  }

  const clienteExistente = await db.query(
    `
    SELECT id
    FROM usuarios
    WHERE tipo = 'cliente'
      AND whatsapp = $1
    LIMIT 1
    `,
    [cliente_whatsapp.trim()]
  );

  if (clienteExistente.rows.length > 0) {
    clienteId = clienteExistente.rows[0].id;
  } else {
    const novoCliente = await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        whatsapp,
        senha,
        tipo
      )
      VALUES ($1, $2, $3, $4, 'cliente')
      RETURNING id
      `,
      [
        cliente_nome.trim(),
        `cliente_${Date.now()}@agenda.local`,
        cliente_whatsapp.trim(),
        "",
      ]
    );

    clienteId = novoCliente.rows[0].id;
  }
}

    if (!slug || !servico_id || !profissional_id || !data || !horario) {
      return res.status(400).json({ erro: "Dados do agendamento incompletos." });
    }

    const negocioResult = await db.query(
      `
      SELECT id, nome, slug
      FROM negocios
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (negocioResult.rows.length === 0) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    const negocio = negocioResult.rows[0];

    const servicoResult = await db.query(
      `
      SELECT id
      FROM servicos_negocio
      WHERE id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [servico_id, negocio.id]
    );

    if (servicoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não pertence a esse negócio." });
    }

    const profissionalResult = await db.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [profissional_id, negocio.id]
    );

    if (profissionalResult.rows.length === 0) {
      return res.status(404).json({ erro: "Profissional não pertence a esse negócio." });
    }

    const existeBloqueio = await db.query(
      `
      SELECT id
      FROM bloqueios_horarios
      WHERE profissional_id = $1
        AND data_bloqueio = $2
        AND TO_CHAR(hora_bloqueio, 'HH24:MI') = $3
      LIMIT 1
      `,
      [profissional_id, data, horario]
    );

    if (existeBloqueio.rows.length > 0) {
      return res.status(400).json({ erro: "Esse horário está bloqueado." });
    }

    const existeAgendamento = await db.query(
      `
      SELECT id
      FROM agendamentos
      WHERE profissional_id = $1
        AND data = $2
        AND TO_CHAR(horario, 'HH24:MI') = $3
        AND status IN ('agendado', 'confirmado')
      LIMIT 1
      `,
      [profissional_id, data, horario]
    );

    if (existeAgendamento.rows.length > 0) {
      return res.status(400).json({ erro: "Esse horário já está reservado." });
    }

    const novoAgendamento = await db.query(
  `
  INSERT INTO agendamentos (
    usuarios_id,
    data,
    horario,
    profissional_id,
    cliente_id,
    servico_id,
    negocio_id,
    status,
    created_at
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,
    'agendado',
    NOW()
  )
  RETURNING *
  `,
  [
    clienteId,
    data,
    horario,
    profissional_id,
    clienteId,
    servico_id,
    negocio.id
  ]
);

const agendamentoCriado = novoAgendamento.rows[0];

await db.query(
  `
  INSERT INTO notificacoes (
    usuario_id,
    negocio_id,
    agendamento_id,
    titulo,
    mensagem
  )
  VALUES ($1, $2, $3, $4, $5)
  `,
  [
    profissional_id,
    negocio.id,
    agendamentoCriado.id,
    "Novo agendamento",
    `Você recebeu um novo agendamento para ${data} às ${horario}.`
  ]
);

    return res.status(201).json({
      mensagem: "Agendamento criado com sucesso.",
      agendamento: novoAgendamento.rows[0]
    });

  } catch (err) {
    console.error("Erro ao criar agendamento público:", err);
    return res.status(500).json({ erro: "Erro ao criar agendamento." });
  }
}

async function listarMeusAgendamentos(req, res) {
  try {
    const clienteId = req.user?.id;
    const tipoUsuario = req.user?.tipo;

    if (!clienteId) {
      return res.status(401).json({ erro: "Cliente não autenticado." });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({ erro: "Apenas clientes podem ver seus agendamentos." });
    }

    const result = await db.query(
      `
      SELECT
        a.id,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario, 'HH24:MI') AS horario,

        CASE
          WHEN a.status = 'cancelado' THEN 'cancelado'
          WHEN a.data < CURRENT_DATE THEN 'realizado'
          ELSE 'agendado'
        END AS status,

        a.avaliacao,

        n.nome AS negocio,
        n.slug,
        u.nome AS profissional,
        s.nome AS servico,
        s.valor

      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      LEFT JOIN negocios n ON n.id = s.negocio_id
      LEFT JOIN usuarios u ON u.id = a.profissional_id
      WHERE a.cliente_id = $1
      ORDER BY a.data DESC, a.horario DESC
      `,
      [clienteId]
    );

    return res.json({
      agendamentos: result.rows
    });

  } catch (err) {
    console.error("Erro ao listar meus agendamentos:", err);
    return res.status(500).json({ erro: "Erro ao carregar agendamentos." });
  }
}

async function cancelarMeuAgendamento(req, res) {
  try {
    const clienteId = req.user?.id;
    const tipoUsuario = req.user?.tipo;
    const { id } = req.params;

    if (!clienteId) {
      return res.status(401).json({ erro: "Cliente não autenticado." });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({ erro: "Apenas clientes podem cancelar agendamentos." });
    }

    const agendamentoResult = await db.query(
      `
      SELECT id, data, status
      FROM agendamentos
      WHERE id = $1
        AND cliente_id = $2
      LIMIT 1
      `,
      [id, clienteId]
    );

    if (agendamentoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Agendamento não encontrado." });
    }

    const agendamento = agendamentoResult.rows[0];

    if (agendamento.status === "cancelado") {
      return res.status(400).json({ erro: "Esse agendamento já está cancelado." });
    }

    const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataAgendamento < hoje) {
      return res.status(400).json({ erro: "Não é possível cancelar um agendamento já realizado." });
    }

    await db.query(
      `
      UPDATE agendamentos
      SET status = 'cancelado'
      WHERE id = $1
        AND cliente_id = $2
      `,
      [id, clienteId]
    );

    return res.json({
      mensagem: "Agendamento cancelado com sucesso."
    });

  } catch (err) {
    console.error("Erro ao cancelar agendamento:", err);
    return res.status(500).json({ erro: "Erro ao cancelar agendamento." });
  }
}

async function avaliarAgendamento(req, res) {
  try {
    const clienteId = req.user?.id;
    const tipoUsuario = req.user?.tipo;
    const { id } = req.params;
    const { avaliacao } = req.body;

    const nota = Number(avaliacao);

    if (!clienteId) {
      return res.status(401).json({ erro: "Cliente não autenticado." });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({ erro: "Apenas clientes podem avaliar agendamentos." });
    }

    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({ erro: "A avaliação deve ser de 1 a 5 estrelas." });
    }

    const agendamentoResult = await db.query(
      `
      SELECT id, data, status, avaliacao
      FROM agendamentos
      WHERE id = $1
        AND cliente_id = $2
      LIMIT 1
      `,
      [id, clienteId]
    );

    if (agendamentoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Agendamento não encontrado." });
    }

    const agendamento = agendamentoResult.rows[0];

    if (agendamento.status === "cancelado") {
      return res.status(400).json({ erro: "Agendamento cancelado não pode ser avaliado." });
    }

    const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataAgendamento >= hoje) {
      return res.status(400).json({ erro: "Só é possível avaliar serviços já realizados." });
    }

    if (agendamento.avaliacao) {
      return res.status(400).json({ erro: "Esse agendamento já foi avaliado." });
    }

    await db.query(
      `
      UPDATE agendamentos
      SET avaliacao = $1
      WHERE id = $2
        AND cliente_id = $3
      `,
      [nota, id, clienteId]
    );

    return res.json({
      mensagem: "Avaliação salva com sucesso.",
      avaliacao: nota
    });

  } catch (err) {
    console.error("Erro ao avaliar agendamento:", err);
    return res.status(500).json({ erro: "Erro ao avaliar agendamento." });
  }
}

module.exports = {
  buscarAgendaPublica,
  criarAgendamentoPublico,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento
};