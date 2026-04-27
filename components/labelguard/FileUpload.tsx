
import React, { useCallback } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_LONG_SIDE = 500;
const MIN_SHORT_SIDE = 50;

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled }) => {

  const validateFile = async (file: File): Promise<boolean> => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`File ${file.name} is too large. Maximum size is 20MB.`);
      return false;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        if (img.width < MIN_SHORT_SIDE || img.height < MIN_SHORT_SIDE) {
          alert(`Image ${file.name} is too small (${img.width}x${img.height}). Minimum dimension is ${MIN_SHORT_SIDE}px.`);
          resolve(false);
          return;
        }

        if (img.width < MIN_LONG_SIDE && img.height < MIN_LONG_SIDE) {
          alert(`Image ${file.name} resolution is too low (${img.width}x${img.height}). At least one side must be >= ${MIN_LONG_SIDE}px.`);
          resolve(false);
          return;
        }

        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        alert(`Could not load image ${file.name}. Please ensure it is a valid image file.`);
        resolve(false);
      };

      img.src = objectUrl;
    });
  };

  const processFiles = async (incomingFiles: File[]) => {
    const validFiles: File[] = [];

    for (const file of incomingFiles) {
      const isValid = await validateFile(file);
      if (isValid) validFiles.push(file);
    }

    if (validFiles.length > 0) onFilesSelected(validFiles);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) processFiles(files);
    },
    [onFilesSelected, disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;
    const files = (Array.from(e.target.files) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
        disabled
          ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
          : 'bg-white border-blue-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer shadow-sm'
      }`}
    >
      <input
        type="file"
        id="lgFileInput"
        multiple
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <label htmlFor="lgFileInput" className="cursor-pointer w-full h-full block">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-blue-100 rounded-full text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">Drop label images here, or click to browse</p>
            <p className="text-sm text-gray-500 mt-1">Supports JPEG, PNG, WEBP (Max 20MB)</p>
          </div>
        </div>
      </label>
    </div>
  );
};

export default FileUpload;
