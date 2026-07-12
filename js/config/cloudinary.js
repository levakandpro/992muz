// js/config/cloudinary.js

// Старый аккаунт — только для чтения старых файлов
const CLOUDINARY_OLD = {
  cloudName: 'dafzhubhq',
  baseUrl: 'https://res.cloudinary.com/dafzhubhq',
};

// Новый аккаунт — для всех новых загрузок
const CLOUDINARY_CONFIG = {
  cloudName: 'waamiohc',
  uploadPreset: '992Muz',
  folders: {
    tracks: 'pamir-music/tracks',
    covers: 'pamir-music/covers',
    avatars: 'pamir-music/avatars',
  },
  baseUrl: 'https://res.cloudinary.com/waamiohc',
};
/**
 * Получить URL аудио трека
 * @param {string} publicId - публичный ID файла в Cloudinary
 */
function getTrackUrl(publicId) {
  return `${CLOUDINARY_CONFIG.baseUrl}/video/upload/${publicId}`;
}

/**
 * Получить URL обложки (с авто-оптимизацией)
 * @param {string} publicId
 * @param {number} size - размер в пикселях (по умолчанию 300)
 */
function getCoverUrl(publicId, size = 300) {
  return `${CLOUDINARY_CONFIG.baseUrl}/image/upload/w_${size},h_${size},c_fill,q_auto,f_auto/${publicId}`;
}

/**
 * Получить URL аватара пользователя
 * @param {string} publicId
 * @param {number} size
 */
function getAvatarUrl(publicId, size = 150) {
  return `${CLOUDINARY_CONFIG.baseUrl}/image/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto/${publicId}`;
}

export { CLOUDINARY_CONFIG, getTrackUrl, getCoverUrl, getAvatarUrl };
