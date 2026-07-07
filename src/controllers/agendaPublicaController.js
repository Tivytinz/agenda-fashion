const db = require("../db/db");

const { verificarCapacidadePlano } = require("../services/planoService");
const agendaPublicaService = require("../services/agendaPublicaService");

function gerarDiasProximos(qtd = 7) {
  const dias = [];
  const hoje = new Date();

  hoje.setHours(hoje.getHours() - 3);
  hoje.setHours(12, 0, 0, 0);

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    dias.push(`${ano}-${mes}-${dia}`);
  }

  return dias;
}

function obterDataHoraBrasil() {
  const agora = new Date();

  agora.setHours(agora.getHours() - 3);

  const data =
    `${agora.getFullYear()}-` +
    `${String(agora.getMonth() + 1).padStart(2, "0")}-` +
    `${String(agora.getDate()).padStart(2, "0")}`;

  const hora =
    `${String(agora.getHours()).padStart(2, "0")}:` +
    `${String(agora.getMinutes()).padStart(2, "0")}`;

  return {
    data,
    hora
  };
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

    const { negocio, servico, profissional } =
      await agendaPublicaService.buscarDadosBaseAgenda({
        slug,
        servicoId,
        profissionalId
  });

    const disponibilidade =
    await agendaPublicaService.buscarDisponibilidade({
    profissionalId: profissional.id,
  });

    return res.json({
      negocio,
      servico,
      profissional,
      disponibilidade
    });

  } catch (err) {
    console.error("Erro ao buscar agenda pública:", err);
    return res.status(500).json({
      erro: "Erro ao carregar agenda pública."
    });
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
      return res.status(403).json({
        erro: "Apenas clientes podem agendar."
      });
    }

    if (!slug || !servico_id || !profissional_id || !data || !horario) {
      return res.status(400).json({
        erro: "Dados do agendamento incompletos."
      });
    }

    clienteId = await agendaPublicaService.obterOuCriarCliente({
    clienteId,
    clienteNome: cliente_nome,
    clienteWhatsapp: cliente_whatsapp,
});

    const { negocio, servico, profissional } =
  await agendaPublicaService.buscarDadosBaseAgenda({
    slug,
    servicoId: servico_id,
    profissionalId: profissional_id,
  });

  await agendaPublicaService.validarHorarioDisponivel({
  profissionalId: profissional.id,
  data,
  horario,
});

    try {
      await verificarCapacidadePlano(negocio.id);
    } catch (e) {
      if (e.codigo === "LIMITE_PLANO") {
        return res.status(403).json({
          erro: "Este negócio atingiu a capacidade de agendamentos do plano atual.",
          codigo: "LIMITE_PLANO",
          titulo: "🎉 Agenda lotada!",
          mensagem:
            "O limite significa sucesso. Faça upgrade para continuar recebendo novos agendamentos.",
          plano: e.uso
        });
      }

      throw e;
    }

    const agendamento = await agendaPublicaService.criarAgendamento({
      data,
      horario,
      profissionalId: profissional.id,
      clienteId,
      servicoId: servico_id,
      negocioId: negocio.id,
    });

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
        profissional.id,
        negocio.id,
        agendamento.id,
        "Novo agendamento",
        `Novo agendamento: ${servico.nome} em ${data} às ${horario}.`
      ]
    );

    return res.status(201).json({
      mensagem: "Agendamento criado com sucesso.",
      agendamento
    });

  } catch (err) {
    console.error("Erro ao criar agendamento público:", err);
    return res.status(500).json({
      erro: "Erro ao criar agendamento."
    });
  }
}

async function listarMeusAgendamentos(req, res) {
  try {
    const clienteId = req.user?.id;
    const tipoUsuario = req.user?.tipo;

    if (!clienteId) {
      return res.status(401).json({
        erro: "Cliente não autenticado."
      });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({
        erro: "Apenas clientes podem ver seus agendamentos."
      });
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
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      LEFT JOIN negocios n
        ON n.id = s.negocio_id
      LEFT JOIN usuarios u
        ON u.id = a.profissional_id
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
    return res.status(500).json({
      erro: "Erro ao carregar agendamentos."
    });
  }
}

async function cancelarMeuAgendamento(req, res) {
  try {
    const clienteId = req.user?.id;
    const tipoUsuario = req.user?.tipo;
    const { id } = req.params;

    if (!clienteId) {
      return res.status(401).json({
        erro: "Cliente não autenticado."
      });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({
        erro: "Apenas clientes podem cancelar agendamentos."
      });
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
      return res.status(404).json({
        erro: "Agendamento não encontrado."
      });
    }

    const agendamento = agendamento

    if (agendamento.status === "cancelado") {
      return res.status(400).json({
        erro: "Esse agendamento já está cancelado."
      });
    }

    const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
    const hoje = new Date();

    hoje.setHours(hoje.getHours() - 3);
    hoje.setHours(0, 0, 0, 0);

    if (dataAgendamento < hoje) {
      return res.status(400).json({
        erro: "Não é possível cancelar um agendamento já realizado."
      });
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
    return res.status(500).json({
      erro: "Erro ao cancelar agendamento."
    });
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
      return res.status(401).json({
        erro: "Cliente não autenticado."
      });
    }

    if (tipoUsuario !== "cliente") {
      return res.status(403).json({
        erro: "Apenas clientes podem avaliar agendamentos."
      });
    }

    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({
        erro: "A avaliação deve ser de 1 a 5 estrelas."
      });
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
      return res.status(404).json({
        erro: "Agendamento não encontrado."
      });
    }

    const agendamento = agendamentoResult.rows[0];

    if (agendamento.status === "cancelado") {
      return res.status(400).json({
        erro: "Agendamento cancelado não pode ser avaliado."
      });
    }

    const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
    const hoje = new Date();

    hoje.setHours(hoje.getHours() - 3);
    hoje.setHours(0, 0, 0, 0);

    if (dataAgendamento >= hoje) {
      return res.status(400).json({
        erro: "Só é possível avaliar serviços já realizados."
      });
    }

    if (agendamento.avaliacao) {
      return res.status(400).json({
        erro: "Esse agendamento já foi avaliado."
      });
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
    return res.status(500).json({
      erro: "Erro ao avaliar agendamento."
    });
  }
}

module.exports = {
  buscarAgendaPublica,
  criarAgendamentoPublico,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento
};