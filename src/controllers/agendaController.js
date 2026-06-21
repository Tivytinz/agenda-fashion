const db = require("../db");

// =============================
// 🌍 BUSCAR AGENDA PÚBLICA
// =============================
async function buscarAgendaProfissional(req, res) {
  try {
    const { slugNegocio, slugProfissional } = req.params;

    if (!slugNegocio || !slugProfissional) {
      return res.status(400).json({
        erro: "Dados da agenda inválidos."
      });
    }

    const profissionalResult = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        n.id AS negocio_id,
        n.nome AS negocio_nome
      FROM usuarios u

      INNER JOIN usuarios_negocios un
        ON un.usuario_id = u.id

      INNER JOIN negocios n
        ON n.id = un.negocio_id

      WHERE n.slug = $1
        AND u.slug = $2

      LIMIT 1
      `,
      [slugNegocio, slugProfissional]
    );

    if (profissionalResult.rows.length === 0) {
      return res.status(404).json({
        erro: "Profissional não encontrado."
      });
    }

    const profissional = profissionalResult.rows[0];

    const agenda = [];

    for (let i = 0; i < 6; i++) {

      const dataObj = new Date();

      dataObj.setDate(dataObj.getDate() + i);

      const data = dataObj.toISOString().slice(0, 10);

      const horarios = [];

      for (let hora = 8; hora <= 18; hora++) {

        const horaFormatada = `${String(hora).padStart(2, "0")}:00`;

        // 🔒 BLOQUEADO
        const bloqueado = await db.query(
          `
          SELECT id
          FROM bloqueios_horario
          WHERE profissional_id = $1
            AND data = $2
            AND hora = $3
          `,
          [profissional.id, data, horaFormatada]
        );

        // 📅 AGENDAMENTO
        const agendamento = await db.query(
          `
          SELECT
            a.id
          FROM agendamentos a
          WHERE a.profissional_id = $1
            AND a.data = $2
            AND a.horario = $3
            AND a.status != 'cancelado'
          `,
          [profissional.id, data, horaFormatada]
        );

        let status = "livre";

        if (bloqueado.rows.length) {
          status = "bloqueado";
        }

        if (agendamento.rows.length) {
          status = "agendado";
        }

        horarios.push({
          hora: horaFormatada,
          status
        });
      }

      agenda.push({
        data,
        horarios
      });
    }

    return res.json({
      profissional,
      agenda
    });

  } catch (err) {
    console.error("Erro ao buscar agenda:", err);

    return res.status(500).json({
      erro: "Erro ao carregar agenda."
    });
  }
}

// =============================
// 👨‍🔧 AGENDA PROFISSIONAL
// =============================
async function listarAgendamentosFuncionario(req, res) {
  try {
    const profissionalId = req.user.id;

    const agenda = [];

    for (let i = 0; i < 6; i++) {

      const dataObj = new Date();

      dataObj.setDate(dataObj.getDate() + i);

      const data = dataObj.toISOString().slice(0, 10);

      const horarios = [];

      for (let hora = 8; hora <= 18; hora++) {

        const horaFormatada = `${String(hora).padStart(2, "0")}:00`;

        // 🔒 BLOQUEIO
        const bloqueado = await db.query(
          `
          SELECT id
          FROM bloqueios_horario
          WHERE profissional_id = $1
            AND data = $2
            AND hora = $3
          `,
          [profissionalId, data, horaFormatada]
        );

        // 📅 AGENDAMENTO
        const agendamento = await db.query(
          `
          SELECT
            a.id,
            a.status,
            c.nome AS cliente,
            s.nome AS servico,
            s.valor
          FROM agendamentos a

          LEFT JOIN usuarios c
            ON c.id = a.cliente_id

          LEFT JOIN servicos_negocio s
            ON s.id = a.servico_id

          WHERE a.profissional_id = $1
            AND a.data = $2
            AND a.horario = $3
            AND a.status != 'cancelado'

          LIMIT 1
          `,
          [profissionalId, data, horaFormatada]
        );

        let status = "livre";

        if (bloqueado.rows.length) {
          status = "bloqueado";
        }

        if (agendamento.rows.length) {
          status = "agendado";
        }

        horarios.push({
          data,
          hora: horaFormatada,
          status,

          cliente: agendamento.rows[0]?.cliente || null,
          servico: agendamento.rows[0]?.servico || null,
          valor: agendamento.rows[0]?.valor || null
        });
      }

      agenda.push({
        data,
        horarios
      });
    }

    return res.json({
      agenda
    });

  } catch (err) {
    console.error("Erro agenda profissional:", err);

    return res.status(500).json({
      erro: "Erro ao carregar agenda."
    });
  }
}

// =============================
// 🔒 BLOQUEAR / DESBLOQUEAR
// =============================
const alternarBloqueioHorario = async (req, res) => {
  try {
    const usuarioId = req.user?.id;
    const { data, hora, profissional_id } = req.body;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    if (!data || !hora) {
      return res.status(400).json({
        erro: "Data e hora obrigatórios."
      });
    }

    let profissionalId = usuarioId;

    if (profissional_id) {
      const donoResult = await db.query(
        `
        SELECT un.negocio_id
        FROM usuarios_negocios un
        WHERE un.usuario_id = $1
          AND un.papel = 'dono'
        LIMIT 1
        `,
        [usuarioId]
      );

      if (donoResult.rows.length === 0) {
        return res.status(403).json({
          erro: "Apenas o dono pode bloquear horários de outros profissionais."
        });
      }

      const negocioId = donoResult.rows[0].negocio_id;

      const profissionalPertence = await db.query(
        `
        SELECT id
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND negocio_id = $2
        LIMIT 1
        `,
        [profissional_id, negocioId]
      );

      if (profissionalPertence.rows.length === 0) {
        return res.status(403).json({
          erro: "Este profissional não pertence ao seu negócio."
        });
      }

      profissionalId = profissional_id;
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
      [profissionalId, data, hora]
    );

    if (existeAgendamento.rows.length > 0) {
      return res.status(400).json({
        erro: "Horário já está agendado."
      });
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
      [profissionalId, data, hora]
    );

    if (existeBloqueio.rows.length > 0) {
      await db.query(
        `
        DELETE FROM bloqueios_horarios
        WHERE id = $1
        `,
        [existeBloqueio.rows[0].id]
      );

      return res.json({
        sucesso: true,
        status: "livre",
        mensagem: "Horário liberado com sucesso."
      });
    }

    await db.query(
      `
      INSERT INTO bloqueios_horarios (
        profissional_id,
        data_bloqueio,
        hora_bloqueio
      )
      VALUES ($1, $2, $3)
      `,
      [profissionalId, data, hora]
    );

    return res.json({
      sucesso: true,
      status: "bloqueado",
      mensagem: "Horário bloqueado com sucesso."
    });

  } catch (erro) {
    console.error("Erro ao alternar bloqueio:", erro);

    return res.status(500).json({
      erro: "Erro ao alternar bloqueio."
    });
  }
};

async function buscarAgendaGeral(req, res) {

  try {

    const usuarioId = req.user.id;

    const negocioResult = await db.query(
      `
      SELECT
        n.id
      FROM negocios n
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = n.id
      WHERE un.usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    const negocio = negocioResult.rows[0];

    if (!negocio) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const profissionaisResult = await db.query(
      `
      SELECT
        u.id,
        u.nome
      FROM usuarios u
      INNER JOIN usuarios_negocios un
        ON un.usuario_id = u.id
      WHERE un.negocio_id = $1
      `,
      [negocio.id]
    );

    const hoje = new Date();

    const agenda = [];

    for (let i = 0; i < 7; i++) {

      const dataObj = new Date();
      dataObj.setDate(hoje.getDate() + i);

      const data = dataObj.toISOString().slice(0, 10);

      const profissionais = [];

      for (const profissional of profissionaisResult.rows) {

        const horarios = [];

        for (let h = 8; h <= 18; h++) {

          horarios.push({
            hora: `${String(h).padStart(2, "0")}:00`,
            status: "livre"
          });

        }

        profissionais.push({
          id: profissional.id,
          nome: profissional.nome,
          horarios
        });

      }

      agenda.push({
        data,
        profissionais
      });

    }

    return res.json({
      agenda
    });

  } catch (err) {

    console.error(
      "Erro agenda geral:",
      err
    );

    return res.status(500).json({
      erro: "Erro ao carregar agenda geral."
    });
  }
}

async function buscarNotificacoesAgenda(req, res) {
  try {
    const usuarioId = req.user.id;

    const negocioResult = await db.query(
      `
      SELECT negocio_id, papel
      FROM usuarios_negocios
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (negocioResult.rows.length === 0) {
      return res.json({ total: 0 });
    }

    const vinculo = negocioResult.rows[0];

    let result;

    if (vinculo.papel === "dono") {
      result = await db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM agendamentos
        WHERE negocio_id = $1
          AND data >= CURRENT_DATE
          AND status IN ('agendado', 'confirmado')
        `,
        [vinculo.negocio_id]
      );
    } else {
      result = await db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM agendamentos
        WHERE profissional_id = $1
          AND data >= CURRENT_DATE
          AND status IN ('agendado', 'confirmado')
        `,
        [usuarioId]
      );
    }

    return res.json({
      total: result.rows[0].total
    });

  } catch (err) {
    console.error("Erro notificações agenda:", err);

    return res.status(500).json({
      erro: "Erro ao buscar notificações."
    });
  }
}

// =============================
module.exports = {
  buscarAgendaProfissional,
  listarAgendamentosFuncionario,
  alternarBloqueioHorario,
  buscarAgendaGeral,
  buscarNotificacoesAgenda
};