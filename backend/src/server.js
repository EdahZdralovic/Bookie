require('dotenv').config();

const app = require('./app');
const prisma = require('./config/database');

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, (error) => {
  if (error) {
    console.error('Unable to start Bookie:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Bookie is running at http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
