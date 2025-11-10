import mongoose, { Schema, Document, Types } from "mongoose";

export interface ChatRoom {
    opportunityIri: string;
    organizationIri: string;
    userId: Types.ObjectId;
    lastMessage?: string | null;
    lastMessageSender?: string | null;
    lastMessageAt?: Date | null;
}

export interface ChatRoomDocument extends ChatRoom, Document {
    createdAt: Date;
    updatedAt: Date;
}

const chatRoomSchema = new Schema<ChatRoomDocument>(
    {
        opportunityIri: { type: String, required: true },
        organizationIri: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        lastMessage: { type: String, default: null },
        lastMessageSender: { type: String, default: null },
        lastMessageAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    },
);

chatRoomSchema.index({ opportunityIri: 1, userId: 1 }, { unique: true });
chatRoomSchema.index({ organizationIri: 1, lastMessageAt: -1 });
chatRoomSchema.index({ userId: 1, lastMessageAt: -1 });

export default mongoose.model<ChatRoomDocument>("ChatRoom", chatRoomSchema);
