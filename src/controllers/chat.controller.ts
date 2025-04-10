import { Request, Response } from "express";
import Message from "../models/message.model";

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { room, text } = req.body;
        const message = await Message.create({ sender: (req as any).user.username, room, text });
        res.json({ message });
    } catch (error) {
        res.status(500).json({ message: "Error sending message" });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const messages = await Message.find({ room: req.params.room }).sort({ timestamp: -1 }).limit(50);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages" });
    }
};
