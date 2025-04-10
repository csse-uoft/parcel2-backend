import multer from "multer";
import * as fs from "node:fs";
import path from "node:path";
import express, {Express, Request, Response} from "express";

export function configureUploads(app: Express) {
    // Ensure Uploads Directory Exists
    if (!fs.existsSync("./uploads")) {
        fs.mkdirSync("./uploads");
    }

    // Configure Multer for File Uploads
    const storage = multer.diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) => {
            cb(null, Date.now() + "-" + file.originalname);
        },
    });
    const upload = multer({ storage });
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    // Handle File Uploads
    app.post("/upload", upload.single("file"), (req: Request, res: Response) => {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }

        const fileUrl = `/uploads/${req.file!.filename}`;
        res.json({ message: "File uploaded successfully", fileUrl });
    });
}
