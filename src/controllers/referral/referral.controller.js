import pool from "../../config/db.config.js";
import { getPersonIdByDocument, getUserIdByEmail } from "../common/common.controller.js";

// RC : Referral Controller
// AC : Action Controller
// RC-AC-001
export const createReferredExistCustomer = async (req, res) => {
  const { referral_email, client_document } = req.body;

  if (!referral_email || !client_document) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const personExist = await getPersonIdByDocument(client_document);
  if (personExist.process === "error") {
    return res.status(400).json({ process: "error", message: "Asociación de cliente no pudo ser realizada, inténte más tarde." });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    return res.status(400).json({ process: "error", message: "Asociación de cliente no pudo ser realizada, inténte más tarde." });
  }


  // Validando que no exista la relación entre el usuario y la persona
  pool.query(
    "SELECT * FROM referred_clients WHERE user_id = $1 AND person_id = $2",
    [userExist.id, personExist.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Error al crear cliente referido, inténte más tarde." });
      }

      if (result.rows.length > 0) {
        return res.status(400).json({ process: "error", message: "El cliente ya esta referenciado a este usuario." });
      }
      pool.query(
        "INSERT INTO referred_clients (user_id, person_id, code, created_by, updated_by) VALUES ($1, $2, SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), $3, $4) RETURNING *",
        [userExist.id, personExist.id, userExist.id, userExist.id],
        (err, result) => {
          if (err) {
            // RC-001: Error al crear cliente referido
            return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo crear el cliente referido (RC-001)." });
          }


          pool.query(
            `INSERT INTO assigned_referrals (referred_client_id, referred_client_code, MKT_user_id, created_by) 
            VALUES (
              $1,
              $2,
              (  SELECT ur.user_id FROM user_roles ur WHERE ur.role_id = $3 ORDER BY RANDOM() LIMIT 1 ),
              $4
            )`,
            [
              result.rows[0].id,
              result.rows[0].code,
              'b1345452-a506-473c-a6ec-eb9ae932e483',
              userExist.id
            ],
            (err, result) => {
              if (err) {
                // AR-001: Error al crear cliente referido
                // return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo crear el cliente referido (AR-001)." });
                console.log('ERROR AR-001: No se pudo asociar el cliente referido con un Coordinador de servicios (MKT), RC-AC-001: ', err);
              }
              return res.status(200).json({ process: "success", message: "Cliente referido creado exitosamente." });
            }
          );
        }
      );
    }
  );


};

export const getReferredClients = async (req, res) => {
  const { referral_email } = req.body;

  if (!referral_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    // US-001: Error al obtener usuario por correo
    return res.status(400).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (US-001)." });
  }


  pool.query(
    `SELECT
        pr.name || ' ' || COALESCE(pr.middle_name, '') || ' ' || pr.last_name AS full_name,
        rc.code,
        TO_CHAR(rc.created_at, 'TMMon DD "de" YYYY') AS created_at_formatted,
        rc.is_active,
        pr.phone,
        pr.email,

        -- Localización (pueden venir NULL)
        COALESCE(prl.department, 'No definido') AS department,
        COALESCE(prl.city, 'No definido') AS city,
        COALESCE(prl.neighborhood, 'No definido') AS neighborhood,
        COALESCE(prl.address, 'Sin dirección') AS address

      FROM referred_clients rc
      INNER JOIN persons pr
          ON rc.person_id = pr.id
      LEFT JOIN person_locations prl
          ON pr.id = prl.person_id
      WHERE rc.user_id = $1`,
    [userExist.id],
    (err, result) => {
      if (err) {
        // RC-001: Error al obtener clientes referidos
        return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (RC-001)." });
      }
      return res.status(200).json({
        process: "success",
        message: "Clientes referidos obtenidos exitosamente.",
        count: result.rows.length,
        data: result.rows
      });
    }
  );
};

// getReferredClientsByEmailToMKT in table assigned_referrals
// Coordinator Services = MKT
export const getReferredClientsByToCoordinatorServices = async (req, res) => {
  const { mkt_email } = req.body;

  if (!mkt_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const userExist = await getUserIdByEmail(mkt_email);
  if (userExist.process === "error") {
    // US-001: Error al obtener usuario por correo
    return res.status(400).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (US-001)." });
  }

  pool.query(
    `SELECT
        pr.name || ' ' || COALESCE(pr.middle_name, '') || ' ' || pr.last_name AS full_name,
        rc.code,
        TO_CHAR(rc.created_at, 'TMMon DD "de" YYYY') AS created_at_formatted,
        rc.is_active,
        pr.phone,
        pr.email,

        -- Localización (pueden venir NULL)
        COALESCE(prl.department, 'No definido') AS department,
        COALESCE(prl.city, 'No definido') AS city,
        COALESCE(prl.neighborhood, 'No definido') AS neighborhood,
        COALESCE(prl.address, 'Sin dirección') AS address
        (
        	SELECT prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name
        	FROM users us 
        	INNER JOIN persons prs
        	ON us.person_id = prs.id
        	WHERE us.id = rc.user_id
        ) as referal_name

      FROM assigned_referrals ar
      INNER JOIN referred_clients rc
          ON ar.referred_client_id = rc.id
      INNER JOIN persons pr
          ON rc.person_id = pr.id
      LEFT JOIN person_locations prl
          ON pr.id = prl.person_id
      WHERE ar.MKT_user_id = $1`,
    [userExist.id],
    (err, result) => {
      if (err) {
        // RC-001: Error al obtener clientes referidos
        return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes (RC-001)." });
      }
      return res.status(200).json({
        process: "success",
        message: "Clientes obtenidos exitosamente.",
        count: result.rows.length,
        data: result.rows
      });
    }
  );
};