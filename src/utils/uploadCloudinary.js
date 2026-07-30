const cloudinary = require("../config/cloudinary");

function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

async function removerImagem(
  publicId
) {
  const id =
    String(
      publicId || ""
    ).trim();

  if (!id) {
    return null;
  }

  return cloudinary
    .uploader
    .destroy(
      id,
      {
        resource_type:
          "image",
        invalidate:
          true,
      }
    );
}

uploadToCloudinary.remover =
  removerImagem;

module.exports = uploadToCloudinary;
