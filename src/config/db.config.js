import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config(); // Carga las variables de entorno

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Importante para Supabase Transaction Pooler
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Prueba de conexión (opcional, pero útil)
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente de la pool', err.stack);
  }
  console.log('Connect success!');
  client.query('SELECT NOW()', (err, result) => {
    release(); // Libera el cliente de vuelta a la pool
    if (err) {
      return console.error('Error excute query test: ', err.stack);
    }
    console.log('Query test execute: ', result.rows);
  });
});

export default pool;