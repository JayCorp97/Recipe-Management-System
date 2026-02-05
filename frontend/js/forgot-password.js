// =======================
// Cached email & OTP timer
// =======================
let cachedEmail = '';
let otpInterval = null;

// =======================
// Verify Email
// =======================
document.getElementById('verifyEmailForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const error = document.getElementById('error');
  const info = document.getElementById('info');
  const btn = document.getElementById('verifyEmailBtn');
  const otpOverlay = document.getElementById('otpOverlay');

  error.innerText = '';
  info.innerText = '';

  if (!email) {
    error.innerText = 'Please enter your registered email.';
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Verifying...';

  try {
    const response = await fetch('/api/users/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server returned invalid response.');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Email not found.');
    }

    cachedEmail = email;
    info.innerText = 'Email verified! OTP has been sent to your email address.';

    // Show OTP overlay & start timer
    otpOverlay.classList.add('active');
    startOtpTimer(2 * 60); // 2 minutes

  } catch (err) {
    error.innerText = err.message || 'Something went wrong.';
  } finally {
    btn.disabled = false;
    btn.innerText = 'Verify Email';
  }
});

// =======================
// OTP Timer
// =======================
function startOtpTimer(duration) {
  clearInterval(otpInterval);

  const timerEl = document.getElementById('otpTimer');
  const submitBtn = document.getElementById('verifyPwBtn');
  let time = duration;

  submitBtn.disabled = false;
  submitBtn.innerText = 'Submit';

  otpInterval = setInterval(() => {
    const minutes = String(Math.floor(time / 60)).padStart(2, '0');
    const seconds = String(time % 60).padStart(2, '0');
    timerEl.innerText = `${minutes}:${seconds}`;

    if (--time < 0) {
      clearInterval(otpInterval);
      timerEl.innerText = 'OTP expired';
      submitBtn.disabled = true;
    }
  }, 1000);
}

// =======================
// Close OTP Overlay
// =======================
function closeOverlay() {
  const otpOverlay = document.getElementById('otpOverlay');
  otpOverlay.classList.remove('active');
  clearInterval(otpInterval);

  // Reset fields
  document.getElementById('otp').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmpassword').value = '';
  document.getElementById('errorOtp').innerText = '';
}

// =======================
// Verify OTP & Save Password
// =======================
document.getElementById('verifyPwBtn').addEventListener('click', async () => {
  const otp = document.getElementById('otp').value.trim();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmpassword').value.trim();
  const errorOtp = document.getElementById('errorOtp');
  const info = document.getElementById('info');
  const btn = document.getElementById('verifyPwBtn');

  errorOtp.innerText = '';
  info.innerText = '';

  if (!cachedEmail) return errorOtp.innerText = 'Email verification required.';
  if (!otp) return errorOtp.innerText = 'Please enter the OTP.';
  if (!validatePassword(newPassword)) return errorOtp.innerText = 'Password does not meet requirements.';
  if (newPassword !== confirmPassword) return errorOtp.innerText = 'Passwords do not match.';

  btn.disabled = true;
  btn.innerText = 'Submitting...';

  try {
    const response = await fetch('/api/users/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cachedEmail, otp, newPassword })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server returned invalid response.');
    }

    if (!response.ok) {
      throw new Error(data.message || 'OTP verification failed.');
    }

    info.innerText = 'Password reset successful! Redirecting...';

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);

  } catch (err) {
    errorOtp.innerText = err.message || 'Something went wrong.';
    btn.disabled = false;
    btn.innerText = 'Submit';
  }
});

// =======================
// Password Validation
// =======================
const rules = {
  length: document.getElementById('req-length'),
  upper: document.getElementById('req-upper'),
  lower: document.getElementById('req-lower'),
  number: document.getElementById('req-number'),
  special: document.getElementById('req-special')
};

function validatePassword(password) {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };

  Object.keys(checks).forEach(key => {
    rules[key].className = checks[key] ? 'valid' : 'invalid';
  });

  return Object.values(checks).every(Boolean);
}

// Show rules only on focus
const newPasswordInput = document.getElementById('newPassword');
const passwordRules = document.getElementById('passwordRules');

newPasswordInput.addEventListener('focus', () => {
  passwordRules.style.display = 'block';
});
newPasswordInput.addEventListener('blur', () => {
  passwordRules.style.display = 'none';
});
newPasswordInput.addEventListener('input', e => {
  validatePassword(e.target.value);
});

// =======================
// Show/Hide Password Toggle
// =======================
document.querySelectorAll('.toggle-password').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const targetId = toggle.getAttribute('data-target');
    const input = document.getElementById(targetId);

    if (input.type === 'password') {
      input.type = 'text';
      toggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      input.type = 'password';
      toggle.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });
});
