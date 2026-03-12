import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { getDocumentTypeIdByAcronym, getPersonIdByDocument, getUserIdByEmail, getUserDataBankByUserId, getDocumentTypeByName, getBankIdByName, getPersonIdInUsersByEmail, getUserIDByReferralSystemSIO } from "../common/common.controller.js";
import { transversalUUID } from "../../utils/shared.js";

// PC-AC-001
export const createPersonByReferral = async (req, res) => {
  const { document, document_type_acronym, name, middle_name, last_name, email, phone,
    department, city, neighborhood, address, type_of_housing,
    observations, referral_email } = req.body;

  if (!document || !document_type_acronym || !name || !last_name || !email || !phone || !department || !city || !neighborhood || !address || !type_of_housing || !observations || !referral_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const documentType = await getDocumentTypeIdByAcronym(document_type_acronym);
  if (documentType.process === "error") {
    // TD-001: Error con obtención de ID de Tipo documento
    return res.status(400).json({
      process: "error",
      message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde. (TD-001)"
    });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    // US-001: Error con obtención de ID de Usuario
    return res.status(400).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde. (US-001)" });
  }

  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [
      document,
      documentType.id,
      name,
      middle_name,
      last_name,
      email,
      phone,
      userExist.id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
      }
      pool.query(
        "INSERT INTO person_locations (person_id, country, department, city, neighborhood, address, type_of_housing, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          result.rows[0].id,
          '00|Colombia',
          department,
          city,
          neighborhood,
          address,
          type_of_housing,
          userExist.id,
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
          }
          return res.status(200).json({
            process: "success",
            message: "Cliente creado exitosamente."
          });
        }
      );
    }
  );
}

// PC-AC-002
export const createPerson = async (req, res) => {
  const { document, document_type_acronym, name, middle_name, last_name, email, phone,
    department, city, neighborhood, address, type_of_housing,
    observations } = req.body;

  if (!document || !document_type_acronym || !name || !last_name || !email || !phone || !department || !city || !neighborhood || !address || !type_of_housing || !observations) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const documentType = await getDocumentTypeIdByAcronym(document_type_acronym);
  if (documentType.process === "error") {
    // TD-001: Error con obtención de ID de Tipo documento
    return res.status(400).json({
      process: "error",
      message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde. (PC-AC-002)"
    });
  }

  const userID = transversalUUID();
  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [document, documentType.id, name, middle_name, last_name, email, phone, userID],
    (err, resultAddPerson) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
      }
      pool.query(
        "INSERT INTO person_locations (person_id, country, department, city, neighborhood, address, type_of_housing, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [resultAddPerson.rows[0].id, '00|Colombia', department, city, neighborhood, address, type_of_housing, userID],
        async (err, resultAddPersonLocation) => {
          if (err) {
            return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
          }

          const userIDByReferralSystemSIO = await getUserIDByReferralSystemSIO();
          if (userIDByReferralSystemSIO.process === "error") {
            console.log(`
              Action: (PC-AC-002) createPerson \n
              Process: Auto registro de cliente \n
              Error: Obtención de ID de Usuario \n 
              ** Datos para validar ** \n 
              Documento de cliente: ${document} \n
              ID de canaldirecto user: 'Obtener en BD' \n 
            `);
          }

          pool.query(
            `INSERT INTO referred_clients (user_id, person_id, code, created_by, updated_by) VALUES ($1, $2, SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), $3, $4) RETURNING *`,
            [userIDByReferralSystemSIO.id, resultAddPerson.rows[0].id, userIDByReferralSystemSIO.id, userIDByReferralSystemSIO.id],
            (err, resultAddReferredClient) => {
              if (err) {
                // RC-001: Error al crear cliente referido
                console.log(`
                  Action: (PC-AC-002) createPerson \n
                  Process: Auto registro de cliente \n
                  Error: Creación de relación cliente y referido del sistema SIO \n 
                  ** Datos para validar ** \n 
                  Documento de cliente: ${document} \n
                  ID de canaldirecto user: 'Obtener en BD' \n 
                `);
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
                  resultAddReferredClient.rows[0].id,
                  resultAddReferredClient.rows[0].code,
                  'b1345452-a506-473c-a6ec-eb9ae932e483',
                  userIDByReferralSystemSIO.id
                ],
                (err, resultAssignedReferral) => {
                  if (err) {
                    console.log(`
                      Action: (PC-AC-002) createPerson \n
                      Process: Auto registro de cliente \n
                      Error: Asignación a coordinador de servicios \n 
                      ** Datos para validar ** \n 
                      Documento de cliente: ${document} \n
                      ID de canaldirecto user: 'Obtener en BD' \n 
                    `);
                  }

                  return res.status(200).json({
                    process: "success",
                    message: "Su registro ha sido enviado exitosamente."
                  });

                }
              );

            }
          );



        }
      );
    }
  );
}

// PC-AC-003
export const validatePersonExistByDocument = async (req, res) => {
  const { document } = req.body;

  if (!document) {
    return res.status(400).json({ process: "document-required", message: "Documento es obligatorio." });
  }

  pool.query(
    "SELECT * FROM persons WHERE document = $1",
    [document],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Error al consultar persona." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ process: "person-not-found", message: "Persona no encontrada." });
      }
      return res.status(200).json({ process: "person-found", message: "Persona encontrada." });
    }
  );
};

// Get data person by email
// PC-AC-004
export const getPersonByEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ process: "email-required", message: "Correo es obligatorio." });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    pool.query(
      `SELECT prs."document" as document_number, prs.document_type_id, doc."name" document_type_name,
          prs."name" AS first_name, prs.middle_name AS middle_name, 
          split_part(prs.last_name, ' ', 1) AS last_name_1, split_part(prs.last_name, ' ', 2) AS last_name_2,
          prs.email, prs.phone, 
          rol."name" role_name 
          FROM persons prs
          JOIN document_types doc on prs.document_type_id = doc.id
          JOIN users us ON us.person_id = prs.id
          JOIN user_roles usr ON us.id = usr.user_id
          JOIN roles rol ON usr.role_id = rol.id
          WHERE prs.email = $1`,
      [email],
      async (err, result) => {
        if (err) {
          return res.status(500).json({ process: "error", message: "Error al consultar persona." });
        }
        if (result.rows.length === 0) {
          return res.status(401).json({ process: "person-not-found", message: "Persona no encontrada." });
        }

        const personID = await getPersonIdByDocument(result.rows[0].document_number);
        if (personID.process === "error") {
          console.log('Error al obtener ID de persona (PC-AC-003).', personID);
          // return res.status(500).json({ process: "error", message: "Error al crear ubicación de persona." });
        }

        let dataLocation = {};
        pool.query(
          `SELECT department, city, neighborhood, address, type_of_housing 
              FROM person_locations WHERE is_active = TRUE AND person_id = $1`,
          [personID.id],
          async (err, resultLocation) => {
            if (err) {
              return res.status(500).json({ process: "error", message: "Error al consultar persona." });
            }

            if (resultLocation.rows.length === 0) {
              console.log('No se encontro ubicación de la persona (PC-AC-003)');
              // return res.status(401).json({ process: "person-not-found", message: "Persona no encontrada." });
            } else {
              dataLocation = resultLocation.rows[0];
            }

            const userID = await getUserIdByEmail(email);
            if (userID.process === "error") {
              console.log('Error al obtener ID de usuario (PC-AC-003).', userID);
              // return res.status(500).json({ process: "error", message: "Error al crear ubicación de persona." });
            }

            // TODO: Get bank data, TABLE NO EXIST
            let dataBank = {};
            const userDataBank = await getUserDataBankByUserId(userID.id);
            if (userDataBank.process === "error") {
              console.log('Error al obtener datos bancarios (PC-AC-003).', userDataBank);
              // return res.status(500).json({ process: "error", message: "Error al crear ubicación de persona." });
            } else {
              dataBank = userDataBank.data;
            }

            return res.status(200).json({
              process: "success",
              message: "Persona encontrada.",
              data: {
                person_info: {
                  ...result.rows[0],
                },
                data_location: {
                  ...dataLocation,
                  is_data_location: Object.keys(dataLocation).length > 0,
                },
                data_bank: {
                  ...dataBank,
                  is_data_bank: Object.keys(dataBank).length > 0,
                }
              }
            });

          }
        );


      }
    );
  });
};

// Update only data person
// PC-AC-005
export const updatePersonalInfo = async (req, res) => {
  const { email, documentTypeName, documentNumber, name, middleName, lastName, phone } = req.body;

  if (!email || !documentTypeName || !documentNumber || !name || !lastName || !phone) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    const documentType = await getDocumentTypeByName(documentTypeName);
    if (documentType.process === "error") {
      console.log('Error al obtener tipo de documento (PC-AC-004).', documentType);
      // return res.status(500).json({ process: "error", message: "Error al obtener tipo de documento." });
    }

    const userID = await getUserIdByEmail(email);
    if (userID.process === "error") {
      console.log('Error al obtener ID de usuario (PC-AC-004).', userID);
      userID.id = transversalUUID();
      // return res.status(500).json({ process: "error", message: "Error al crear ubicación de persona." });
    }

    pool.query(
      `UPDATE persons SET document_type_id = $1, document = $2, name = $3, middle_name = $4, last_name = $5, phone = $6, updated_by = $7 WHERE email = $8`,
      [documentType.id, documentNumber, name, middleName, lastName, phone, userID.id, email],
      async (err, result) => {
        if (err) {
          return res.status(500).json({ process: "error", message: "Error al actualizar persona." });
        }
        return res.status(200).json({ process: "success", message: "Persona actualizada exitosamente." });
      }
    );
  });
};

// Update only data bank person
// PC-AC-006
export const updateBankInfo = async (req, res) => {
  const { email, bankName, accountNumber } = req.body;

  if (!email || !bankName || !accountNumber) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    const userID = await getUserIdByEmail(email);
    if (userID.process === "error") {
      console.log('Error al obtener ID de usuario por email (PC-AC-005).', userID);
      return res.status(500).json({ process: "error", message: "No fue posible actualizar los datos bancarios, intente nuevamente." });
    }

    const bankAccount = await getBankIdByName(bankName);
    if (bankAccount.process === "error") {
      console.log('Error al obtener tipo de cuenta bancaria por nombre (PC-AC-005).', bankAccount);
      return res.status(500).json({ process: "error", message: "No fue posible actualizar los datos bancarios, intente nuevamente." });
    }

    pool.query(
      `UPDATE user_accounts SET bank_id = $1, account_number = $2, updated_by = $3 WHERE user_id = $4`,
      [bankAccount.id, accountNumber, userID.id, userID.id],
      async (err, result) => {
        if (err) {
          return res.status(500).json({ process: "error", message: "Error al actualizar datos bancarios." });
        }
        return res.status(200).json({ process: "success", message: "Datos bancarios actualizados exitosamente." });
      }
    );
  });
};

// Update only data location person
// PC-AC-007
export const updateLocationInfo = async (req, res) => {
  const { email, department, city, neighborhood, address, type_of_housing } = req.body;

  if (!email || !department || !city || !neighborhood || !address || !type_of_housing) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    const userID = await getUserIdByEmail(email);
    if (userID.process === "error") {
      console.log('Error al obtener ID de usuario por email (PC-AC-006).', userID);
      return res.status(500).json({ process: "error", message: "No fue posible actualizar los datos de ubicación, intente nuevamente." });
    }

    const personID = await getPersonIdInUsersByEmail(email);
    if (personID.process === "error") {
      console.log('Error al obtener ID de persona por email (PC-AC-006).', personID);
      return res.status(500).json({ process: "error", message: "No fue posible actualizar los datos de ubicación, intente nuevamente." });
    }

    pool.query(
      `UPDATE person_locations SET department = $1, city = $2, neighborhood = $3, address = $4, type_of_housing = $5, updated_by = $6 WHERE person_id = $7`,
      [department, city, neighborhood, address, type_of_housing, userID.id, personID.id],
      async (err, result) => {
        if (err) {
          return res.status(500).json({ process: "error", message: "Error al actualizar datos de ubicación." });
        }
        return res.status(200).json({ process: "success", message: "Datos de ubicación actualizados exitosamente." });
      }
    );
  });
};


