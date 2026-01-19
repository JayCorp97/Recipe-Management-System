document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const otpBtnGroup = document.getElementById('otpBtnGroup');
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const errorDiv = document.getElementById('error');
  const infoDiv = document.getElementById('info');

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const otpInput = document.getElementById('otp');

  const rememberCheckbox = document.getElementById('rememberEmail');
  const otpOverlay = document.getElementById('otpOverlay');
  const otpTimerDisplay = document.getElementById('otpTimer');
  const errorDivOtp = document.getElementById('errorOtp');
  const enterOtpBtn = document.getElementById('enterOtpBtn');

  let timerInterval;

  // Load remembered email
  const savedEmail = localStorage.getItem('rememberedEmail');
  if (savedEmail) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
  }

  // STEP 1: Verify Email + Password
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    infoDiv.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorDiv.textContent = 'Email and password are required';
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errorDiv.textContent = data.message || 'Invalid email or password';
        return;
      }

      // Password verified
      loginBtn.style.display = 'none';
      sendOtpBtn.style.display = 'block';

      emailInput.disabled = true;
      passwordInput.disabled = true;

      infoDiv.textContent = 'Password verified. Click "Send OTP" to continue.';
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Server error';
    }
  });

  // STEP 2: Send / Resend OTP
  const otpTrigger = async () => {
    errorDiv.textContent = '';
    errorDivOtp.textContent = '';
    otpInput.value = '';
    verifyOtpBtn.disabled = false;

    const email = emailInput.value.trim();
    if (!email) {
      errorDiv.textContent = 'Email is required';
      return;
    }

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errorDiv.textContent = data.message || 'Failed to send OTP';
        return;
      }

      sendOtpBtn.style.display = 'none';
      otpOverlay.classList.add('active');
      verifyOtpBtn.style.display = 'block';

      startOtpTimer(2 * 60); // 2 minutes countdown
      infoDiv.textContent = 'OTP sent. Check your email/console.';
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Failed to send OTP';
    }
  };

  sendOtpBtn.addEventListener('click', otpTrigger);
  if (resendOtpBtn) resendOtpBtn.addEventListener('click', otpTrigger);

  // STEP 3: Verify OTP
  verifyOtpBtn.addEventListener('click', async () => {
    errorDiv.textContent = '';
    errorDivOtp.textContent = '';

    const otp = otpInput.value.trim();
    if (!otp) {
      errorDiv.textContent = 'Please enter OTP';
      errorDivOtp.textContent = 'Please enter OTP';
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value, otp })
      });

      const data = await res.json();

      if (!res.ok) {
        errorDiv.textContent = data.message || 'OTP verification failed';
        errorDivOtp.textContent = data.message || 'OTP verification failed';
        return;
      }

      if (rememberCheckbox.checked) {
        localStorage.setItem('rememberedEmail', emailInput.value);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Login failed';
    }
  });

  // Overlay controls
  window.closeOverlay = function() {
    otpOverlay.classList.remove('active');
    clearInterval(timerInterval);
    otpTimerDisplay.textContent = "02:00"; // reset timer
    verifyOtpBtn.disabled = false;
    if (enterOtpBtn) enterOtpBtn.style.display = 'block';
  }

  // Enter OTP button
  if (enterOtpBtn && otpOverlay) {
    enterOtpBtn.addEventListener('click', () => {
      otpOverlay.classList.add('active');
    });
  }

  // OTP countdown timer
  function startOtpTimer(duration) {
    let timer = duration;
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      const minutes = Math.floor(timer / 60);
      const seconds = timer % 60;

      otpTimerDisplay.textContent =
        (minutes < 10 ? '0' + minutes : minutes) + ':' +
        (seconds < 10 ? '0' + seconds : seconds);

      if (--timer < 0) {
        clearInterval(timerInterval);
        otpTimerDisplay.textContent = "OTP expired";
        verifyOtpBtn.disabled = true;
      }
    }, 1000);
  }
});
