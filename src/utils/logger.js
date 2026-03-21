import fs from "fs";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

// Crear carpeta si no existe
if (!fs.existsSync(logDir)) {
 fs.mkdirSync(logDir);
}

// TODO: admin create file and writting log by environment variables (active/inactive)
// Enviroment variables: 
// - LOG_ACTIVE: true/false
// - LOG_FILE: path/to/log/file

// 🗓️ Nombre del archivo por día
const getLogFileName = () => {
 const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
 return path.join(logDir, `${date}.log`);
};

// 🧠 Formato de log
const formatMessage = (level, message, meta = {}) => {
 const timestamp = new Date().toISOString();
 return `[${timestamp}] [${level}] ${message} ${JSON.stringify(meta)}\n`;
};

// 📝 Escribir en archivo
const writeLog = (level, message, meta) => {
 const logMessage = formatMessage(level, message, meta);
 fs.appendFileSync(getLogFileName(), logMessage);
};

// 🎯 Logger público
export const logger = {
 info: (message, meta = {}) => {
  console.log(message, meta);
  writeLog("INFO", message, meta);
 },

 error: (message, meta = {}) => {
  console.error(message, meta);
  writeLog("ERROR", message, meta);
 },

 warn: (message, meta = {}) => {
  console.warn(message, meta);
  writeLog("WARN", message, meta);
 }
};