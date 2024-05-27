const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Change to 'warn' or 'error' to reduce verbosity
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'combined.log' })
  ],
});

module.exports = logger;
