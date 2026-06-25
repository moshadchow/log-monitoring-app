const express = require('express');
const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const statusRoutes = require('./routes/status.routes');

const app = express();

app.use(express.json());
app.use(requestLogger);

app.use((req, res, next) => {
  res.setTimeout(config.requestTimeoutMs, () => {
    res.status(503).json({ success: false, message: 'Request timed out' });
  });
  next();
});

app.use('/health', healthRoutes);
app.use('/', statusRoutes);

app.use(errorHandler);

module.exports = app;
