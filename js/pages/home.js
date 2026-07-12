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

const particles = Array.from({length: 55}, (_, i) => ({
  x: (i / 55) * canvas.width + (Math.random() - 0.5) * 100,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.8 + 0.4,
  vx: (Math.random() - 0.5) * 0.3,
  vy: (Math.random() - 0.5) * 0.3,
  opacity: Math.random(),
  opacityDir: Math.random() * 0.008 + 0.003,
}));

function draw() {
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
  requestAnimationFrame(draw);
}
draw();