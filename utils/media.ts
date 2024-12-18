import dotenv from 'dotenv';
import cloudinary from 'cloudinary';
dotenv.config();

const cloud = cloudinary.v2;
const uploader = cloud.uploader;

interface ImageFile {
  mimetype: string;
  buffer: Buffer;
}

const convertImageFileToBase64 = (imageFile: ImageFile) => {
  const base64Image = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;
  return base64Image;
}

export const uploadAvatar = async (imageFile: ImageFile, userId: string) => {
  const image = convertImageFileToBase64(imageFile);

  const thumbnailPromise = uploader.upload(image, {
    upload_preset: 'public_avatars_thumbnail',
    public_id: `avatars/${userId}/thumbnail`,
    overwrite: true,
    asset_folder: `user-${userId}/avatars`,
    use_asset_folder_as_public_id_prefix: false
  })
  const originalPromise = uploader.upload(image, {
    upload_preset: 'public_avatars',
    public_id: `avatars/${userId}`,
    overwrite: true,
    asset_folder: `user-${userId}/avatars`,
    use_asset_folder_as_public_id_prefix: false
  })

  const [{ secure_url: thumbnailUrl }, { secure_url: originalUrl }] = await Promise.all([thumbnailPromise, originalPromise]);

  return {
    thumbnailUrl,
    originalUrl
  };
}

export const uploadAttachments = async ({ conversationId, messageId, files }: { conversationId: string, messageId: string, files: Express.Multer.File[] }) => {
  const uploadPromises = [] as Promise<cloudinary.UploadApiResponse>[];

  files.forEach((file, i) => {
    const image = convertImageFileToBase64(file);
    const promise = uploader.upload(image, {
      upload_preset: 'upload_attachments',
      public_id: `attachment/${messageId + `_${i + 1}`}`,
      overwrite: true,
      asset_folder: `conversations-${conversationId}/message-${messageId}`,
      use_asset_folder_as_public_id_prefix: false
    })
    uploadPromises.push(promise);
  })

  const data = await Promise.all(uploadPromises);

  return data.map((d) => ({
    originalUrl: d.secure_url,
    previewUrl: d.eager[0].secure_url as string
  }));
}
