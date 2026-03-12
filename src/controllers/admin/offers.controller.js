import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";

export const addBenefitsToOffer = async (offer_id, benefit_ids, userId) => {
  try {
    if (!offer_id || !benefit_ids) {
      return { process: "error", message: "Faltan parámetros." };
    }

    for (const benefit_id of benefit_ids) {
      // Check if it already exists
      const exists = await pool.query("SELECT id, is_active FROM offers_benefits WHERE offer_id = $1 AND benefit_id = $2", [offer_id, benefit_id]);
      if (exists.rows.length === 0) {
        await pool.query(
          "INSERT INTO offers_benefits (offer_id, benefit_id, created_by) VALUES ($1, $2, $3)",
          [offer_id, benefit_id, userId]
        );
      } else if (!exists.rows[0].is_active) {
        await pool.query("UPDATE offers_benefits SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2", [userId, exists.rows[0].id]);
      }
    }
    return { process: "success", message: "Beneficios agregados exitosamente." };
  } catch (error) {
    console.error("Error adding benefits:", error);
    throw error;
  }
};

export const createOffer = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);

  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  const { name, description, price, is_range, date_start, date_end, operator_name, category_name, benefits } = req.body;

  try {
    const operatorResult = await pool.query("SELECT id FROM operators WHERE name = $1 AND is_active = true", [operator_name]);
    if (operatorResult.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Operador no encontrado con el nombre " + operator_name + "."
      });
    }
    const operator_id = operatorResult.rows[0].id;

    const categoryResult = await pool.query("SELECT id FROM categories WHERE name = $1 AND is_active = true", [category_name]);
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Categoría no encontrado con el nombre " + category_name + "."
      });
    }

    const category_id = categoryResult.rows[0].id;

    const offerResult = await pool.query(
      "INSERT INTO offers (name, description, price, is_range, date_start, date_end, operator_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [name, description, price, is_range || false, date_start, date_end, operator_id, validateUserWithPermissions.id]
    );

    const newOffer = offerResult.rows[0];

    if (benefits && Array.isArray(benefits) && benefits.length > 0) {
      await addBenefitsToOffer(newOffer.id, benefits, validateUserWithPermissions.id, validateUserWithPermissions.id);
    }

    const categoryOffer = await pool.query(
      "INSERT INTO categories_offers (offer_id,category_id,created_by) VALUES ($1, $2, $3) RETURNING *",
      [offerResult.rows[0].id, category_id, validateUserWithPermissions.id]
    );

    if (categoryOffer.rows.length === 0) {
      return res.status(201).json({
        process: "info",
        message: "La oferta fue registrada, pero no se puedo categorizar, comunicate con el AdminSys.",
      });
    }

    return res.status(201).json({
      process: "success",
      message: "Oferta creada exitosamente.",
      offer: newOffer,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    return res.status(500).json({ message: "Error interno del servidor al crear oferta." });
  }
};

export const getOffers = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  try {
    const result = await pool.query(`
      SELECT o.*, op.name as operator_name, 
      CASE 
          WHEN cat."name" IS NULL OR cat."name" = '' THEN 'No categorizada'
          ELSE cat."name"
        END AS category_name
      FROM offers o 
      LEFT JOIN operators op ON o.operator_id = op.id
      LEFT JOIN categories_offers cto ON o.id = cto.offer_id
      LEFT JOIN categories cat ON cto.category_id = cat.id
      ORDER BY o.created_at DESC

    `);

    const offers = result.rows;
    for (let offer of offers) {
      const benefitsResult = await pool.query(`
        SELECT b.id, b.description 
        FROM offers_benefits ob 
        JOIN benefits b ON ob.benefit_id = b.id 
        WHERE ob.offer_id = $1 AND ob.is_active = TRUE
      `, [offer.id]);
      offer.benefits = benefitsResult.rows;
    }

    return res.status(200).json({
      process: "success",
      offers: offers,
    });
  } catch (error) {
    console.error("Error getting offers:", error);
    return res.status(500).json({ message: "Error interno del servidor al consultar ofertas." });
  }
};

export const getOfferById = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);

  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT o.*, op.name as operator_name 
      FROM offers o 
      LEFT JOIN operators op ON o.operator_id = op.id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta no encontrada." });
    }

    const offer = result.rows[0];

    const benefitsResult = await pool.query(`
      SELECT b.id, b.description 
      FROM offers_benefits ob 
      JOIN benefits b ON ob.benefit_id = b.id 
      WHERE ob.offer_id = $1 AND ob.is_active = TRUE
    `, [id]);
    offer.benefits = benefitsResult.rows;

    return res.status(200).json({
      process: "success",
      offer,
    });
  } catch (error) {
    console.error("Error getting offer:", error);
    return res.status(500).json({ message: "Error interno del servidor al consultar la oferta." });
  }
};

export const updateOffer = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  const { id } = req.params;
  const { name, description, price, is_range, date_start, date_end, is_active, operator_name, category_name, benefits } = req.body;

  try {
    let operator_id = null;
    if (operator_name) {
      const operatorResult = await pool.query("SELECT id FROM operators WHERE name = $1 AND is_active = true", [operator_name]);
      if (operatorResult.rows.length === 0) {
        return res.status(404).json({
          process: "error",
          message: "Algo no esta bien, el operador no pudo ser consultado."
        });
      }
      operator_id = operatorResult.rows[0].id;
    }

    let category_id = null;
    if (category_name) {
      const categoryResult = await pool.query("SELECT id FROM categories WHERE name = $1 AND is_active = true", [category_name]);
      if (categoryResult.rows.length === 0) {
        return res.status(404).json({
          process: "error",
          message: "Algo no esta bien, la categoría no pudo ser consultada."
        });
      }
      category_id = categoryResult.rows[0].id;
    }

    const updateQuery = `
      UPDATE offers 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        is_range = COALESCE($4, is_range),
        date_start = COALESCE($5, date_start),
        date_end = COALESCE($6, date_end),
        is_active = COALESCE($7, is_active),
        operator_id = COALESCE($8, operator_id),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $9
      WHERE id = $10
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      name, description, price, is_range, date_start, date_end, is_active, operator_id, validateUserWithPermissions.id, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Oferta no encontrada."
      });
    }

    if (benefits && Array.isArray(benefits)) {
      // 1. Desactivar beneficios que no vengan en el array para mantener sincronizados
      const existingBenefits = await pool.query("SELECT id, benefit_id, is_active FROM offers_benefits WHERE offer_id = $1", [result.rows[0].id]);
      for (const row of existingBenefits.rows) {
        if (!benefits.includes(row.benefit_id) && row.is_active) {
          await pool.query(
            "UPDATE offers_benefits SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2",
            [validateUserWithPermissions.id, row.id]
          );
        }
      }

      // 2. Validar los benefits recibidos, asociarlos si no estaban o reactivarlos
      for (const benefit_id of benefits) {
        const exists = await pool.query("SELECT id, is_active FROM offers_benefits WHERE offer_id = $1 AND benefit_id = $2", [result.rows[0].id, benefit_id]);
        if (exists.rows.length === 0) {
          await pool.query(
            "INSERT INTO offers_benefits (offer_id, benefit_id, created_by) VALUES ($1, $2, $3)",
            [result.rows[0].id, benefit_id, validateUserWithPermissions.id]
          );
        } else if (!exists.rows[0].is_active) {
          await pool.query(
            "UPDATE offers_benefits SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2", 
            [validateUserWithPermissions.id, exists.rows[0].id]
          );
        }
      }
    }

    const updateOfferCategory = `UPDATE categories_offers set category_id = $1, updated_by = $2 WHERE offer_id = $3 RETURNING *`;
    const resultUpdateOfferCategory = await pool.query(updateOfferCategory, [category_id, validateUserWithPermissions.id, result.rows[0].id]);
    if (resultUpdateOfferCategory.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Los datos de la oferta se actualizarón, pero no se pudo actualizar la categría."
      });
    }

    return res.status(200).json({
      process: "success",
      message: "Oferta actualizada exitosamente.",
      offer: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    return res.status(500).json({ message: "Error interno del servidor al actualizar oferta." });
  }
};

export const addBenefitsToOfferEndpoint = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);

  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  const { id } = req.params; // offer_id
  const { benefits } = req.body; // array of benefit ids

  if (!benefits || !Array.isArray(benefits) || benefits.length === 0) {
    return res.status(400).json({
      process: "error",
      message: "Debe proporcionar una lista de beneficios."
    });
  }

  try {
    await addBenefitsToOffer(id, benefits, validateUserWithPermissions.id);

    return res.status(200).json({
      process: "success",
      message: "Beneficios agregados exitosamente a la oferta.",
    });
  } catch (error) {
    console.error("Error adding benefits endpoint:", error);
    return res.status(500).json({ message: "Error interno del servidor al agregar beneficios." });
  }
};

// GET ALL BENEFITS
export const getAllBenefits = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);

  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  try {
    const result = await pool.query("SELECT id, description FROM benefits WHERE is_active = true ORDER BY description ASC");
    return res.status(200).json({
      process: "success",
      benefits: result.rows,
    });
  } catch (error) {
    console.error("Error getting benefits:", error);
    return res.status(500).json({ message: "Error interno del servidor al consultar beneficios." });
  }
};

// GET ALL CATEGORIES
export const getAllCategories = async (req, res) => {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);

  if (validateUserWithPermissions.process !== "success") {
    return res.status(401).json({
      process: validateUserWithPermissions.process,
      message: validateUserWithPermissions.message
    });
  }

  try {
    const result = await pool.query("SELECT id, name FROM categories WHERE is_active = true ORDER BY name ASC");
    return res.status(200).json({
      process: "success",
      categories: result.rows,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    return res.status(500).json({ message: "Error interno del servidor al consultar categorías." });
  }
};