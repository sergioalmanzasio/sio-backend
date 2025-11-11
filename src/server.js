import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
// import routes from './routes/index';
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
/*
app.use('/api/auth', routes.authRoutes);
app.use('/api/menu', routes.menuRoutes);
app.use('/api/catalog', routes.catalogRoutes);
app.use('/api/person', routes.personRoutes);
app.use('/api/entrepreneurship', routes.entrepreneurshipRoutes);
app.use('/api/career', routes.careerRoutes);
app.use('/api/event', routes.eventRoutes);
*/

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