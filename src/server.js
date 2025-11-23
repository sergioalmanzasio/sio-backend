import express from 'express';
import cors from 'cors';
// import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
import pool from './config/db.config.js';
import routes from './routes/index.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// Middleware
app.use(cors({
 origin: "http://localhost:5173", // 👈 tu frontend
 credentials: true, // 👈 necesario para cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//*** ROUTE FOR WELCOME 
app.get('/', (req, res) => {
 res.json({ message: 'Bienvenido al backend de fp-003!!' });
});

//*** ROUTES
app.use('/api/auth', routes.authRoutes);
app.use('/api/signup', routes.signupRoutes);
app.use('/api/document-type', routes.documentTypeRoutes);
app.use('/api/offer', routes.offerRoutes);
app.use('/api/operator', routes.operatorRoutes);
app.use('/api/category', routes.categoryRoutes);
app.use('/api/benefit', routes.benefitRoutes);
app.use('/api/request', routes.requestRoutes);

//*** GLOBAL ERROR HANDLER (opcional, pero recomendado para producción)
//*** Manejador de errores global simple (opcional, pero recomendado para producción)
app.use((err, req, res, next) => {
 console.error(err.stack);
 res.status(500).send('¡Algo salió mal en el servidor!');
})


const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
 console.log(`fp-003: Server is running on port ${PORT}`);
});