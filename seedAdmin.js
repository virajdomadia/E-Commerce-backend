const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existingAdmin = await User.findOne({ email: "admin@example.com" });

    if (existingAdmin) {
      console.log("Admin user already exists");
    } else {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const adminUser = new User({
        name: "Admin",
        email: "admin@example.com",
        password: hashedPassword,
        isAdmin: true,
      });

      await adminUser.save();
      console.log("Admin user seeded successfully");
    }

    mongoose.disconnect();
  } catch (err) {
    console.error("Error seeding admin user:", err);
    mongoose.disconnect();
  }
};

seedAdmin();
