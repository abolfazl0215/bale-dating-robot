const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

const uploadImageFromUrl = async (imageUrl, options = {}) => {
  // ۱. تعیین نام فایل و مسیر ذخیره‌سازی
  const fileName = `${Date.now()}-${uuidv4()}.jpg`;
  const uploadDir = path.join(__dirname, "..", "public", "uploads"); // مسیر پوشه آپلود
  const filePath = path.join(uploadDir, fileName);

  // ایجاد پوشه اگر وجود نداشته باشد
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // تنظیمات پیش‌فرض برای فشردگی
  const defaultOptions = {
    quality: 80,
    width: 800,
    height: 800,
    format: "jpeg",
  };

  const config = { ...defaultOptions, ...options };

  try {
    // ۲. دانلود تصویر به صورت باینری
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // ۳. پردازش و فشردگی با Sharp
    console.time("compress");
    const compressedImageBuffer = await sharp(
      Buffer.from(response.data),
    )
      .resize({
        width: config.width,
        height: config.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: config.quality,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();
    console.timeEnd("compress");

    // ۴. ذخیره فایل در سیستم با استفاده از fs
    fs.writeFileSync(filePath, compressedImageBuffer);
    console.log(`File saved to: ${filePath}`);

    // ۵. بازگرداندن لینک مستقیم (فرض بر این است که سرور شما روی پورت مثلاً ۳۰۰۰ است)
    // اگر از اکسپرس استفاده می‌کنید، باید پوشه public را استاتیک کنید
    // مثال: app.use(express.static('public'));
    const publicUrl = `./public/uploads/${fileName}`;

    // اگر می‌خواهید آدرس کامل با دامنه برگردانده شود:
    // const fullUrl = `https://yourdomain.com/${publicUrl}`;

    return publicUrl;
  } catch (error) {
    console.error("خطا در پردازش و ذخیره تصویر:", error.message);
    throw error;
  }
};

module.exports = {
  uploadImageFromUrl,
};

// ///////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////

// const {
//   S3Client,
//   PutObjectCommand,
//   GetObjectCommand,
//   ListObjectsV2Command,
// } = require("@aws-sdk/client-s3");

// const { default: axios } = require("axios");
// const sharp = require("sharp");
// const { v4: uuidv4 } = require("uuid");

// const uploadImageFromUrl = async (imageUrl, options = {}) => {
//   const fileName = `${Date.now()}-${uuidv4()}.jpg`;
//   console.log({ fileName });

//   // تنظیمات پیش‌فرض برای فشردگی
//   const defaultOptions = {
//     quality: 80, // کیفیت JPEG (1-100)
//     width: 800, // حداکثر عرض
//     height: 800, // حداکثر ارتفاع
//     format: "jpeg", // فرمت خروجی
//   };

//   const ENDPOINT = "https://minio-cr5iu1.chbk.dev";
//   const ACCESS_KEY = "JjuKsC58shhxKJcEvsm7UWzaNVwsMKb5";
//   const SECRET_KEY = "plebQIzTxSRjo4avrVTH0hUeXSLBXYkO";
//   const BUCKET_NAME = "pounes";

//   const config = { ...defaultOptions, ...options };

//   // const client = new S3Client({
//   //   region: "default",
//   //   endpoint: ENDPOINT,
//   //   credentials: {
//   //     accessKeyId: ACCESS_KEY,
//   //     secretAccessKey: SECRET_KEY,
//   //   },
//   // });

//   const client = new S3Client({
//     region: "default", // یا اگر سرویس‌دهنده خاصی است 'us-east-1'
//     endpoint: ENDPOINT,
//     forcePathStyle: true, // این خط کلید اصلی مشکل شماست
//     credentials: {
//       accessKeyId: ACCESS_KEY,
//       secretAccessKey: SECRET_KEY,
//     },
//   });

//   try {
//     // دانلود تصویر به صورت باینری
//     // console.time("downloadImage");
//     const response = await axios.get(imageUrl, {
//       responseType: "arraybuffer",
//     });
//     // console.timeEnd("downloadImage");

//     console.log({ res: response.data });

//     // فشردگی و بهینه‌سازی تصویر با Sharp
//     console.time("compress");
//     const compressedImageBuffer = await sharp(
//       Buffer.from(response.data),
//     )
//       .resize({
//         width: config.width,
//         height: config.height,
//         fit: "inside", // حفظ نسبت ابعاد
//         withoutEnlargement: true, // عدم بزرگ‌نمایی تصاویر کوچک
//       })
//       .jpeg({
//         quality: config.quality,
//         progressive: true, // بارگذاری تدریجی
//         mozjpeg: true, // استفاده از موتور mozjpeg برای فشردگی بهتر
//       })
//       .toBuffer();
//     console.timeEnd("compress");

//     const params = {
//       Body: compressedImageBuffer,
//       Bucket: BUCKET_NAME,
//       Key: fileName,
//     };

//     try {
//       await client.send(new PutObjectCommand(params));
//     } catch (error) {
//       console.log(error);
//     }

//     return `https://minio-cr5iu1.chbk.dev/pounes/${fileName}`;
//   } catch (error) {
//     console.error("خطا در آپلود تصویر از URL:", error);
//     throw error;
//   }
// };

// module.exports = {
//   uploadImageFromUrl,
// };
