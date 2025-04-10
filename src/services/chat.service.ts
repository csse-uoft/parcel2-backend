import Message from "../models/message.model";

export const saveMessage = async (room: string, sender: string, text: string) => {
    return await Message.create({ room, sender, text });
};

export const getMessagesByRoom = async (room: string) => {
    return await Message.find({ room }).sort({ timestamp: -1 }).limit(50);
};
