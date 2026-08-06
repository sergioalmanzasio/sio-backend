
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

export const getUsersAndRoles = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const searchParam = `%${search}%`;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
        WITH data_cte AS (
          SELECT 
            INITCAP(CONCAT_WS(' ', pr.name, pr.middle_name, pr.last_name)) AS name,
            COALESCE(
              NULLIF(LOWER(TRIM(us.username)), 'null'), 
              'No aplica'
            ) AS username,
            CASE us.is_active
              WHEN true  THEN 'Activo(a)'
              WHEN false THEN 'Inactivo(a)'
              ELSE 'No aplica'
            END AS status,
            COALESCE(
              NULLIF(LOWER(TRIM(ro.description)), 'null'), 
              'cliente'
            ) AS role_assigned,
            CASE 
              WHEN us.created_at IS NULL THEN 'No aplica'
              ELSE (ARRAY['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'])[EXTRACT(MONTH FROM us.created_at)] 
                  || ' ' || TO_CHAR(us.created_at, 'DD "de" YYYY')
            END AS created_at,
            us.username AS raw_username
          FROM persons pr
          LEFT JOIN users us ON us.person_id = pr.id
          LEFT JOIN user_roles usr ON usr.user_id = us.id
          LEFT JOIN roles ro ON usr.role_id = ro.id
        )
        SELECT 
          name,
          username,
          status,
          role_assigned,
          created_at,
          COUNT(*) OVER() AS total_count
        FROM data_cte
        WHERE 
          (
            raw_username IS NULL 
            OR LOWER(TRIM(raw_username)) NOT IN ('adminuno@siocolombia.com', 'rootsys@siocolombia.com')
          )          
          AND (
            $1::text = '' 
            OR name ILIKE $1 
            OR username ILIKE $1 
            OR role_assigned ILIKE $1 
            OR status ILIKE $1
          )
        ORDER BY name
        LIMIT $2 OFFSET $3;
      `;
      const result = await client.query(query, [searchParam, limit, offset]);
      await client.query("COMMIT");

      const totalRecords = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      const totalPages = Math.ceil(totalRecords / limit);

      const data = result.rows.map(row => {
        const { total_count, ...rest } = row;
        return rest;
      });

      return res.status(200).json({
        process: "success",
        message: "Usuarios y roles obtenidos exitosamente.",
        pagination: {
          total_records: totalRecords,
          total_pages: totalPages,
          current_page: page,
          limit: limit
        },
        data: data
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error("UsersController.getUsersAndRoles - Error:", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener los usuarios y roles.",
    });
  }
}

export const updateUserStatus = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }
    const { username, is_active } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
        UPDATE users 
        SET is_active = $2, updated_at = NOW(), updated_by = $3
        WHERE username = $1;
      `;
      await client.query(query, [username, is_active, validateUserWithPermissions.id]);
      await client.query("COMMIT");
      return res.status(200).json({
        process: "success",
        message: "Usuario actualizado exitosamente.",
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("UsersController.updateUserStatus - Error:", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo actualizar el usuario.",
    });
  }
}