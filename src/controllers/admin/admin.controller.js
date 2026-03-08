
import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";


// Get All service requests for admin
// AC-AC-001
export const getAllServiceRequests = async (req, res) => {
 try {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  pool.query(
   `SELECT 
        rsr.id AS referral_service_request_id, 
        of.name as offer_name, of.description as offer_description, 
        '$' || REPLACE(
                  TO_CHAR(of.price, 'FM999,999,999,990'),
                  ',', '.'
              ) as offer_price,
              op."name" as operator_name,
		      rsr.filing_number,  
              srs.description AS status, 
              TO_CHAR(
                rsr.created_at,
                'Mon FMDD "de" YYYY FMHH12:MI a.m.'
              ) AS created_at_formatted,
              prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as coordinate_service_assigned,
              prsReferral.name || ' ' || COALESCE(prsReferral.middle_name, '') || ' ' || prsReferral.last_name as referral_name,
              rsr.tracking_code
      FROM referral_service_requests rsr
      JOIN service_request_states srs ON rsr.service_request_state_id = srs.id
      JOIN offers of ON rsr.offer_id = of.id
      JOIN operators op ON of.operator_id = op.id
      JOIN users usr ON usr.id = rsr.coordinate_service_user
      JOIN persons prs ON prs.id = usr.person_id
      JOIN referred_clients rfc ON rfc.code = rsr.assigned_referral_code
      JOIN users usrReferral ON usrReferral.id = rfc.user_id
      JOIN persons prsReferral ON prsReferral.id = usrReferral.person_id
      ORDER BY 
       CASE 
           WHEN srs.status = 'IN_PROGRESS' THEN 0
           ELSE 1
       END,
       rsr.created_at DESC`,
   (err, result) => {
    if (err) {
     return res.status(500).json({
      process: "error",
      message:
       "Lo sentimos, no se pudo obtener la información de las solicitudes de servicio, inténtelo más tarde. (AC-AC-001).",
     });
    }

    for (let i = 0; i < result.rows.length; i++) {
     result.rows[i].referral_service_request_id = jwt.sign({ referralServiceRequestId: result.rows[i].referral_service_request_id }, authConfig.secret, { expiresIn: "50m" });
    }
    return res.status(200).json({
     process: "success",
     message: "Información de las solicitudes de servicio obtenida exitosamente.",
     count: result.rows.length,
     data: result.rows
    });
   }
  );
 } catch (error) {
  console.log("ERROR GLOBAL getAllServiceRequestsForAdmin: ", error);

  return res.status(500).json({
   process: "error",
   message:
    "Lo sentimos, no se pudo obtener la información de las solicitudes de servicio, inténtelo más tarde. (AC-AC-001).",
  });
 }
}