import pool from "../../config/db.config.js";

// Get benefits, no authentication required
export const getBenefitsByOfferId = (req, res) => {
  const offer_id = req.params.offer_id;
  if (!offer_id || offer_id === '' || offer_id === null || offer_id === undefined) {
    return res
      .status(400)
      .json({ message: "Debe proporcionar un ID de oferta válido." });
  }

  // Validate if offer exists
  pool.query(`SELECT * FROM offers WHERE id = $1`, [offer_id], (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error al consultar oferta." });
    }
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Oferta no encontrada." });
    }
  });

  pool.query(`SELECT of.id AS offer_id,  
              be.id AS benefit_id, be.description AS benefit_description
              FROM offers_benefits ob
              JOIN offers of ON ob.offer_id = of.id
              JOIN benefits be ON ob.benefit_id = be.id
              WHERE ob.offer_id = $1
              AND ob.is_active
              AND be.is_active`, 
  [offer_id], (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error al consultar beneficios." });
    }
    res.json({
      process: "success",
      message: "Beneficios obtenidos exitosamente.",
      count: result.rowCount,
      data: result.rows,
    });
  });
};
