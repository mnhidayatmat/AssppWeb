import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UploadIcon, CheckIcon } from "../common/icons";
import { useToastStore } from "../../store/toast";
import { uploadIpa } from "../../api/upload";

interface FormData {
  name: string;
  bundleId: string;
  version: string;
}

interface UploadResult {
  id: string;
  name: string;
  bundleId: string;
  version: string;
  fileSize: number;
  createdAt: string;
}

export default function UploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    bundleId: "",
    version: "",
  });

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".ipa")) {
      addToast("upload", "error", t("upload.invalidFile"));
      return;
    }
    setSelectedFile(file);
    // Auto-fill metadata from filename if empty
    if (!formData.name) {
      setFormData((prev) => ({
        ...prev,
        name: file.name.replace(".ipa", ""),
      }));
    }
  }, [formData.name, addToast, t]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast("upload", "error", t("upload.noFile"));
      return;
    }
    if (!formData.name || !formData.bundleId || !formData.version) {
      addToast("upload", "error", t("upload.missingFields"));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadIpa(selectedFile, formData, (progress) => {
        setUploadProgress(progress);
      });

      addToast(
        "upload",
        "success",
        t("upload.success", { name: result.name })
      );

      // Navigate to downloads page to see the uploaded package
      navigate("/downloads");
    } catch (error) {
      addToast("upload", "error", t("upload.failed"));
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("upload.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t("upload.description")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("upload.ipaFile")}
          </label>
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${
                isDragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }
              ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ipa"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isUploading}
            />
            <div className="flex flex-col items-center gap-3">
              {selectedFile ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <UploadIcon className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                  <div className="text-center">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t("upload.dropFile")}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t("upload.orClick")}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* App Metadata */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="appName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t("upload.appName")}
            </label>
            <input
              id="appName"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="My Awesome App"
            />
          </div>

          <div>
            <label
              htmlFor="bundleId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t("upload.bundleId")}
            </label>
            <input
              id="bundleId"
              type="text"
              value={formData.bundleId}
              onChange={(e) =>
                setFormData({ ...formData, bundleId: e.target.value })
              }
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="com.example.myapp"
            />
          </div>

          <div>
            <label
              htmlFor="version"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t("upload.version")}
            </label>
            <input
              id="version"
              type="text"
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="1.0.0"
            />
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("upload.uploading")}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUploading || !selectedFile}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isUploading ? t("upload.uploading") : t("upload.submit")}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          {t("upload.instructionsTitle")}
        </h3>
        <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>{t("upload.step1")}</li>
          <li>{t("upload.step2")}</li>
          <li>{t("upload.step3")}</li>
          <li>{t("upload.step4")}</li>
        </ol>
      </div>
    </div>
  );
}
