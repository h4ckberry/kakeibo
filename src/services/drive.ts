import type { drive_v3 } from 'googleapis';
import { google } from 'googleapis';
import type { ReceiptImage, ReceiptImageMimeType } from '../types';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
const RECEIPT_IMAGE_FIELDS = 'nextPageToken, files(id, name, mimeType)';

export interface DriveOptions {
  drive?: drive_v3.Drive;
}

export interface MoveFileOptions extends DriveOptions {
  inboxFolderId: string;
  processedFolderId: string;
}

export function getDriveClient(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    scopes: DRIVE_SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

function buildReceiptImagesQuery(folderId: string): string {
  const mimeTypeQuery = IMAGE_MIME_TYPES.map(
    (mimeType) => `mimeType = '${mimeType}'`,
  ).join(' or ');

  return `'${folderId}' in parents and trashed = false and (${mimeTypeQuery})`;
}

function isReceiptImageMimeType(
  mimeType: string | null | undefined,
): mimeType is ReceiptImageMimeType {
  return IMAGE_MIME_TYPES.some(
    (receiptMimeType) => receiptMimeType === mimeType,
  );
}

function toReceiptImage(file: drive_v3.Schema$File): ReceiptImage | null {
  if (!file.id || !file.name || !isReceiptImageMimeType(file.mimeType)) {
    return null;
  }

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
  };
}

export async function getReceiptImages(
  folderId: string,
  options: DriveOptions = {},
): Promise<ReceiptImage[]> {
  const drive = options.drive ?? getDriveClient();
  const receiptImages: ReceiptImage[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: buildReceiptImagesQuery(folderId),
      fields: RECEIPT_IMAGE_FIELDS,
      pageSize: 100,
      pageToken,
    });

    const files = response.data.files ?? [];
    for (const file of files) {
      const receiptImage = toReceiptImage(file);
      if (receiptImage) {
        receiptImages.push(receiptImage);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return receiptImages;
}

export async function downloadImageBuffer(
  fileId: string,
  options: DriveOptions = {},
): Promise<Buffer> {
  const drive = options.drive ?? getDriveClient();
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    {
      responseType: 'arraybuffer',
    },
  );
  const imageData = response.data as unknown as ArrayBuffer;

  return Buffer.from(imageData);
}

export async function moveFileToProcessed(
  fileId: string,
  options: MoveFileOptions,
): Promise<drive_v3.Schema$File> {
  const drive = options.drive ?? getDriveClient();
  const response = await drive.files.update({
    fileId,
    addParents: options.processedFolderId,
    removeParents: options.inboxFolderId,
    fields: 'id, parents',
  });

  return response.data;
}
