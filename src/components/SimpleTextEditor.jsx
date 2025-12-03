import React, { useState, useRef, useEffect } from 'react';
import { api } from '../utils/axios';

const SimpleTextEditor = ({
    value,
    onChange,
    placeholder = "Type your answer here...",
    readOnly = false,
    disabled = false,
    onImageDelete = null,
    maxImages = 4,
    maxImageKB = 50,
    maxTotalKB = 72
}) => {
    const [uploading, setUploading] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [images, setImages] = useState([]);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [hoverUrl, setHoverUrl] = useState(null);
    const [uploadedBytes, setUploadedBytes] = useState(0);
    const fileInputRef = useRef(null);

    // Extract images from the value and update images state
    const extractImages = (text) => {
        if (!text) return [];
        console.log('Extracting images from text:', text);
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
        const matches = [];
        let match;
        while ((match = imgRegex.exec(text)) !== null) {
            console.log('Found image match:', match[1]);
            matches.push({
                url: match[1],
                fullTag: match[0]
            });
        }
        console.log('Extracted images:', matches);
        return matches;
    };

    // Remove image tags from text to show clean text in textarea
    const getCleanText = (text) => {
        if (!text) return '';
        // Remove any image tags and strip accidental leading newlines
        return text.replace(/<img[^>]*>/g, '').replace(/^\n+/, '');
    };

    // Update local state when value prop changes
    useEffect(() => {
        const extractedImages = extractImages(value || '');
        setImages(extractedImages);
        setTextContent(getCleanText(value || ''));
        // We cannot infer file sizes from URLs; reset session tracker
        setUploadedBytes(0);
    }, [value]);

    // Lock body scroll and close on Esc while preview is open
    useEffect(() => {
        if (!previewUrl) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') setPreviewUrl(null); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [previewUrl]);

    // Handle image deletion
    const handleImageDelete = (imageUrl) => {
        console.log('=== IMAGE DELETION DEBUG ===');
        console.log('Deleting image URL:', imageUrl);
        console.log('Current value:', value);
        console.log('Current images array:', images);
        
        if (!onChange) {
            console.log('ERROR: No onChange function provided');
            return;
        }
        
        // Find the image in our images array
        const imageToRemove = images.find(img => img.url === imageUrl);
        console.log('Image to remove:', imageToRemove);
        
        if (!imageToRemove) {
            console.log('ERROR: Image not found in images array');
            return;
        }
        
        // Remove the image tag from the text
        let updatedText = value || '';
        console.log('Original text length:', updatedText.length);
        
        // Try removing the full tag first
        updatedText = updatedText.replace(imageToRemove.fullTag, '');
        console.log('After removing full tag:', updatedText);
        console.log('Text changed after full tag removal:', updatedText !== value);
        
        // If that didn't work, try regex approach
        if (updatedText === value) {
            console.log('Full tag removal failed, trying regex...');
            const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            console.log('Escaped URL:', escapedUrl);
            
            const regex = new RegExp(`<img[^>]*src="${escapedUrl}"[^>]*>`, 'g');
            console.log('Regex pattern:', regex);
            
            updatedText = updatedText.replace(regex, '');
            console.log('After regex removal:', updatedText);
        }
        
        // Clean up any extra whitespace
        updatedText = updatedText.replace(/\n\s*\n/g, '\n').trim();
        
        console.log('Final updated text:', updatedText);
        console.log('Final text length:', updatedText.length);
        console.log('Text actually changed:', updatedText !== value);
        console.log('=== END DEBUG ===');
        
        if (updatedText !== value) {
            onChange(updatedText);
        } else {
            console.log('ERROR: No change detected, deletion failed');
        }
    };

    // Handle text change
    const handleTextChange = (e) => {
        const newText = e.target.value;
        setTextContent(newText);
        
        if (onChange) {
            // Combine images with new text without adding an unnecessary leading newline
            const imageTags = images.map(img => img.fullTag).join('\n');
            const combinedText = images.length > 0
                ? imageTags + (newText ? '\n' + newText : '')
                : newText;
            onChange(combinedText);
        }
    };

    // Handle image upload
    const handleImageUpload = async (file) => {
        if (!file) return;

        // Enforce max image count per answer
        if (images.length >= maxImages) {
            alert(`You can upload up to ${maxImages} images per answer.`);
            return;
        }

        // Validate file size (configurable)
        const maxSizeBytes = maxImageKB * 1024;
        if (file.size > maxSizeBytes) {
            alert(`Image size must be less than ${maxImageKB}KB. Current size: ${Math.round(file.size / 1024)}KB`);
            return;
        }

        // Enforce total combined size across this typing session
        const maxTotalBytes = maxTotalKB * 1024;
        if (uploadedBytes + file.size > maxTotalBytes) {
            const remainingKB = Math.max(0, Math.floor((maxTotalBytes - uploadedBytes) / 1024));
            alert(`Total image size limit reached (${maxTotalKB}KB). You can upload ~${remainingKB}KB more.`);
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);

            // Debug: Check authentication
            const token = localStorage.getItem('accessToken') || 'No token found';
            console.log('Upload attempt - Token available:', !!token);
            console.log('File details:', { name: file.name, size: file.size, type: file.type });

            const response = await api.post('/upload/image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data && response.data.url) {
                // Insert image into text
                const currentValue = value || '';
                const imageTag = `<img src="${response.data.url}" alt="Uploaded image" loading="lazy" style="max-width: 100%; height: auto; margin: 8px 0;" />`;
                const newValue = currentValue + (currentValue ? '\n' : '') + imageTag;
                onChange(newValue);
                setUploadedBytes(prev => prev + file.size);
                // The useEffect will handle updating the local state
            } else {
                throw new Error('No URL returned from server');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            alert(`Failed to upload image: ${error.message}. Please check if the upload API is working.`);
        } finally {
            setUploading(false);
        }
    };

    // Handle file input change
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file);
        }
        // Reset input
        e.target.value = '';
    };

    // Handle paste events
    const handlePaste = (e) => {
        if (readOnly) return;

        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData || !clipboardData.items) return;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageUpload(file);
                }
                return;
            }
        }
    };

    // Handle image deletion in read-only mode
    const handleImageClick = (e) => {
        if (readOnly && onImageDelete && e.target.tagName === 'IMG') {
            const url = e.target.src;
            if (confirm('Delete this image?')) {
                onImageDelete(url);
            }
        }
    };

    if (readOnly) {
        return (
            <div className="space-y-3">
                {/* Image Previews with Delete Buttons for Staff */}
                {images.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Answer Images:</div>
                        <div className="flex flex-wrap gap-2">
                            {images.map((image, index) => (
                                <div
                                    key={index}
                                    className="relative group"
                                    onMouseEnter={() => setHoverUrl(image.url)}
                                    onMouseLeave={() => setHoverUrl(null)}
                                >
                                    <img
                                        src={image.url}
                                        alt={`Answer image ${index + 1}`}
                                        className="w-20 h-20 object-cover rounded border border-gray-300 cursor-zoom-in"
                                        onClick={() => { setPreviewLoading(true); setPreviewUrl(image.url); }}
                                    />
                                    {onImageDelete && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('Delete button clicked for image URL:', image.url);
                                                if (confirm('Delete this image from the answer?')) {
                                                    onImageDelete(image.url);
                                                }
                                            }}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors cursor-pointer z-10"
                                            title="Delete image"
                                            type="button"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Text Content */}
                <div
                    className="p-3 border rounded-lg bg-gray-50 min-h-[100px]"
                    dangerouslySetInnerHTML={{ __html: getCleanText(value || '') }}
                    style={{ cursor: 'default' }}
                />

                {/* Preview Modal */}
                {/* Hover Preview: large image without backdrop */}
                {hoverUrl && (
                    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
                        <img src={hoverUrl} alt="Preview" loading="lazy" className="w-[60vw] h-[60vh] object-contain shadow-2xl rounded" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Image Previews */}
            {images.length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">Uploaded Images:</div>
                    <div className="flex flex-wrap gap-2">
                        {images.map((image, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={image.url}
                                    alt={`Uploaded image ${index + 1}`}
                                    className="w-20 h-20 object-cover rounded border border-gray-300"
                                />
                                {!readOnly && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Delete button clicked for:', image.url);
                                            handleImageDelete(image.url);
                                        }}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors cursor-pointer z-10"
                                        title="Delete image"
                                        type="button"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Text Input */}
            <textarea
                value={textContent}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder={placeholder}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[200px] resize-vertical whitespace-pre overflow-x-auto"
                wrap="off"
                disabled={uploading || disabled}
            />

            {/* Image Upload Button */}
            <div className="flex items-center gap-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || disabled}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                    📷 Upload Image
                </button>
                <span className="text-sm text-gray-500">
                    Max {maxImages} images, total ≤ {maxTotalKB}KB (≤ {maxImageKB}KB each). Paste supported (Ctrl+V).
                </span>
            </div>

            {/* Upload Status */}
            {uploading && (
                <div className="text-blue-600 text-sm">
                    Uploading image...
                </div>
            )}
        </div>
    );
};

export default SimpleTextEditor;
