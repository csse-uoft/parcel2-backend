import { tmpPublicUrl } from "../services/uploads";
import path from "path";
import { Request, Response } from "express";

export async function handleUploadImage(req: Request, res: Response) {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ message: 'No file' });
        return
    }
    const url = tmpPublicUrl('image', path.basename(file.path));
    res.json({ url });
    return
}

export async function handleUploadFile(req: Request, res: Response) {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ message: 'No file' });
        return
    }
    const url = tmpPublicUrl('file', path.basename(file.path));
    res.json({ url });
    return
}