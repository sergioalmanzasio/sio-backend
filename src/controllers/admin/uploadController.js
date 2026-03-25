import cloudinary from '../../config/cloudinary.js';
import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { logger } from '../../utils/logger.js';

export const uploadImage = async (req, res) => {
  try {
    const { operatorId } = req.body; // create or update
    if (!req.file || !operatorId) {
      return res.status(400).json({
        process: 'error',
        message: 'Todos los campos son requeridos.'
      });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'SIO-operators-logos',
      overwrite: true,
      invalidate: true,
      transformation: [
        { width: 400, crop: 'limit' },
        { fetch_format: 'auto' },
        { quality: 'auto' },
      ],
    });

    let operatorIDDecoded;
    try {
      const decoded = jwt.verify(operatorId, authConfig.secret);
      operatorIDDecoded = decoded.operatorId;
    } catch (err) {
      logger.error('uploadController.uploadImage - Error:', err.message);
      return res.status(400).json({
        process: "error",
        message: "El identificador del operador no es válido o ha expirado.",
      });
    }

    const validateHasLogo = await pool.query(
      `SELECT image_name FROM operators WHERE id = $1`,
      [operatorIDDecoded]
    );

    if (validateHasLogo.rows.length === 0) {
      return res.status(404).json({
        process: 'error',
        message: 'Lo sentimos, no se pudo encontrar el operador, intente nuevamente más tarde.'
      });
    }

    if (validateHasLogo.rows[0].image_name) {
      await cloudinary.uploader.destroy(validateHasLogo.rows[0].image_name);
    }

    const updateOperator = await pool.query(
      `UPDATE operators SET image_name = $1 WHERE id = $2 RETURNING *`,
      [result.secure_url, operatorIDDecoded]
    );

    if (updateOperator.rows.length === 0) {
      return res.status(404).json({
        process: 'error',
        message: 'Lo sentimos, no se pudo actualizar el logo del operador, intente nuevamente más tarde.'
      });
    }

    // console.log('.........result', result);
    return res.status(200).json({
      process: 'success',
      message: 'Logo subido correctamente',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    logger.error('uploadController.uploadImage - Error:', error.message);
    return res.status(500).json({
      process: 'error',
      message: 'Lo sentimos, se presentó un error al subir la imagen, intente nuevamente más tarde.'
    });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        process: 'error',
        message: 'Todos los campos son requeridos.' // publicId
      });
    }

    await cloudinary.uploader.destroy(publicId);

    return res.status(200).json({
      process: 'success',
      message: 'Imagen eliminada correctamente'
    });
  } catch (error) {
    logger.error('uploadController.deleteImage - Error:', error.message);
    return res.status(500).json({
      process: 'error',
      message: 'Lo sentimos, se presentó un error al eliminar la imagen, intente nuevamente más tarde.'
    });
  }
};