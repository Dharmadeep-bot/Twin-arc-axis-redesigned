import { useRef } from 'react';
import { UploadIcon } from './Icons';

function UploadZone({ 
  isDragOver, 
  hasDatasets, 
  onDragOver, 
  onDragLeave, 
  onDrop, 
  onFileSelect 
}) {
  const fileInputRef = useRef(null);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
      e.target.value = ''; // Reset input to allow same file upload again
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    onDrop(file);
  };

  return (
    <div
      className={`upload-zone ${isDragOver ? 'dragover' : ''} ${hasDatasets ? 'compact' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="upload-icon">
        <UploadIcon />
      </div>
      <h3>{hasDatasets ? 'Add Another Dataset' : 'Drop your CSV here'}</h3>
      <p>or click to browse</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
      />
    </div>
  );
}

export default UploadZone;
