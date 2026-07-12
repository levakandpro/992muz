// js/auth/login.js
import { auth } from "../config/firebase.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db } from "../config/firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const submitBtn = document.getElementById("loginSubmitBtn");
const errorMsg = document.getElementById("loginError");
const googleBtn = document.getElementById("googleLoginBtn");
const forgotBtn = document.getElementById("forgotPasswordBtn");

// Вход через email/пароль
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "index.html";
  } catch (err) {
    console.error('[Email login] ОШИБКА:', err.code, err.message);
    showError(getErrorMessage(err.code));
  } finally {
    setLoading(false);
  }
});

// Вход через Google
googleBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('[Google login] uid:', result.user.uid, 'email:', result.user.email);
    await ensureUserDoc(result.user);
    window.location.href = "index.html";
  } catch (err) {
    console.error('[Google login] ОШИБКА:', err.code, err.message);
    showError(getErrorMessage(err.code));
  }
});
// Создаёт документ в Firestore users/{uid}, если его ещё нет
async function ensureUserDoc(user) {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        avatarUrl: user.photoURL || "",
        role: "user",
        deleted: false,
        followersCount: 0,
        followingCount: 0,
        tracksCount: 0,
        videosCount: 0,
        createdAt: serverTimestamp(),
      });
      console.log('[ensureUserDoc] СОЗДАН новый документ для', user.uid);
    } else {
      console.log('[ensureUserDoc] документ уже существует для', user.uid);
    }
  } catch (err) {
    console.error('[ensureUserDoc] ОШИБКА:', err.code, err.message);
  }
}
// Сброс пароля
forgotBtn?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    showError("Введи email для сброса пароля");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showSuccess("Письмо отправлено! Проверь почту.");
  } catch (err) {
    showError(getErrorMessage(err.code));
  }
});

function setLoading(state) {
  if (submitBtn) {
    submitBtn.disabled = state;
    submitBtn.classList.toggle("loading", state);
    const textSpan = submitBtn.querySelector(".auth-submit-text");
    if (textSpan) textSpan.textContent = state ? "Входим..." : "Войти";
  }
}
function showError(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.className = "auth-message auth-message--error";
    errorMsg.style.display = "block";
  }
}

function showSuccess(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.className = "auth-message auth-message--success";
    errorMsg.style.display = "block";
  }
}

function clearError() {
  if (errorMsg) errorMsg.style.display = "none";
}

function getErrorMessage(code) {
const messages = {
    "auth/user-not-found": "Пользователь не найден",
    "auth/wrong-password": "Неверный пароль",
    "auth/invalid-email": "Неверный формат email",
    "auth/too-many-requests": "Слишком много попыток. Попробуй позже",
    "auth/user-disabled": "Аккаунт заблокирован",
    "auth/invalid-credential": "Неверный email или пароль",
    "auth/unauthorized-domain": "Этот домен не разрешён для входа. Обратись к администратору",
    "auth/popup-closed-by-user": "Окно входа было закрыто",
    "auth/popup-blocked": "Браузер заблокировал всплывающее окно. Разреши popup для этого сайта",
  };
  return messages[code] || "Ошибка входа. Попробуй снова";
}
