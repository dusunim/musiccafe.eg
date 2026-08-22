const PASSWORD_HASHES = new Set([
  'b49b3c8010a255afb54000d06a803f0a0b9b5600987c5183495004a5bc5528f3',
  'd2cdfb5e1c2f841fc131e43af5e68939c6ba441fe7915e861c046c26541354b1',
]);
const gate = document.querySelector('#authGate');
const form = document.querySelector('#authForm');
const passwordInput = document.querySelector('#passwordInput');
const errorMessage = document.querySelector('#authError');
const togglePassword = document.querySelector('#togglePassword');

let resolveAuth;
window.authReady = new Promise((resolve) => { resolveAuth = resolve; });

function unlock() {
  document.body.classList.remove('locked');
  gate.classList.add('unlocked');
  gate.setAttribute('aria-hidden', 'true');
  sessionStorage.setItem('music-cafe-unlocked', 'true');
  resolveAuth();
  setTimeout(() => gate.remove(), 350);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

if (sessionStorage.getItem('music-cafe-unlocked') === 'true') {
  unlock();
} else {
  requestAnimationFrame(() => passwordInput.focus());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  errorMessage.textContent = '';
  try {
    if (PASSWORD_HASHES.has(await sha256(passwordInput.value))) {
      unlock();
      return;
    }
    errorMessage.textContent = '암호가 올바르지 않습니다.';
    passwordInput.select();
  } catch {
    errorMessage.textContent = '이 브라우저에서는 암호 확인을 사용할 수 없습니다.';
  } finally {
    submitButton.disabled = false;
  }
});

togglePassword.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  togglePassword.textContent = visible ? '보기' : '숨기기';
  togglePassword.setAttribute('aria-label', visible ? '암호 표시' : '암호 숨기기');
  passwordInput.focus();
});
