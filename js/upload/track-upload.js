// js/upload/track-upload.js
import { CLOUDINARY_CONFIG, getTrackUrl, getCoverUrl } from '../config/cloudinary.js';

/**
 * Универсальная загрузка файла в Cloudinary
 * @param {File} file - файл для загрузки
 * @param {string} folder - папка в Cloudinary (из CLOUDINARY_CONFIG.folders)
 * @param {Function} onProgress - колбек прогресса (0-100)
 * @returns {Promise<object>} - данные загруженного файла
 */
async function uploadToCloudinary(file, folder, onProgress = null) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', folder);

  // Тип ресурса: видео для аудио, image для изображений
  const resourceType = file.type.startsWith('audio') ? 'video' : 'image';
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Прогресс загрузки
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data);
      } else {
        reject(new Error(`Ошибка загрузки: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Ошибка сети')));
    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Загрузить трек (mp3/wav/flac)
 * @param {File} audioFile
 * @param {File|null} coverFile - обложка (необязательно)
 * @param {object} meta - { title, artist, album, genre }
 * @param {Function} onProgress - колбек прогресса
 * @returns {Promise<object>} - { trackUrl, coverUrl, publicId, duration }
 */
async function uploadTrack(audioFile, coverFile = null, meta = {}, onProgress = null) {
  // Валидация
const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4', ''];
  if (audioFile.type && !allowedAudio.includes(audioFile.type)) {
    throw new Error('Неподдерживаемый формат. Используй MP3.');
  }

  const maxSize = 50 * 1024 * 1024; // 50 MB
  if (audioFile.size > maxSize) {
    throw new Error('Файл слишком большой. Максимум 50 МБ.');
  }

  const results = {};

  // 1. Загрузка обложки (если есть)
  if (coverFile) {
    try {
      onProgress && onProgress(0, 'cover');
      const coverData = await uploadToCloudinary(
        coverFile,
        CLOUDINARY_CONFIG.folders.covers,
        (p) => onProgress && onProgress(p, 'cover')
      );
      results.coverPublicId = coverData.public_id;
      results.coverUrl = getCoverUrl(coverData.public_id);
    } catch (err) {
      console.warn('Ошибка загрузки обложки:', err);
    }
  }

  // 2. Загрузка трека
  onProgress && onProgress(0, 'track');
  const trackData = await uploadToCloudinary(
    audioFile,
    CLOUDINARY_CONFIG.folders.tracks,
    (p) => onProgress && onProgress(p, 'track')
  );

  results.trackPublicId = trackData.public_id;
  results.trackUrl = getTrackUrl(trackData.public_id);
  results.duration = trackData.duration || 0;
  results.format = trackData.format;
  results.bytes = trackData.bytes;

  // 3. Данные для сохранения в Firebase
  results.firestoreData = {
    title: meta.title || audioFile.name.replace(/\.[^/.]+$/, ''),
    artist: meta.artist || '',
    album: meta.album || '',
    genre: meta.genre || '',
    trackUrl: results.trackUrl,
    trackPublicId: results.trackPublicId,
    coverUrl: results.coverUrl || null,
    coverPublicId: results.coverPublicId || null,
    duration: results.duration,
    format: results.format,
    bytes: results.bytes,
    uploadedAt: new Date().toISOString(),
addedAt: new Date(),
plays: 0,
likes: 0,
  };

  return results;
}

/**
 * Загрузить аватар пользователя
 * @param {File} imageFile
 * @param {Function} onProgress
 */
async function uploadAvatar(imageFile, onProgress = null) {
  const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedImages.includes(imageFile.type)) {
    throw new Error('Используй JPG, PNG или WebP.');
  }

const maxSize = 5 * 1024 * 1024;
  if (imageFile.size > maxSize) {
    throw new Error('Фото слишком большое. Максимум 5 МБ.');
  }

  const data = await uploadToCloudinary(
    imageFile,
    CLOUDINARY_CONFIG.folders.avatars,
    onProgress
  );

  return {
    publicId: data.public_id,
    url: `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/w_150,h_150,c_fill,g_face,q_auto,f_auto/${data.public_id}`,
  };
}

export { uploadTrack, uploadAvatar, uploadToCloudinary };
