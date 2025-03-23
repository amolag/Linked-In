import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Mongodb Connected : ${conn.connection.host}`);
  } catch (error) {
    console.error(`error connecting to MongoDb : ${error.message}`);
    process.exit(1);
  }
};
