import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import multer from "multer";

const router = Router();

// Maximum upload size (500MB default, can be overridden by MAX_UPLOAD_MB env)
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_MB || "500") * 1024 * 1024;

// Create uploads directory
const uploadsDir = path.join(config.dataDir, "packages", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

// In-memory storage for multer (we'll handle file writing manually for progress tracking)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept .ipa files or octet-stream
    if (
      file.originalname.endsWith(".ipa") ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "application/x-itunes-ipa"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .ipa files are allowed"));
    }
  },
});

interface UploadMetadata {
  name: string;
  bundleId: string;
  version: string;
  accountHash?: string;
}

interface UploadResponse {
  id: string;
  name: string;
  bundleId: string;
  version: string;
  fileSize: number;
  createdAt: string;
}

// Upload IPA file
router.post(
  "/upload/ipa",
  upload.single("ipa"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Parse metadata from form data
      const metadata: UploadMetadata = {
        name: req.body.name || "Unknown App",
        bundleId: req.body.bundleId || "com.unknown.app",
        version: req.body.version || "1.0.0",
        accountHash: req.body.accountHash || "upload",
      };

      // Generate unique ID for this upload
      const packageId = uuidv4();
      const timestamp = Date.now();

      // Save IPA file
      const ipaPath = path.join(uploadsDir, `${packageId}.ipa`);
      fs.writeFileSync(ipaPath, req.file.buffer);

      // Save metadata
      const metadataPath = path.join(uploadsDir, `${packageId}.json`);
      const packageMetadata = {
        id: packageId,
        ...metadata,
        filePath: ipaPath,
        fileSize: req.file.size,
        createdAt: new Date(timestamp).toISOString(),
      };
      fs.writeFileSync(metadataPath, JSON.stringify(packageMetadata, null, 2));

      // Return success response
      const response: UploadResponse = {
        id: packageId,
        name: metadata.name,
        bundleId: metadata.bundleId,
        version: metadata.version,
        fileSize: req.file.size,
        createdAt: packageMetadata.createdAt,
      };

      res.json(response);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// Get list of uploaded packages
router.get("/uploads", (req: Request, res: Response) => {
  try {
    const accountHash = req.query.accountHash as string;
    const uploads: UploadResponse[] = [];

    if (!fs.existsSync(uploadsDir)) {
      res.json(uploads);
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const metadataPath = path.join(uploadsDir, file);
      const content = fs.readFileSync(metadataPath, "utf-8");
      const metadata = JSON.parse(content);

      // Filter by account hash if provided
      if (accountHash && metadata.accountHash !== accountHash) {
        continue;
      }

      uploads.push({
        id: metadata.id,
        name: metadata.name,
        bundleId: metadata.bundleId,
        version: metadata.version,
        fileSize: metadata.fileSize,
        createdAt: metadata.createdAt,
      });
    }

    // Sort by creation date (newest first)
    uploads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(uploads);
  } catch (error) {
    console.error("Get uploads error:", error);
    res.status(500).json({ error: "Failed to get uploads" });
  }
});

// Download uploaded IPA
router.get("/uploads/:id/file", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ipaPath = path.join(uploadsDir, `${id}.ipa`);
    const metadataPath = path.join(uploadsDir, `${id}.json`);

    if (!fs.existsSync(ipaPath) || !fs.existsSync(metadataPath)) {
      res.status(404).json({ error: "Package not found" });
      return;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    const stats = fs.statSync(ipaPath);

    // Set headers for IPA download
    const sanitizedName = metadata.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${sanitizedName}_${metadata.version}.ipa`;
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stats.size);

    const stream = fs.createReadStream(ipaPath);
    stream.pipe(res);
  } catch (error) {
    console.error("Download upload error:", error);
    res.status(500).json({ error: "Download failed" });
  }
});

// Delete uploaded package
router.delete("/uploads/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ipaPath = path.join(uploadsDir, `${id}.ipa`);
    const metadataPath = path.join(uploadsDir, `${id}.json`);

    let deleted = false;
    if (fs.existsSync(ipaPath)) {
      fs.unlinkSync(ipaPath);
      deleted = true;
    }
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
      deleted = true;
    }

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Package not found" });
    }
  } catch (error) {
    console.error("Delete upload error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
