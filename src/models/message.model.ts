import mongoose, { Document, Schema, Types } from "mongoose";

export interface ChatMessage {
    room: string;
    roomId: Types.ObjectId;
    sender: string;
    senderId: Types.ObjectId;
    text?: string | null;
    fileUrl?: string | null;
    timestamp: Date;
}

export interface ChatMessageDocument extends ChatMessage, Document {}

const messageSchema = new Schema<ChatMessageDocument>({
    room: { type: String, required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    sender: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: null },
    fileUrl: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
});

messageSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model<ChatMessageDocument>("Message", messageSchema);
