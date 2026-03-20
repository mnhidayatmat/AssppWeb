import { authHeaders } from "./client";

export interface UploadMetadata {
  name: string;
  bundleId: string;
  version: string;
}

export interface UploadResult {
  id: string;
  name: string;
  bundleId: string;
  version: string;
  fileSize: number;
  createdAt: string;
}

export async function uploadIpa(
  file: File,
  metadata: UploadMetadata,
  onProgress: (progress: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (error) {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    // Handle errors
    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled"));
    });

    // Create form data
    const formData = new FormData();
    formData.append("ipa", file);
    formData.append("name", metadata.name);
    formData.append("bundleId", metadata.bundleId);
    formData.append("version", metadata.version);

    // Send request
    xhr.open("POST", "/api/upload/ipa");

    // Add auth headers
    const headers = authHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.send(formData);
  });
}

export async function getUploads(): Promise<UploadResult[]> {
  const res = await fetch("/api/uploads", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUpload(id: string): Promise<void> {
  const res = await fetch(`/api/uploads/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}
