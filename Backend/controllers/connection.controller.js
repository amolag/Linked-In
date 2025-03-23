import ConnectionRequest from "../models/connectionRequest.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { sendConnectionAcceptedEmail } from "../email/emailHandlers.js";

export const sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const senderId = req.user._id;

    if (senderId.toString() === userId) {
      return res
        .status(400)
        .json({ message: "You cannot send a connection request to yourself" });
    }

    if (req.user.connections.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already connected with this user" });
    }

    const existingRequest = await ConnectionRequest.findOne({
      sender: senderId,
      recipient: userId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "You have already sent a connection request to this user",
      });
    }

    const newRequest = new ConnectionRequest({
      sender: senderId,
      recipient: userId,
    });

    await newRequest.save();

    res.status(201).json({
      message: "Connection request sent successfully",
    });
  } catch (error) {
    console.error("Error in sendConnectionRequest : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptConnectionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await ConnectionRequest.findById(requestId)
      .populate("sender", "name email username")
      .populate("recipient", "name username");

    if (!request) {
      return res.status(404).json({ message: "Connection request not found" });
    }

    if (request.recipient._id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized attempt to accept connection request" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This request has already been accepted" });
    }

    request.status = "accepted";

    await request.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { connections: request.sender._id },
    });

    await User.findByIdAndUpdate(request.sender._id, {
      $addToSet: { connections: userId },
    });

    const notification = new Notification({
      recipient: request.sender._id,
      type: "connectionAccepted",
      relatedUser: userId,
    });

    await notification.save();

    res
      .status(200)
      .json({ message: "Connection request accepted successfully" });

    // send email
    const senderEmail = request.sender.email;
    const senderName = request.sender.name;
    const recipientName = request.recipient.name;
    const profileUrl =
      process.env.CLIENT_URL + "/profile/" + request.recipient.username;

    try {
      await sendConnectionAcceptedEmail(
        senderEmail,
        senderName,
        recipientName,
        profileUrl
      );
    } catch (error) {
      console.error("Error in sendConnectionAcceptedEmail : ", error.message);
    }
  } catch (error) {
    console.error("Error in acceptConnectionRequest : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const rejectConnectionRequest = async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.user._id;
    const request = await ConnectionRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Connection request not found" });
    }

    if (request.recipient.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized attempt to reject connection request" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This request has already been rejected" });
    }

    request.status = "rejected";
    await request.save();

    res
      .status(200)
      .json({ message: "Connection request rejected successfully" });
  } catch (error) {
    console.error("Error in rejectConnectionRequest : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getConnectionRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const requests = await ConnectionRequest.find({
      recipient: userId,
      status: "pending",
    }).populate("sender", "name username profilePic headline connections");

    res.status(200).json(requests);
  } catch (error) {
    console.error("Error in getConnectionRequests : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserConnections = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate(
      "connections",
      "name username profilePic headline connections"
    );
    res.status(200).json(user.connections);
  } catch (error) {
    console.error("Error in getUserConnections : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const removeConnection = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;

    await User.findByIdAndUpdate(myId, {
      $pull: { connections: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { connections: myId },
    });

    res.status(200).json({
      message: "Connection removed successfully",
    });
  } catch (error) {
    console.error("Error in removeConnection : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getConnectionStatus = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    const currentUser = req.user;
    if (currentUser.connections.includes(targetUserId)) {
      return res.status(200).json({
        status: "Connected",
      });
    }

    const pendingRequest = await ConnectionRequest.findOne({
      $or: [
        { sender: currentUserId, recipient: targetUserId },
        { sender: targetUserId, recipient: currentUserId },
      ],
      status: "pending",
    });

    if (pendingRequest) {
      if (pendingRequest.sender.toString() === currentUserId.toString()) {
        return res.status(200).json({
          status: "Pending",
        });
      } else {
        return res.status(200).json({
          status: "Received",
          requestId: pendingRequest._id,
        });
      }
    }
    // if not pending request
    res.status(200).json({
      status: "not-connected",
    });
  } catch (error) {
    console.error("Error in getConnectionStatus : ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
