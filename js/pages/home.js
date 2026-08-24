// Бегущая строка радио
const radioName = document.querySelector('.radio-track-name.lg');
if (radioName && radioName.scrollWidth > 180) {
  radioName.classList.add('long');
}

// Светлячки на canvas
const canvas = document.getElementById('heroCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
resize();
window.addEventListener('resize', resize);

// На слабых устройствах рисуем меньше точек — визуально почти незаметно,
// а нагрузка на отрисовку заметно ниже
const PARTICLE_COUNT = (window.isLowPowerDevice) ? 25 : 55;

const particles = Array.from({length: PARTICLE_COUNT}, (_, i) => ({
  x: (i / PARTICLE_COUNT) * canvas.width + (Math.random() - 0.5) * 100,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.8 + 0.4,
  vx: (Math.random() - 0.5) * 0.3,
  vy: (Math.random() - 0.5) * 0.3,
  opacity: Math.random(),
  opacityDir: Math.random() * 0.008 + 0.003,
}));

let heroCanvasVisible = true;
let heroCanvasRunning = false;
let heroCanvasFrameId = null;

function draw() {
  if (!heroCanvasVisible || document.hidden) { heroCanvasRunning = false; return; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.opacity += p.opacityDir;
    if (p.opacity <= 0 || p.opacity >= 1) p.opacityDir *= -1;
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.6})`;
    ctx.fill();
  });
  heroCanvasFrameId = requestAnimationFrame(draw);
}

function startHeroCanvas() {
  if (heroCanvasRunning) return;
  heroCanvasRunning = true;
  draw();
}
function stopHeroCanvas() {
  heroCanvasRunning = false;
  if (heroCanvasFrameId) cancelAnimationFrame(heroCanvasFrameId);
}

// Рисуем, только пока блок реально виден на экране — как только пользователь
// проскроллил вниз, анимация останавливается и не тратит батарею/CPU впустую
if ('IntersectionObserver' in window) {
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      heroCanvasVisible = entry.isIntersecting;
      if (heroCanvasVisible) startHeroCanvas();
      else stopHeroCanvas();
    });
  }, { threshold: 0.1 });
  heroObserver.observe(canvas.parentElement);
} else {
  startHeroCanvas();
}

// Пауза на свёрнутой вкладке — доп. экономия
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopHeroCanvas();
  else if (heroCanvasVisible) startHeroCanvas();
});