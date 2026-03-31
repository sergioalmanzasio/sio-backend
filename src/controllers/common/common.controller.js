import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { logger } from "../../utils/logger.js";

export const validateUserExist = async (username) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM users WHERE username = $1 LIMIT 1",
      [username],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error en la base de datos." });
        }

        if (result.rows.length > 0) {
          return resolve({
            process: "error",
            message: "Ya existe usuario con el correo electrónico " + username + ".",
          });
        }

        return resolve({ process: "success" });
      }
    );
  });
};

export const validatePersonExist = async (document, res) => {
  if (!document) {
    return res.status(400).json({ message: "Documento es obligatorio." });
  }
  await pool.query(
    "SELECT * FROM persons WHERE document = $1 LIMIT 1",
    [document],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar persona." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Persona no encontrada." });
      }
      return res.status(200).json({ message: "Persona encontrada." });
    }
  );
};

export const validatePersonExistByDocumentEmailPhone = (document, email, phone) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM persons WHERE document = $1 OR email = $2 OR phone = $3 LIMIT 1",
      [document, email, phone],
      (err, result) => {
        if (err) {
          logger.error("CommonController.validatePersonExistByDocumentEmailPhone - Error global:", {
            error: err,
          });
          return reject({ process: "error", message: "Error en la base de datos." });
        }

        if (result.rows.length > 0) {
          return resolve({
            process: "error",
            message: "El documento, correo o teléfono ya están registrados.",
          });
        }

        return resolve({ process: "success" });
      }
    );
  });
};


export const validateCodeAndExpiresAt = (email) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM signup_code WHERE email = $1 AND is_used = false AND expires_at > NOW()",
      [email],
      (err, result) => {
        if (err) {
          logger.error("CommonController.validateCodeAndExpiresAt - Error global:", {
            error: err,
          });
          return reject({ process: "error", message: "Error en la base de datos." });
        }

        if (result.rows.length > 0) {
          return resolve({
            process: "error",
            message: "Ya existe código de verificación para el correo electrónico digitado.",
          });
        }

        return resolve({ process: "success" });
      }
    );
  });
}

export const getRoleIdByClientName = async (res) => {
  await pool.query(
    "SELECT * FROM roles WHERE name = $1 LIMIT 1",
    ["client"],
    (err, result) => {
      if (err) {
        logger.error("CommonController.getRoleIdByClientName - Error global:", {
          error: err,
        });
        return res.status(500).json({ message: "Error al consultar rol." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Rol no encontrado." });
      }
      return res.status(200).json({
        message: "Rol encontrado.",
        id: result.rows[0].id
      });
    }
  );
}

export const getRoleIdByAssistantName = async (res) => {
  await pool.query(
    "SELECT * FROM roles WHERE name = $1 LIMIT 1",
    ["assistant"],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar rol." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Rol no encontrado." });
      }
      return res.status(200).json({
        message: "Rol encontrado.",
        id: result.rows[0].id
      });
    }
  );
}

export const getUserIdByToken = async (req) => {
  return new Promise((resolve, reject) => {
    try {
      const token = req.cookies.token;
      if (!token) {
        return resolve({
          process: "session-expired",
          message:
            "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
        });
      }
      let decodedUser;
      try {
        decodedUser = jwt.verify(token, authConfig.secret);
        return resolve({
          process: "success",
          message: "Usuario encontrado.",
          id: decodedUser.id
        });
      } catch (err) {
        return resolve({
          process: "session-expired",
          message:
            "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
        });
      }

    } catch (err) {
      return resolve({ process: "error", message: "Error al consultar usuario." });
    }
  });
}

export const getRoleIdByAdminName = async (res) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM roles WHERE name = $1 LIMIT 1",
      ["admplt"],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error al consultar rol." });
        }
        if (result.rows.length === 0) {
          return reject({ process: "error", message: "Rol no encontrado." });
        }
        return resolve({
          message: "Rol encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getUserIDByReferralSystemSIO = async (res) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM users WHERE username = $1 LIMIT 1",
      [process.env.EMAILS_SIO_REFERAL],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar usuario." });
        }
        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Usuario no encontrado." });
        }
        return resolve({
          message: "Usuario encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const validateIsAdminPlt = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT * FROM users usr 
       JOIN user_roles uro ON uro.user_id = usr.id 
       WHERE usr.id = $1 
       AND uro.role_id = (SELECT id FROM roles WHERE name = $2) 
       AND usr.is_active = TRUE`,
      [userId, "admplt"]
    );

    if (result.rows.length === 0) {
      return {
        process: "error",
        message: "Usuario no tiene permisos para realizar esta acción."
      };
    }

    return {
      process: "success",
      id: result.rows[0].id
    };

  } catch (err) {
    return {
      process: "error",
      message: "Error al consultar usuario."
    };
  }
};

export const userWithPermissions = (token) => {
  return new Promise((resolve, reject) => {
    if (!token) {
      return resolve({
        process: "session-expired",
        message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando."
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.secret);
    } catch (err) {
      return resolve({
        process: "session-expired",
        message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad."
      });
    }

    validateIsAdminPlt(decoded.id)
      .then((isAdmin) => {
        if (isAdmin.process === "error") {
          return resolve({
            process: "error",
            message: "Usuario con permisos insuficientes para realizar esta acción."
          });
        }

        return resolve({
          process: "success",
          message: "Usuario validado exitosamente.",
          id: decoded.id
        });
      })
      .catch((err) => {
        return resolve({
          process: "error",
          message: "Error al validar usuario."
        });
      });
  })
}

export const validateUserIsActive = (token) => {
  return new Promise((resolve, reject) => {
    if (!token) {
      return resolve({
        process: "session-expired",
        message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando."
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.secret);
    } catch (err) {
      return resolve({
        process: "session-expired",
        message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad."
      });
    }

    pool.query(
      "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
      [decoded.id],
      (err, result) => {
        if (err) {
          return resolve({
            process: "error",
            message: "Error al consultar usuario."
          });
        }

        if (result.rows.length === 0) {
          return resolve({
            process: "error",
            message: "Usuario no encontrado."
          });
        }

        return resolve({
          process: "success",
          message: "Usuario validado exitosamente.",
          id: decoded.id
        });
      }
    );
  })
}

export const validateUserIsActiveByID = (userId) => {
  return new Promise((resolve, reject) => {
    if (!userId) {
      return resolve({
        process: "info",
        message: "Usuario no encontrado."
      });
    }

    pool.query(
      "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
      [userId],
      (err, result) => {
        if (err) {
          return resolve({
            process: "info",
            message: "Error al consultar usuario."
          });
        }

        if (result.rows.length === 0) {
          return resolve({
            process: "info",
            message: "Usuario no encontrado."
          });
        }

        return resolve({
          process: "success",
          message: "Usuario validado exitosamente.",
        });
      }
    );
  })
}

export const getTokenByReq = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token || token === "null" || token === "undefined" || token.trim() === "") {
    return {
      process: "session-expired",
      message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad (CC-010)."
    };
  }
  return {
    process: "success",
    token: token
  };
}

export const getAuthInfo = (req, infoLabel) => {

  if (infoLabel === 'userid') {
    const user = req.user;
    return user.id;
  }

  if (infoLabel === 'token') {
    return req.token;
  }
}

export const getRoleIdByName = (roleName) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM roles WHERE name = $1 LIMIT 1",
      [roleName],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error al consultar rol." });
        }

        if (result.rows.length === 0) {
          return reject({ process: "error", message: "Rol no encontrado." });
        }
        return resolve({
          message: "Rol encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getDocumentTypeIdByAcronym = (acronym) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM document_types WHERE acronym = $1 LIMIT 1",
      [acronym],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar tipo de documento." });
        }

        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Tipo de documento no encontrado." });
        }
        return resolve({
          message: "Tipo de documento encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getPersonIdByDocument = (document) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM persons WHERE document = $1 LIMIT 1",
      [document],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error al consultar persona." });
        }

        if (result.rows.length === 0) {
          return reject({ process: "error", message: "Persona no encontrada." });
        }
        return resolve({
          message: "Persona encontrada.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getUserIdByEmail = (email) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM users WHERE username = $1 LIMIT 1",
      [email],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar usuario." });
        }

        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Usuario no encontrado." });
        }
        return resolve({
          message: "Usuario encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getServiceRequestStateIDByName = (name) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM service_request_states WHERE description = $1",
      [name],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar estado de solicitud de servicio." });
        }

        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Estado de solicitud de servicio no encontrado." });
        }
        return resolve({
          message: "Estado de solicitud de servicio encontrado.",
          id: result.rows[0].id,
          description: result.rows[0].description
        });
      }
    );
  });
}

export const createPersonLocation = (person_id, department, city, neighborhood, address, type_of_housing, created_by) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO person_locations (person_id, country, department, city, neighborhood, address, type_of_housing, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [
        person_id,
        '00|Colombia',
        department,
        city,
        neighborhood,
        address,
        type_of_housing,
        created_by,
      ],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error al crear ubicación de persona." });
        }
        return resolve({
          process: "success",
          message: "Ubicación de persona creada exitosamente.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const createUserAccount = (user_id, bank_name, account_number, created_by) => {
  return new Promise((resolve, reject) => {
    getBankIdByName(bank_name).then((bank) => {
      pool.query(
        "INSERT INTO user_accounts (user_id, bank_id, account_number, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
        [
          user_id,
          bank.id,
          account_number,
          created_by,
        ],
        (err, result) => {
          if (err) {
            return resolve({ process: "error", message: "Error al crear cuenta de usuario." });
          }
          return resolve({
            process: "success",
            message: "Cuenta de usuario creada exitosamente.",
            id: result.rows[0].id
          });
        }
      );
    });
  });
}

export const getBankIdByName = (name) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM banks WHERE name = $1 LIMIT 1",
      [name],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error al consultar banco." });
        }

        if (result.rows.length === 0) {
          return reject({ process: "error", message: "Banco no encontrado." });
        }
        return resolve({
          message: "Banco encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getUserDataBankByUserId = (user_id) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT ban."name", uac.account_number 
        FROM user_accounts uac
        JOIN banks ban ON uac.bank_id = ban.id
        WHERE user_id = $1
        AND uac.is_active = TRUE`,
      [user_id],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar cuenta de usuario." });
        }

        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Cuenta de usuario no encontrada." });
        }
        return resolve({
          message: "Cuenta de usuario encontrada.",
          data: result.rows[0]
        });
      }
    );
  });
}

export const getDocumentTypeByName = (name) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM document_types WHERE name = $1 LIMIT 1",
      [name],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar tipo de documento." });
        }

        if (result.rows.length === 0) {
          return resolve({ process: "error", message: "Tipo de documento no encontrado." });
        }
        return resolve({
          message: "Tipo de documento encontrado.",
          id: result.rows[0].id
        });
      }
    );
  });
}

export const getPersonIdInUsersByEmail = (email) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM users WHERE username = $1 LIMIT 1",
      [email],
      (err, result) => {
        if (err) {
          return resolve({
            process: "error",
            message: "Error al consultar el usuario con el correo electrónico."
          });
        }

        if (result.rows.length === 0) {
          return resolve({
            process: "error",
            message: "Usuario no encontrado con el correo electrónico."
          });
        }
        return resolve({
          message: "Usuario encontrado con el correo electrónico, se obtuvo el ID de la persona.",
          id: result.rows[0].person_id
        });
      }
    );
  });
}

export const isPersonHasUserByDocument = (document_number) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM persons 
                WHERE document = $1
            ) THEN 'SI'
            ELSE 'NO'
        END AS exists_in_person,

        CASE 
            WHEN EXISTS (
                SELECT 1
                FROM persons prs
                JOIN users usr 
                    ON usr.person_id = prs.id
                JOIN user_roles ur 
                    ON ur.user_id = usr.id
                WHERE prs.document = $1
                  AND usr.is_active = TRUE
                  AND ur.role_id = (SELECT id FROM roles WHERE NAME = 'referral')
            ) THEN 'SI'
            ELSE 'NO'
        END AS exists_in_user_with_rol_referral`,
      [document_number],
      (err, result) => {
        if (err) {
          return resolve({ process: "error", message: "Error al consultar persona." });
        }

        if (result.rows.length === 0) {
          return resolve({
            process: false,
            exists_in_person: 'NO',
            exists_in_user: 'NO',
            message: "Persona no encontrada."
          });
        }
        return resolve({
          process: true,
          message: "Persona encontrada.",
          exists_in_person: result.rows[0].exists_in_person,
          exists_in_user: result.rows[0].exists_in_user_with_rol_referral,
        });
      }
    );
  });
}







