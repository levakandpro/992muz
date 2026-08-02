// js/config/r2.js

const R2_CONFIG = {
  workerUrl: 'https://white-fog-aa2c992muzmedia.levakandproduction.workers.dev',
  uploadSecret: 'ВСТАВЬ_СЮДА_ЗНАЧЕНИЕ_UPLOAD_SECRET', // см. Worker → Settings → Variables → UPLOAD_SECRET
  folders: {
    tracks: 'tracks',
    covers: 'covers',
    avatars: 'avatars',
  },
  cdnBase: 'https://cdn.992muz.ru',
};

function getTrackUrl(key) {
  return `${R2_CONFIG.cdnBase}/${key}`;
}

function getCoverUrl(key) {
  return `${R2_CONFIG.cdnBase}/${key}`;
}

function getAvatarUrl(key) {
  return `${R2_CONFIG.cdnBase}/${key}`;
}

export { R2_CONFIG, getTrackUrl, getCoverUrl, getAvatarUrl };