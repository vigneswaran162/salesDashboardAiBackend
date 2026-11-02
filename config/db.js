const mongoose = require('mongoose');

/**
 * Connects to MongoDB Atlas using MONGODB_URI from .env.
 * Exits the process if the connection cannot be established.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || /<[A-Z_]+>/.test(uri)) {
    console.error('MONGODB_URI is missing or still contains a placeholder. Update backend/.env first.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, { dbName: 'salesDashboard' });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
