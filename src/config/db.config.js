import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config(); // Carga las variables de entorno

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10), // Puerto por defecto si no está definido
});

// Prueba de conexión (opcional, pero útil)
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente de la pool', err.stack);
  }
  console.log('fp-003: Connect success!');
  client.query('SELECT NOW()', (err, result) => {
    release(); // Libera el cliente de vuelta a la pool
    if (err) {
      return console.error('Error excute query test: ', err.stack);
    }
    console.log('Query test execute: ', result.rows);
  });
});

export default pool;