const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.backend'), // force backend .env
  override: true,
});
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const bookingService = require('./services/booking.service.js'); // Import booking service

const prisma = new PrismaClient();
const app = express();

// --- Redis Client Setup ---
const IORedis = require('ioredis');
const redisClient = new IORedis(process.env.REDIS_CONNECTION_STRING, {
  maxRetriesPerRequest: null
});

// --- Middleware ---
app.use(cors({ origin: ['http://localhost:8080', 'http://localhost:8081'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));

// --- Routes ---
const authRoutes = require('./routes/auth.routes.js');
const twilioRoutes = require('./routes/twilio.routes.js');
const driverRoutes = require('./routes/driver.routes.js');
const uploadRoutes = require('./routes/upload.routes.js');
const bookingRoutes = require('./routes/booking.routes.js'); // Mount booking routes
const documentRoutes = require('./routes/document.routes.js');
const analyticsRoutes = require('./routes/analytics.routes.js'); // New: Mount analytics routes
const userRoutes = require('./routes/user.routes.js');
const routingRoutes = require('./routes/routing.routes.js');
const chatRoutes = require('./routes/chat.routes.js');
const zoneRoutes = require('./routes/zone.routes.js');
const { authenticateToken, authorizeRoles } = require('./middleware/auth.middleware.js');

app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'Test route works!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bookings', bookingRoutes); // Mount booking routes
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes); // New: Mount analytics routes
app.use('/api/users', userRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/zones', zoneRoutes);

app.get('/api/ngrok-url', async (req, res) => {
  try {
    const ngrokApiUrl = 'http://ngrok:4040/api/tunnels';
    const response = await axios.get(ngrokApiUrl);
    const tunnels = response.data.tunnels;
    const httpTunnel = tunnels.find(tunnel => tunnel.proto === 'https'); // Look for https tunnel

    if (httpTunnel) {
      res.json({ ngrokUrl: httpTunnel.public_url });
    } else {
      res.status(404).json({ error: 'ngrok HTTP tunnel not found' });
    }
  } catch (error) {
    logger.error('Failed to retrieve ngrok URL:', error);
    res.status(500).json({ error: 'Failed to retrieve ngrok URL' });
  }
});

// --- Server & Socket.IO Setup ---
const PORT = process.env.PORT || 3100;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:8081"],
    methods: ["GET", "POST"]
  }
});

// Make io accessible to our routes
app.set('io', io);
app.set('redisClient', redisClient);

io.on('connection', (socket) => {
  logger.info('a user connected');

  socket.on('join', (data) => {
    if (data.driverId) {
      socket.join(data.driverId.toString());
      logger.info(`Driver ${data.driverId} joined their room`);
    } else if (data.userId) {
      socket.join(data.userId.toString());
      logger.info(`User ${data.userId} joined their room`);
    } else if (data.bookingId) {
      socket.join(data.bookingId.toString());
      logger.info(`Joined chat room for booking ${data.bookingId}`);
    }
  });

  socket.on('newRideRequest', async (data) => {
    logger.info('newRideRequest event received on backend:', data);
    try {
      await bookingService.initiateDriverAssignment(data.bookingId, io);
    } catch (error) {
      logger.error(`Error finding driver for booking ${data.bookingId}:`, error);
    }
  });

  socket.on('disconnect', () => {
    logger.info('user disconnected');
  });

  socket.on('driverEnRoute', async ({ bookingId, driverId }) => {
    logger.info(`Driver ${driverId} is en route for booking ${bookingId}`);
    try {
      await bookingService.updateBookingStatusToEnRoute(bookingId, driverId, io);
    } catch (error) {
      logger.error(`Error handling driverEnRoute for booking ${bookingId}:`, error);
    }
  });

  socket.on('driverArrived', async ({ bookingId, driverId }) => {
    logger.info(`Driver ${driverId} has arrived for booking ${bookingId}`);
    try {
      await bookingService.updateBookingStatusToArrived(bookingId, driverId, io);
    } catch (error) {
      logger.error(`Error handling driverArrived for booking ${bookingId}:`, error);
    }
  });
});

const { startInactiveDriverCheck } = require('./services/cron.service.js');

const startServer = async () => {
  logger.info('Connected to Redis successfully.');
  startInactiveDriverCheck(io);

  httpServer.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
};

startServer();
