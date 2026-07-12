// js/auth/session.js
import { auth } from "../config/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Страницы только для авторизованных
const PROTECTED_PAGES = ["profile.html", "artist-profile.html"];
// Страницы только для НЕавторизованных
const AUTH_PAGES = ["login.html", "register.html"];

const currentPage = window.location.pathname.split("/").pop();

// Слушаем состояние авторизации
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Пользователь вошёл
    if (AUTH_PAGES.includes(currentPage)) {
      window.location.href = "index.html";
    }
    updateNavbar(user);
  } else {
    // Не авторизован
    if (PROTECTED_PAGES.includes(currentPage)) {
      window.location.href = "login.html";
    }
    updateNavbar(null);
  }
  bindLogoutButtons();
});

// Обновить навбар (аватар / кнопки входа)
function updateNavbar(user) {
  const loginBtn = document.getElementById("navLoginBtn");
  const registerBtn = document.getElementById("navRegisterBtn");
  const profileBtn = document.getElementById("navProfileBtn");
  const logoutBtn = document.getElementById("navLogoutBtn");

  const mobileLoginBtn = document.getElementById("mobileLoginBtn");
  const mobileProfileBtn = document.getElementById("mobileProfileBtn");
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");

  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (registerBtn) registerBtn.style.display = "none";
    if (profileBtn) {
      profileBtn.style.display = "flex";
      profileBtn.href = "artist-profile.html";
    }
    if (logoutBtn) logoutBtn.style.display = "flex";

    if (mobileLoginBtn) mobileLoginBtn.style.display = "none";
    if (mobileProfileBtn) mobileProfileBtn.style.display = "flex";
    if (mobileLogoutBtn) mobileLogoutBtn.style.display = "flex";
  } else {
    if (loginBtn) loginBtn.style.display = "flex";
    if (registerBtn) registerBtn.style.display = "flex";
    if (profileBtn) profileBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";

    if (mobileLoginBtn) mobileLoginBtn.style.display = "flex";
    if (mobileProfileBtn) mobileProfileBtn.style.display = "none";
    if (mobileLogoutBtn) mobileLogoutBtn.style.display = "none";
  }
}

// Выход
async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Ошибка выхода:", err);
  } finally {
    // Жёсткая перезагрузка вместо просто redirect —
    // гарантирует полный сброс состояния auth/кэша на странице
    window.location.href = "index.html";
    window.location.reload();
  }
}

// Привязка кнопок выхода к функции logout()
function bindLogoutButtons() {
  const ids = ["navLogoutBtn", "mobileLogoutBtn"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn && !btn._logoutBound) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
      btn._logoutBound = true;
    }
  });
}

// Получить текущего пользователя
function getCurrentUser() {
  return auth.currentUser;
}

export { logout, getCurrentUser, updateNavbar, bindLogoutButtons };