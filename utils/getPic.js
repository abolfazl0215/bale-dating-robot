const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

module.exports.getPic = async (key) => {
  try {
    const ENDPOINT = "https://minio-sug43t.chbk.dev";
    const ACCESS_KEY = "B6AJN7fqbMd0h5RCAtEY1dMCwioXxt0O";
    const SECRET_KEY = "c8YsXiPVhMRY0ldgSwWX2N6etXhIgzbC";
    const BUCKET_NAME = "pounes";

    const client = new S3Client({
      region: "default",
      endpoint: ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: "B6AJN7fqbMd0h5RCAtEY1dMCwioXxt0O",
        secretAccessKey: "c8YsXiPVhMRY0ldgSwWX2N6etXhIgzbC",
      },
    });

    const command = new GetObjectCommand({
      Bucket: "pounes",
      Key: key,
    });

    const data = await client.send(command);

    // stream → buffer
    const chunks = [];
    for await (const chunk of data.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.log(error);
    return null;
  }
};
