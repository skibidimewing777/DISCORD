const STORAGE_KEY = "zennedarchat-user";

const registerForm = document.getElementById("registerForm");
const registerUsername = document.getElementById("registerUsername");
const registerDisplayName = document.getElementById("registerDisplayName");

const existingUserRaw = localStorage.getItem(STORAGE_KEY);
if (existingUserRaw) {
  window.location.replace("/chat");
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = registerUsername.value.trim();
  const displayName = registerDisplayName.value.trim();
  if (!username) return;

  const normalized = (displayName || username).slice(0, 24);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      username: normalized,
      createdAt: new Date().toISOString(),
    })
  );

  window.location.href = "/chat";
});
