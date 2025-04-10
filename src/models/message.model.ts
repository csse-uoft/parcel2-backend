import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    room: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, default: null },
    fileUrl: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Message", messageSchema);
