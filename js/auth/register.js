// js/auth/register.js
import { auth, db } from "../config/firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("registerForm");
const nameInput = document.getElementById("registerName");
const emailInput = document.getElementById("registerEmail");
const passwordInput = document.getElementById("registerPassword");
const password2Input = document.getElementById("registerPassword2");
const submitBtn = document.getElementById("registerSubmitBtn");
const errorMsg = document.getElementById("registerError");
const googleBtn = document.getElementById("googleRegisterBtn");

// Регистрация через email/пароль
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const password2 = password2Input.value;

  // Валидация
  if (!name || name.length < 2) return showError("Введи имя (минимум 2 символа)");
  if (password !== password2) return showError("Пароли не совпадают");
  if (password.length < 6) return showError("Пароль минимум 6 символов");

  setLoading(true);

  try {
    // Создать аккаунт
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Установить displayName
    await updateProfile(user, { displayName: name });

    // Сохранить профиль в Firestore
    await saveUserProfile(user, name);

    window.location.href = "index.html";
  } catch (err) {
    showError(getErrorMessage(err.code));
  } finally {
    setLoading(false);
  }
});

// Регистрация через Google
googleBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserProfile(result.user, result.user.displayName || "Пользователь");
    window.location.href = "index.html";
  } catch (err) {
    showError(getErrorMessage(err.code));
  }
});
// Сохранить профиль в Firestore
async function saveUserProfile(user, name) {
  const userRef = doc(db, "users", user.uid);
  const username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 10);
  await setDoc(userRef, {
    uid: user.uid,
    displayName: name,
    username: username,
    email: user.email,
    avatarUrl: user.photoURL || null,
    avatarPublicId: null,
    bio: "",
    role: "user",
    createdAt: serverTimestamp(),
    tracksCount: 0,
    followersCount: 0,
    followingCount: 0,
  }, { merge: true });
}

function setLoading(state) {
  if (submitBtn) {
    submitBtn.disabled = state;
    submitBtn.textContent = state ? "Создаём аккаунт..." : "Зарегистрироваться";
  }
}

function showError(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
  }
}

function clearError() {
  if (errorMsg) errorMsg.style.display = "none";
}

function getErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "Этот email уже зарегистрирован",
    "auth/invalid-email": "Неверный формат email",
    "auth/weak-password": "Пароль слишком слабый",
    "auth/operation-not-allowed": "Регистрация временно недоступна",
  };
  return messages[code] || "Ошибка регистрации. Попробуй снова";
}

export { saveUserProfile };
