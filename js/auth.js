// ===================== Authentication =====================
// Register, Login, Logout, Session, Profile/Settings, Admin modals
window.Convo = window.Convo || {};

(function () {
  const { sb, generateUniqueId, hashPassword, getInitials, getAvatarHtml, sanitize } = window.Convo;
  const { showError, hideError } = window.Convo;
  const state = window.Convo.state;
  const dom = window.Convo.dom();

  // ===================== Auth Modal Navigation =====================
  function showAuthModal() {
    dom.authModal.classList.remove('hidden');
  }

  function hideAuthModal() {
    dom.authModal.classList.add('hidden');
  }

  const authGreeting = document.getElementById('authGreeting');

  function showAuthView(view) {
    authGreeting.classList.add('hidden');
    dom.authRegister.classList.add('hidden');
    dom.authLogin.classList.add('hidden');
    dom.authWelcome.classList.add('hidden');
    hideError(dom.registerError);
    hideError(dom.loginError);
    view.classList.remove('hidden');
  }

  document.getElementById('goToRegister').addEventListener('click', () => {
    showAuthView(dom.authRegister);
  });

  document.getElementById('goToLogin').addEventListener('click', () => {
    showAuthView(dom.authLogin);
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView(dom.authLogin);
  });

  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView(dom.authRegister);
  });

  document.getElementById('backFromRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView(authGreeting);
  });

  document.getElementById('backFromLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView(authGreeting);
  });

  // ===================== Set User in UI =====================
  function setUserUI(user) {
    dom.userNameDisplay.textContent = user.username;
    dom.userIdSmall.textContent = 'ID: ' + user.id;
    document.getElementById('userAvatar').innerHTML = `<span>${getInitials(user.username)}</span>`;

    const { data } = sb.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
    if (data && data.publicUrl) {
      const img = new Image();
      img.onload = () => {
        document.getElementById('userAvatar').innerHTML = `<img src="${data.publicUrl}?t=${Date.now()}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      };
      img.src = data.publicUrl + '?t=' + Date.now();
    }

    const btnAdmin = document.getElementById('btnAdmin');
    if (user.is_admin) {
      btnAdmin.classList.remove('hidden');
    } else {
      btnAdmin.classList.add('hidden');
    }
  }

  // ===================== Register =====================
  dom.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(dom.registerError);

    const firstName = document.getElementById('registerFirstName').value.trim();
    const lastName = document.getElementById('registerLastName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!firstName || !lastName) {
      showError(dom.registerError, 'First and last name are required.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(dom.registerError, 'Please enter a valid email address.');
      return;
    }
    if (username.length < 2) {
      showError(dom.registerError, 'Username must be at least 2 characters.');
      return;
    }
    if (password.length < 4) {
      showError(dom.registerError, 'Password must be at least 4 characters.');
      return;
    }

    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Creating...';

    try {
      const { data: existing } = await sb
        .from('users')
        .select('id, username, email')
        .or(`username.eq.${username},email.eq.${email}`)
        .limit(1);

      if (existing && existing.length > 0) {
        if (existing[0].username === username) {
          showError(dom.registerError, 'Username is already taken. Choose another.');
        } else {
          showError(dom.registerError, 'An account with this email already exists.');
        }
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i> Register';
        return;
      }

      const userId = generateUniqueId();
      const passHash = await hashPassword(password);

      const { error } = await sb
        .from('users')
        .insert([{
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          username: username,
          password_hash: passHash
        }]);

      if (error) {
        showError(dom.registerError, 'Registration failed: ' + error.message);
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i> Register';
        return;
      }

      const user = { id: userId, username: username };
      state.setCurrentUser(user);
      localStorage.setItem('convo_session', JSON.stringify(user));

      document.getElementById('displayUniqueId').textContent = userId;
      dom.authRegister.classList.add('hidden');
      dom.authWelcome.classList.remove('hidden');

    } catch (err) {
      showError(dom.registerError, 'An error occurred. Please try again.');
    }

    registerBtn.disabled = false;
    registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i> Register';
  });

  // Copy ID button
  document.getElementById('btnCopyId').addEventListener('click', () => {
    const id = document.getElementById('displayUniqueId').textContent;
    navigator.clipboard.writeText(id).then(() => {
      const btn = document.getElementById('btnCopyId');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
    });
  });

  // Enter chat after registration
  document.getElementById('btnEnterChat').addEventListener('click', () => {
    hideAuthModal();
    setUserUI(state.getCurrentUser());
    dom.messageInput.focus();
    if (window.Convo.initChat) window.Convo.initChat();
  });

  // ===================== Login =====================
  dom.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(dom.loginError);

    const loginId = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!loginId || !password) {
      showError(dom.loginError, 'Please fill in all fields.');
      return;
    }

    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Logging in...';

    try {
      const passHash = await hashPassword(password);

      let { data: users } = await sb
        .from('users')
        .select('id, username, password_hash, is_admin')
        .or(`id.eq.${loginId},username.eq.${loginId},email.eq.${loginId}`)
        .limit(1);

      if (!users || users.length === 0) {
        showError(dom.loginError, 'No account found. Check your email, username, or ID.');
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-arrow-right me-2"></i> Log In';
        return;
      }

      const user = users[0];
      if (user.password_hash !== passHash) {
        showError(dom.loginError, 'Incorrect password.');
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-arrow-right me-2"></i> Log In';
        return;
      }

      const currentUser = { id: user.id, username: user.username, is_admin: !!user.is_admin };
      state.setCurrentUser(currentUser);
      localStorage.setItem('convo_session', JSON.stringify(currentUser));
      hideAuthModal();
      setUserUI(currentUser);
      dom.messageInput.focus();
      if (window.Convo.initChat) window.Convo.initChat();

    } catch (err) {
      showError(dom.loginError, 'An error occurred. Please try again.');
    }

    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-arrow-right me-2"></i> Log In';
  });

  // ===================== Logout =====================
  const logoutModal = document.getElementById('logoutModal');
  const logoutConfirm = document.getElementById('logoutConfirm');
  const logoutCancel = document.getElementById('logoutCancel');

  function showLogoutModal() {
    logoutModal.classList.remove('hidden');
  }

  function hideLogoutModal() {
    logoutModal.classList.add('hidden');
  }

  dom.btnLogout.addEventListener('click', () => {
    showLogoutModal();
  });

  logoutCancel.addEventListener('click', () => {
    hideLogoutModal();
  });

  logoutModal.addEventListener('click', (e) => {
    if (e.target === logoutModal) hideLogoutModal();
  });

  logoutConfirm.addEventListener('click', () => {
    hideLogoutModal();

    localStorage.removeItem('convo_session');
    state.setCurrentUser(null);
    state.setCurrentView('general');
    state.setContactsData([]);
    state.getOnlineUserIds().clear();
    state.getBlockedUsers().clear();
    state.getBlockedByUsers().clear();
    dom.userNameDisplay.textContent = 'Guest';
    dom.userIdSmall.textContent = '';
    document.getElementById('userAvatar').innerHTML = '<i class="fas fa-user"></i>';
    document.getElementById('btnAdmin').classList.add('hidden');

    dom.chatRoomIcon.innerHTML = '<i class="fas fa-hashtag me-1"></i>';
    dom.chatRoomTitle.textContent = 'general';
    dom.chatRoomDesc.textContent = 'Public chat room – say hello!';
    dom.btnBackChat.classList.add('hidden');
    dom.contactsList.innerHTML = '';
    dom.contactsLabel.classList.add('hidden');
    dom.convGeneral.classList.add('active');
    dom.messageInput.placeholder = 'Type a message...';

    showAuthView(authGreeting);
    showAuthModal();

    if (window.Convo.cleanup) window.Convo.cleanup();
  });

  // ===================== Profile / Settings Modal =====================
  const btnSettings = document.getElementById('btnSettings');
  const profileModal = document.getElementById('profileModal');
  const btnCloseProfile = document.getElementById('btnCloseProfile');
  const profileIframe = document.getElementById('profileIframe');

  btnSettings.addEventListener('click', () => {
    profileIframe.src = 'profile.html';
    profileModal.classList.remove('hidden');
  });

  btnCloseProfile.addEventListener('click', () => {
    profileModal.classList.add('hidden');
  });

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) profileModal.classList.add('hidden');
  });

  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'avatar-updated' && e.data.url) {
      const avatarEl = document.getElementById('userAvatar');
      avatarEl.innerHTML = `<img src="${e.data.url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }

    if (e.data.type === 'logout') {
      profileModal.classList.add('hidden');
      showLogoutModal();
    }
  });

  // ===================== Admin Panel Modal =====================
  const btnAdminEl = document.getElementById('btnAdmin');
  const adminModal = document.getElementById('adminModal');
  const btnCloseAdmin = document.getElementById('btnCloseAdmin');
  const adminIframe = document.getElementById('adminIframe');

  btnAdminEl.addEventListener('click', () => {
    if (!state.getCurrentUser() || !state.getCurrentUser().is_admin) return;
    adminIframe.src = 'admin.html';
    adminModal.classList.remove('hidden');
  });

  btnCloseAdmin.addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) adminModal.classList.add('hidden');
  });

  // ===================== Exports =====================
  window.Convo.showAuthModal = showAuthModal;
  window.Convo.hideAuthModal = hideAuthModal;
  window.Convo.setUserUI = setUserUI;
  window.Convo.showLogoutModal = showLogoutModal;
})();
