// Volume control
const volumeBar = document.getElementById('volumeBar');
const volumeFill = document.getElementById('volumeFill');
const volumeIcon = document.getElementById('volumeIcon');
let muted = false;
let lastVol = 0.7;

if (volumeBar) {
  volumeBar.addEventListener('click', function(e) {
    const rect = volumeBar.getBoundingClientRect();
    const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    lastVol = vol;
    muted = false;
    volumeFill.style.width = (vol * 100) + '%';
    volumeIcon.src = vol === 0 ? 'assets/icons/mute.png' : 'assets/icons/volume.png';
  });
}

if (volumeIcon) {
  volumeIcon.addEventListener('click', function() {
    muted = !muted;
    volumeFill.style.width = muted ? '0%' : (lastVol * 100) + '%';
    volumeIcon.src = muted ? 'assets/icons/mute.png' : 'assets/icons/volume.png';
  });
}