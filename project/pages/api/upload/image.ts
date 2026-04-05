import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📸 Image upload request received');

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Parse the form data
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      filter: ({ mimetype }) => {
        return !!(mimetype && mimetype.startsWith('image/'));
      },
    });

    const [fields, files] = await form.parse(req);
    
    // Get the uploaded file
    const uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate unique filename
    const fileExtension = path.extname(uploadedFile.originalFilename || '');
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const newFilePath = path.join(uploadsDir, uniqueFilename);

    // Move file to final location
    fs.renameSync(uploadedFile.filepath, newFilePath);

    // Generate public URL using the API route
    const publicUrl = `/api/uploads/${uniqueFilename}`;
    const publicDirectUrl = `/api/public-uploads/${uniqueFilename}`;
    
    console.log('✅ Image uploaded successfully:', {
      originalName: uploadedFile.originalFilename,
      newName: uniqueFilename,
      size: uploadedFile.size,
      url: publicUrl
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        filename: uniqueFilename,
        originalName: uploadedFile.originalFilename,
        size: uploadedFile.size,
        url: publicUrl,
        publicUrl: publicDirectUrl,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    return res.status(500).json({ 
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
