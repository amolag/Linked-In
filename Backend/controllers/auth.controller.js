import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail } from "../email/emailHandlers.js";

export const signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email already exist",
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        message: "Username already exist",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least one letter, one number, and one special character.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("jwt-linkedIn", token, {
      httpOnly: true, // prevents xss attack
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      sameSite: "strict", // prevents CSRF attack
      secure: process.env.NODE_ENV === "production", // prevents man in middle attack
    });

    res.status(201).json({ message: "User created successfully" });

    const profileUrl = process.env.CLIENT_URL + "/profile/" + user.username;

    // task : send welcome email
    try {
      // send email
      await sendWelcomeEmail(user.email, user.name, profileUrl);
    } catch (error) {
      console.log("Error in sending email : ", error.message);
    }
  } catch (error) {
    console.log("Error in signup : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    //create and send token to cookie

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    await res.cookie("jwt-linkedIn", token, {
      httpOnly: true, // prevents xss attack
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      sameSite: "strict", // prevents CSRF attack
      secure: process.env.NODE_ENV === "production", // prevents man in middle attack
    });

    res.status(200).json({
      message: "User logged in successfully",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error in login : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("jwt-linkedIn");
  res.json({ message: "User logged out successfully" });
};

export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }
    res.json(req.user);
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
