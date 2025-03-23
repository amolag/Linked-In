import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";

export const getSuggestedConnections = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select("connections");

    // Get all users except the current user and their connections
    const suugestedUser = await User.find({
      _id: {
        $ne: req.user._id,
        $nin: currentUser.connections,
      },
    })
      .select("name , username , profilePic , headline")
      .limit(3);

    res.json(suugestedUser);
  } catch (error) {
    console.error("Error in getSuggestedConnections : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select(
      "-password"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error in getPublicProfile : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "username",
      "headline",
      "about",
      "location",
      "profilePic",
      "bannerImg",
      "skills",
      "experience",
      "education",
    ];

    const updatedData = {};
    for (const field of allowedFields) {
      if (req.body[field]) {
        updatedData[field] = req.body[field];
      }
    }
    //profilePic and bannerImg
    if (req.body.profilePic) {
      const result = await cloudinary.uploader.upload(req.body.profilePic);
      updatedData.profilePic = result.secure_url;
    }

    if (req.body.bannerImg) {
      const result = await cloudinary.uploader.upload(req.body.bannerImg);
      updatedData.bannerImg = result.secure_url;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updatedData },
      { new: true }
    ).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Error in updateProfile : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
