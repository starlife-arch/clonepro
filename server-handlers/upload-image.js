import cloudinaryPkg from 'cloudinary';
const { v2: cloudinary } = cloudinaryPkg;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function legacyHandler(req, context) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { image } = await req.json();
        if (!image) {
            return new Response(JSON.stringify({ error: 'No image data provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const uploadResult = await cloudinary.uploader.upload(image, {
            folder: 'starlife-assets'
        });

        return new Response(JSON.stringify({ url: uploadResult.secure_url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return new Response(JSON.stringify({ error: 'Failed to upload image to Cloudinary' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
