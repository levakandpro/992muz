// fix-tracks-disposition.mjs
// Одноразовый скрипт: проставляет Content-Disposition: attachment
// всем уже загруженным трекам в папке tracks/ бакета muz992-media.
// Запуск: node fix-tracks-disposition.mjs

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const ACCOUNT_ID = 'ВСТАВЬ_СЮДА_ACCOUNT_ID';
const ACCESS_KEY_ID = 'ВСТАВЬ_СЮДА_ACCESS_KEY_ID';
const SECRET_ACCESS_KEY = 'ВСТАВЬ_СЮДА_SECRET_ACCESS_KEY';
const BUCKET = 'muz992-media';
const PREFIX = 'tracks/';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

function safeName(name) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-120);
}

async function run() {
  let continuationToken = undefined;
  let fixed = 0;
  let skipped = 0;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: PREFIX,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of list.Contents || []) {
      const key = obj.Key;
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );

      if (head.ContentDisposition) {
        skipped++;
        continue;
      }

      const originalName = safeName(key.split('/').pop());

      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          Key: key,
          CopySource: `${BUCKET}/${encodeURIComponent(key)}`,
          MetadataDirective: 'REPLACE',
          ContentType: head.ContentType || 'audio/mpeg',
          ContentDisposition: `attachment; filename="${originalName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
        })
      );

      fixed++;
      console.log(`✔ ${key}`);
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\nГотово. Исправлено: ${fixed}, пропущено (уже было): ${skipped}`);
}

run().catch((err) => {
  console.error('Ошибка:', err);
  process.exit(1);
});