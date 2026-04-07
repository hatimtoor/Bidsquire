import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📸 Image upload request received');

    // Parse the form data into a temp dir
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      filter: ({ mimetype }) => {
        return !!(mimetype && mimetype.startsWith('image/'));
      },
    });

    const [, files] = await form.parse(req);

    const uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const fileExtension = path.extname(uploadedFile.originalFilename || '.jpg');
    const uniqueFilename = `uploads/${uuidv4()}${fileExtension}`;
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: uniqueFilename,
      Body: fileBuffer,
      ContentType: uploadedFile.mimetype || 'image/jpeg',
    }));

    // Clean up temp file
    fs.unlinkSync(uploadedFile.filepath);

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${uniqueFilename}`;

    console.log('✅ Image uploaded to R2:', {
      originalName: uploadedFile.originalFilename,
      key: uniqueFilename,
      size: uploadedFile.size,
      url: publicUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        filename: uniqueFilename,
        originalName: uploadedFile.originalFilename,
        size: uploadedFile.size,
        url: publicUrl,
        publicUrl,
        uploadedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
