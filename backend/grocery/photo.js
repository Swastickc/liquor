import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
export async function uploadGroceryPhoto(image) {
  if (
    typeof image !== "string" ||
    image.length > 2100000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
  )
    throw new Error("Invalid image");
  const bytes = Buffer.from(image.split(",")[1], "base64");
  if (bytes.length > 1500000) throw new Error("Image too large");
  const safe = await sharp(bytes, { limitInputPixels: 20000000 })
    .rotate()
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const uploaded = await cloudinary.uploader.upload(
    `data:image/webp;base64,${safe.toString("base64")}`,
    { folder: "kalna-grocery", resource_type: "image" },
  );
  return uploaded.secure_url;
}
