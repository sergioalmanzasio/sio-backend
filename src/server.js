import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import pool from './config/db.config.js';
import routes from './routes/index.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.set("trust proxy", 1);

//*** CORS CONFIGURATION
const allowedOrigins = [
 'http://localhost:3000',   // o el puerto que uses
 'http://localhost:5173',   // si usas Vite
 'http://localhost:4200',   // si usas Angular
 'https://sio-mvp.vercel.app'
];

app.use(cors({
 origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
   callback(null, true);
  } else {
   callback(new Error('No permitido por CORS'));
  }
 },
 credentials: true,        // ⚠️ CRÍTICO si usas cookies
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
 allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
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
app.use('/api/menu', routes.menuRoutes);
app.use('/api/request', routes.requestRoutes);
app.use('/api/person', routes.personRoutes);
app.use('/api/referral', routes.referralRoutes);
app.use('/api/payments', routes.paymentsRoutes);
app.use('/api/admin', routes.adminRoutes);
app.use('/api/admin/dashboard', routes.dashboardRoutes);
app.use('/api/coordinate-service/dashboard', routes.coordinateServiceDashboardRoutes);
app.use('/api/bonus', routes.bonusRoutes);
app.use('/api/admin/offers', routes.offersRoutes);

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