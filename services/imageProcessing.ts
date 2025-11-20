
export const preprocessImageForAI = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw original image
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Simple image processing: Grayscale + High Contrast Thresholding
            // This helps removing light furniture and highlighting walls
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Grayscale
                const avg = 0.299 * r + 0.587 * g + 0.114 * b;

                // Thresholding: If it's not dark (wall), make it white. 
                // If it is dark, make it black.
                // Threshold value 200 cleans up light grey noise.
                const threshold = 210; 
                const val = avg < threshold ? 0 : 255;

                data[i] = val;     // R
                data[i + 1] = val; // G
                data[i + 2] = val; // B
                // Alpha (data[i+3]) remains unchanged
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (err) => reject(err);
        img.src = imageUrl;
    });
};
