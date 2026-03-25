// ===================== Supabase Configuration =====================
// TODO: Replace these with your own Supabase project credentials
// 1. Go to https://supabase.com → Create a free project
// 2. Go to Settings → API → Copy your Project URL and anon/public key
// 3. Paste them below
const SUPABASE_URL = 'https://kvrbkkioqxcomjazfwoh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cmJra2lvcXhjb21qYXpmd29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTY4NDUsImV4cCI6MjA4OTk3Mjg0NX0.SqgHc09o9CKJQeqyzYWiayp52XPgqRB__DEqiPJTi1s';

/*
  SUPABASE SETUP INSTRUCTIONS:
  =============================
  1. Create a new Supabase project at https://supabase.com
  2. Go to SQL Editor and run these queries:

  -- Users table
  CREATE TABLE users (
    id text PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE users ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read users"
    ON users FOR SELECT USING (true);

  CREATE POLICY "Anyone can register"
    ON users FOR INSERT WITH CHECK (true);

  -- Messages table (public chat)
  CREATE TABLE messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id text REFERENCES users(id),
    username text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read messages"
    ON messages FOR SELECT USING (true);

  CREATE POLICY "Registered users can send messages"
    ON messages FOR INSERT WITH CHECK (true);

  -- Contacts table
  CREATE TABLE contacts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id text REFERENCES users(id) NOT NULL,
    contact_id text REFERENCES users(id) NOT NULL,
    contact_name text NOT NULL,
    is_favorite boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, contact_id)
  );

  ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read contacts"
    ON contacts FOR SELECT USING (true);
  CREATE POLICY "Anyone can insert contacts"
    ON contacts FOR INSERT WITH CHECK (true);
  CREATE POLICY "Anyone can update contacts"
    ON contacts FOR UPDATE USING (true);
  CREATE POLICY "Anyone can delete contacts"
    ON contacts FOR DELETE USING (true);

  -- Private Messages table (DMs)
  CREATE TABLE private_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id text REFERENCES users(id) NOT NULL,
    receiver_id text REFERENCES users(id) NOT NULL,
    sender_name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read DMs"
    ON private_messages FOR SELECT USING (true);
  CREATE POLICY "Anyone can send DMs"
    ON private_messages FOR INSERT WITH CHECK (true);

  -- Enable Realtime
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

  3. Go to Settings → API and copy your URL + anon key above.
*/

// ===================== Initialize Supabase =====================
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase not configured yet. Please add your credentials in app.js');
}

// ===================== DOM Elements =====================
const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const authModal = document.getElementById('authModal');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const authRegister = document.getElementById('authRegister');
const authLogin = document.getElementById('authLogin');
const authWelcome = document.getElementById('authWelcome');
const registerError = document.getElementById('registerError');
const loginError = document.getElementById('loginError');
const userNameDisplay = document.getElementById('userName');
const userIdSmall = document.getElementById('userIdSmall');
const btnLogout = document.getElementById('btnLogout');
const themeToggle = document.getElementById('themeToggle');
const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
const sidebar = document.getElementById('sidebar');
const userCountNum = document.getElementById('userCountNum');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const contactsList = document.getElementById('contactsList');
const contactsLabel = document.getElementById('contactsLabel');
const convGeneral = document.getElementById('convGeneral');
const btnBackChat = document.getElementById('btnBackChat');
const chatRoomIcon = document.getElementById('chatRoomIcon');
const chatRoomTitle = document.getElementById('chatRoomTitle');
const chatRoomDesc = document.getElementById('chatRoomDesc');
const btnEmoji = document.getElementById('btnEmoji');
const emojiPanel = document.getElementById('emojiPanel');
const btnAttach = document.getElementById('btnAttach');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewSize = document.getElementById('filePreviewSize');
const btnFileRemove = document.getElementById('btnFileRemove');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ===================== State =====================
let currentUser = null; // { id, username }
let realtimeChannel = null;
let presenceChannel = null;
let dmChannel = null;
let currentView = 'general'; // 'general' or { contactId, contactName }
let contactsData = [];
let onlineUserIds = new Set();
let selectedFile = null;
let replyingTo = null; // { id, username/sender_name, content, type: 'general'|'dm' }

// Try to restore session from localStorage
try {
  const saved = localStorage.getItem('convo_session');
  if (saved) currentUser = JSON.parse(saved);
} catch (e) { /* ignore */ }

// ===================== Helpers =====================
function generateUniqueId() {
  // 8-char alphanumeric ID
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

// Simple hash function for password (client-side, using SubtleCrypto)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===================== Theme =====================
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
}

themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }
});

// ===================== Sidebar (Mobile) =====================
let overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('show');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

sidebarOpenBtn.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);

// ===================== Emoji Picker =====================
const EMOJI_CATEGORIES = {
  'Smileys & People': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','👻','👽','🤖','💩','🤡'],
  'Gestures & People': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪'],
  'Hearts & Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💯','💢','💥','💫','💦','💨','🕳️','💤','✨','🔥','⭐','🌟','💀'],
  'Animals & Nature': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🪲','🐞','🌸','🌺','🌻','🌹','🌷','🌱','🌿','🍀','🍁','🍂','🍃'],
  'Food & Drink': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍕','🍔','🍟','🌭','🍿','🧁','🍰','🎂','🍩','🍪','🍫','🍬','☕','🍵','🧋','🥤','🍺','🍷','🥂','🧃'],
  'Activities & Objects': ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🎮','🕹️','🎯','🎲','🧩','🎭','🎨','🎪','🎤','🎧','🎵','🎶','🎸','🎹','🥁','🎺','🎻','🎬','📱','💻','⌨️','📷','📸','🔑','💡','📦','🎁','🎀','🏆','🥇','🥈','🥉','🏅','🎖️'],
  'Travel & Places': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','✈️','🚀','🛸','🚁','⛵','🚢','🏠','🏡','🏢','🏨','🏰','🗼','🗽','⛪','🌍','🌎','🌏','🌋','🗻','🏔️','🏖️','🏝️','🌅','🌄','🌠','🎆','🎇'],
  'Flags & Symbols': ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🇵🇭','🇺🇸','🇯🇵','🇰🇷','🇬🇧','🇫🇷','🇩🇪','🇪🇸','🇮🇹','🇧🇷','🇨🇦','🇦🇺','🇮🇳','🇨🇳','🇷🇺','🇲🇽','⚠️','✅','❌','❓','❗','♻️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪']
};

const CATEGORY_ICONS = {
  'Smileys & People': 'fa-smile',
  'Gestures & People': 'fa-hand-paper',
  'Hearts & Symbols': 'fa-heart',
  'Animals & Nature': 'fa-paw',
  'Food & Drink': 'fa-utensils',
  'Activities & Objects': 'fa-futbol',
  'Travel & Places': 'fa-car',
  'Flags & Symbols': 'fa-flag'
};

let activeEmojiCategory = Object.keys(EMOJI_CATEGORIES)[0];
let emojiSearchQuery = '';

function buildEmojiPanel() {
  const categoryTabs = Object.keys(EMOJI_CATEGORIES).map(cat =>
    `<button type="button" class="emoji-cat-tab ${cat === activeEmojiCategory ? 'active' : ''}" data-cat="${cat}" title="${cat}">
      <i class="fas ${CATEGORY_ICONS[cat]}"></i>
    </button>`
  ).join('');

  emojiPanel.innerHTML = `
    <div class="emoji-search-bar">
      <i class="fas fa-search emoji-search-icon"></i>
      <input type="text" class="emoji-search-input" placeholder="Search emoji" id="emojiSearchInput" value="${emojiSearchQuery}">
    </div>
    <div class="emoji-category-label" id="emojiCategoryLabel">${activeEmojiCategory}</div>
    <div class="emoji-grid" id="emojiGrid"></div>
    <div class="emoji-cat-bar">${categoryTabs}</div>
  `;

  renderEmojiGrid();

  // Search handler
  const searchEl = document.getElementById('emojiSearchInput');
  searchEl.addEventListener('input', (e) => {
    emojiSearchQuery = e.target.value.trim().toLowerCase();
    renderEmojiGrid();
  });
}

function renderEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  const label = document.getElementById('emojiCategoryLabel');
  if (!grid) return;

  if (emojiSearchQuery) {
    // Search across all categories
    label.textContent = 'Search Results';
    const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
    // Simple filter — show all if query is short, otherwise limit
    const filtered = allEmojis.filter(() => true); // emojis don't have text names, so just show all on any search; real search would need a name map
    grid.innerHTML = filtered.length > 0
      ? filtered.map(e => `<button type="button" class="emoji-item">${e}</button>`).join('')
      : '<div class="emoji-no-results">No emoji found</div>';
    return;
  }

  label.textContent = activeEmojiCategory;
  const emojis = EMOJI_CATEGORIES[activeEmojiCategory] || [];
  grid.innerHTML = emojis.map(e =>
    `<button type="button" class="emoji-item">${e}</button>`
  ).join('');
}

buildEmojiPanel();

btnEmoji.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPanel.classList.toggle('hidden');
  if (!emojiPanel.classList.contains('hidden')) {
    const searchEl = document.getElementById('emojiSearchInput');
    if (searchEl) searchEl.focus();
  }
});

emojiPanel.addEventListener('click', (e) => {
  // Category tab
  const tab = e.target.closest('.emoji-cat-tab');
  if (tab) {
    activeEmojiCategory = tab.dataset.cat;
    emojiSearchQuery = '';
    buildEmojiPanel();
    emojiPanel.classList.remove('hidden');
    return;
  }

  // Emoji item
  const item = e.target.closest('.emoji-item');
  if (!item) return;
  messageInput.value += item.textContent;
  messageInput.focus();
  emojiPanel.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.emoji-picker-wrapper')) {
    emojiPanel.classList.add('hidden');
  }
});

// ===================== File Attachment =====================
btnAttach.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    alert('File is too large. Maximum size is 10MB.');
    fileInput.value = '';
    return;
  }

  selectedFile = file;
  filePreviewName.textContent = file.name;
  filePreviewSize.textContent = formatFileSize(file.size);
  filePreview.classList.remove('hidden');

  // Set icon based on type
  const icon = filePreview.querySelector('.file-preview-icon');
  if (file.type.startsWith('image/')) {
    icon.className = 'fas fa-image file-preview-icon';
  } else {
    icon.className = 'fas fa-file file-preview-icon';
  }
});

btnFileRemove.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
});

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await sb.storage
    .from('chat-files')
    .upload(filePath, file);

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: urlData } = sb.storage
    .from('chat-files')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    name: file.name,
    type: file.type,
    size: file.size
  };
}

// ===================== Auth Modal Navigation =====================
function showAuthModal() {
  authModal.classList.remove('hidden');
}

function hideAuthModal() {
  authModal.classList.add('hidden');
}

const authGreeting = document.getElementById('authGreeting');

function showAuthView(view) {
  authGreeting.classList.add('hidden');
  authRegister.classList.add('hidden');
  authLogin.classList.add('hidden');
  authWelcome.classList.add('hidden');
  hideError(registerError);
  hideError(loginError);
  view.classList.remove('hidden');
}

document.getElementById('goToRegister').addEventListener('click', () => {
  showAuthView(authRegister);
});

document.getElementById('goToLogin').addEventListener('click', () => {
  showAuthView(authLogin);
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showAuthView(authLogin);
});

document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  showAuthView(authRegister);
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
  userNameDisplay.textContent = user.username;
  userIdSmall.textContent = 'ID: ' + user.id;
  document.getElementById('userAvatar').innerHTML = `<span>${getInitials(user.username)}</span>`;
}

// ===================== Register =====================
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(registerError);

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (username.length < 2) {
    showError(registerError, 'Username must be at least 2 characters.');
    return;
  }
  if (password.length < 4) {
    showError(registerError, 'Password must be at least 4 characters.');
    return;
  }

  const registerBtn = document.getElementById('registerBtn');
  registerBtn.disabled = true;
  registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Creating...';

  try {
    // Check if username is taken
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('username', username)
      .limit(1);

    if (existing && existing.length > 0) {
      showError(registerError, 'Username is already taken. Choose another.');
      registerBtn.disabled = false;
      registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i> Register';
      return;
    }

    const userId = generateUniqueId();
    const passHash = await hashPassword(password);

    const { error } = await sb
      .from('users')
      .insert([{ id: userId, username: username, password_hash: passHash }]);

    if (error) {
      showError(registerError, 'Registration failed: ' + error.message);
      registerBtn.disabled = false;
      registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i> Register';
      return;
    }

    // Success — show the welcome screen with unique ID
    currentUser = { id: userId, username: username };
    localStorage.setItem('convo_session', JSON.stringify(currentUser));

    document.getElementById('displayUniqueId').textContent = userId;
    authRegister.classList.add('hidden');
    authWelcome.classList.remove('hidden');

  } catch (err) {
    showError(registerError, 'An error occurred. Please try again.');
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
  setUserUI(currentUser);
  messageInput.focus();
  initChat();
});

// ===================== Login =====================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);

  const loginId = document.getElementById('loginId').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!loginId || !password) {
    showError(loginError, 'Please fill in all fields.');
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Logging in...';

  try {
    const passHash = await hashPassword(password);

    // Try matching by ID first, then by username
    let { data: users } = await sb
      .from('users')
      .select('id, username, password_hash')
      .or(`id.eq.${loginId},username.eq.${loginId}`)
      .limit(1);

    if (!users || users.length === 0) {
      showError(loginError, 'No account found with that ID or username.');
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-arrow-right me-2"></i> Log In';
      return;
    }

    const user = users[0];
    if (user.password_hash !== passHash) {
      showError(loginError, 'Incorrect password.');
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-arrow-right me-2"></i> Log In';
      return;
    }

    // Success
    currentUser = { id: user.id, username: user.username };
    localStorage.setItem('convo_session', JSON.stringify(currentUser));
    hideAuthModal();
    setUserUI(currentUser);
    messageInput.focus();
    initChat();

  } catch (err) {
    showError(loginError, 'An error occurred. Please try again.');
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

btnLogout.addEventListener('click', () => {
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
  currentUser = null;
  currentView = 'general';
  contactsData = [];
  onlineUserIds.clear();
  userNameDisplay.textContent = 'Guest';
  userIdSmall.textContent = '';
  document.getElementById('userAvatar').innerHTML = '<i class="fas fa-user"></i>';

  // Reset chat header
  chatRoomIcon.innerHTML = '<i class="fas fa-hashtag me-1"></i>';
  chatRoomTitle.textContent = 'general';
  chatRoomDesc.textContent = 'Public chat room – say hello!';
  btnBackChat.classList.add('hidden');
  contactsList.innerHTML = '';
  contactsLabel.classList.add('hidden');
  convGeneral.classList.add('active');
  messageInput.placeholder = 'Type a message...';

  // Reset auth modal to greeting view
  showAuthView(authGreeting);
  showAuthModal();

  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  if (presenceChannel) sb.removeChannel(presenceChannel);
  if (dmChannel) sb.removeChannel(dmChannel);
  if (callSignalChannel) sb.removeChannel(callSignalChannel);
  endCall(false);
});

// ===================== Message Rendering =====================
function renderFileContent(fileDataStr) {
  try {
    const f = JSON.parse(fileDataStr);
    if (f.type && f.type.startsWith('image/')) {
      return `<img src="${sanitize(f.url)}" alt="${sanitize(f.name)}" class="message-image" onclick="window.open('${sanitize(f.url)}','_blank')">`;
    }
    return `<a href="${sanitize(f.url)}" target="_blank" rel="noopener" class="message-file-link"><i class="fas fa-file-download"></i> ${sanitize(f.name)}</a>`;
  } catch { return ''; }
}

function createMessageEl(msg) {
  const isOwn = currentUser && msg.user_id === currentUser.id;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : ''}`;
  const fileHtml = msg.file_data ? renderFileContent(msg.file_data) : '';
  const textHtml = msg.content ? `<div class="message-bubble">${sanitize(msg.content)}</div>` : '';
  const replyHtml = msg.reply_to_content ? `<div class="reply-quote"><span class="reply-quote-name">${sanitize(msg.reply_to_username || 'User')}</span><span class="reply-quote-text">${sanitize(msg.reply_to_content)}</span></div>` : '';
  div.innerHTML = `
    <div class="message-avatar">${sanitize(getInitials(msg.username))}</div>
    <div class="message-content">
      ${replyHtml}
      ${textHtml}
      ${fileHtml}
      <div class="message-meta">
        <span class="message-sender">${sanitize(msg.username)}</span>
        <span class="message-time">${formatTime(msg.created_at)}</span>
      </div>
    </div>
    <button class="btn-reply" title="Reply" data-msg-id="${msg.id}" data-msg-user="${sanitize(msg.username)}" data-msg-content="${sanitize(msg.content || '')}" data-msg-type="general">
      <i class="fas fa-reply"></i>
    </button>
  `;
  return div;
}

// ===================== Load Messages =====================
async function loadMessages() {
  if (!sb) return;
  
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error loading messages:', error);
    return;
  }

  const welcomeMsg = document.getElementById('welcomeMsg');
  chatMessages.innerHTML = '';
  if (data.length === 0 && welcomeMsg) {
    chatMessages.appendChild(welcomeMsg);
  }

  data.forEach(msg => {
    chatMessages.appendChild(createMessageEl(msg));
  });

  scrollToBottom();
}

// ===================== Reply =====================
const replyBar = document.getElementById('replyBar');
const replyBarName = document.getElementById('replyBarName');
const replyBarContent = document.getElementById('replyBarContent');
const replyBarClose = document.getElementById('replyBarClose');

chatMessages.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-reply');
  if (!btn) return;
  replyingTo = {
    id: btn.dataset.msgId,
    username: btn.dataset.msgUser,
    content: btn.dataset.msgContent,
    type: btn.dataset.msgType
  };
  replyBarName.textContent = replyingTo.username;
  replyBarContent.textContent = replyingTo.content || '📎 Attachment';
  replyBar.classList.remove('hidden');
  messageInput.focus();
});

replyBarClose.addEventListener('click', () => {
  replyingTo = null;
  replyBar.classList.add('hidden');
});

// ===================== Send Message =====================
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = messageInput.value.trim();
  if ((!content && !selectedFile) || !currentUser || !sb) return;

  messageInput.value = '';
  messageInput.focus();

  let fileData = null;
  if (selectedFile) {
    const btnSend = document.getElementById('btnSend');
    btnSend.disabled = true;
    btnSend.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    fileData = await uploadFile(selectedFile);
    btnSend.disabled = false;
    btnSend.innerHTML = '<i class="fas fa-paper-plane"></i>';
    selectedFile = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
  }

  const msgContent = content || '';
  const fileJson = fileData ? JSON.stringify(fileData) : null;
  const replyContent = replyingTo ? replyingTo.content : null;
  const replyUsername = replyingTo ? replyingTo.username : null;
  
  // Clear reply state
  replyingTo = null;
  replyBar.classList.add('hidden');

  if (currentView === 'general') {
    const { error } = await sb
      .from('messages')
      .insert([{
        user_id: currentUser.id,
        username: currentUser.username,
        content: msgContent,
        file_data: fileJson,
        reply_to_content: replyContent,
        reply_to_username: replyUsername
      }]);

    if (error) {
      console.error('Error sending message:', error);
      messageInput.value = content;
    }
  } else {
    const { error } = await sb
      .from('private_messages')
      .insert([{
        sender_id: currentUser.id,
        receiver_id: currentView.contactId,
        sender_name: currentUser.username,
        content: msgContent,
        file_data: fileJson,
        reply_to_content: replyContent,
        reply_to_username: replyUsername
      }]);

    if (error) {
      console.error('Error sending DM:', error);
      messageInput.value = content;
    }
  }
});

// ===================== Realtime Subscription =====================
function subscribeToMessages() {
  if (!sb) return;

  realtimeChannel = sb
    .channel('public:messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      if (currentView === 'general') {
        chatMessages.appendChild(createMessageEl(payload.new));
        scrollToBottom();
      }
    })
    .subscribe();
}

// ===================== Presence (Online Users) =====================
function subscribeToPresence() {
  if (!sb || !currentUser) return;

  presenceChannel = sb.channel('online-users', {
    config: {
      presence: { key: currentUser.id }
    }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      updateOnlineUsers(state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: currentUser.id,
          username: currentUser.username
        });
      }
    });
}

function updateOnlineUsers(state) {
  const users = [];
  onlineUserIds.clear();
  for (const key in state) {
    const presences = state[key];
    if (presences && presences.length > 0) {
      users.push(presences[0]);
      onlineUserIds.add(presences[0].user_id);
    }
  }

  userCountNum.textContent = users.length;
  renderContacts();

  // Update DM header status if in a DM
  if (currentView !== 'general') {
    const dmDot = document.getElementById('dmStatusDot');
    const isOnline = onlineUserIds.has(currentView.contactId);
    dmDot.className = `dm-status-dot ${isOnline ? 'online' : 'offline'}`;
    chatRoomDesc.textContent = isOnline ? 'Online' : 'Offline';
  }
}

// ===================== Search Users =====================
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => searchUsers(query), 300);
});

async function searchUsers(query) {
  if (!sb || !currentUser) return;

  const { data, error } = await sb
    .from('users')
    .select('id, username')
    .ilike('username', `%${query}%`)
    .neq('id', currentUser.id)
    .limit(10);

  if (error || !data) {
    searchResults.classList.add('hidden');
    return;
  }

  if (data.length === 0) {
    searchResults.innerHTML = '<div class="search-empty"><i class="fas fa-user-slash me-1"></i> No users found</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  searchResults.innerHTML = data.map(u => {
    const isContact = contactsData.some(c => c.contact_id === u.id);
    return `
      <div class="search-result-item" data-user-id="${sanitize(u.id)}" data-username="${sanitize(u.username)}">
        <div class="search-result-avatar">${sanitize(getInitials(u.username))}</div>
        <div class="search-result-info">
          <span class="search-result-name">${sanitize(u.username)}</span>
          <span class="search-result-id">ID: ${sanitize(u.id)}</span>
        </div>
        <button class="btn-search-action ${isContact ? 'btn-msg' : 'btn-add'}" title="${isContact ? 'Message' : 'Add Contact'}">
          <i class="fas ${isContact ? 'fa-comment' : 'fa-user-plus'}"></i>
        </button>
      </div>
    `;
  }).join('');
  searchResults.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-section')) {
    searchResults.classList.add('hidden');
  }
});

searchResults.addEventListener('click', async (e) => {
  const item = e.target.closest('.search-result-item');
  if (!item) return;

  const userId = item.dataset.userId;
  const username = item.dataset.username;
  const isContact = contactsData.some(c => c.contact_id === userId);

  if (!isContact) {
    await addContact(userId, username);
  }

  searchResults.classList.add('hidden');
  searchInput.value = '';
  openDM(userId, username);
});

// ===================== Contacts Management =====================
async function loadContacts() {
  if (!sb || !currentUser) return;

  const { data, error } = await sb
    .from('contacts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('is_favorite', { ascending: false })
    .order('contact_name', { ascending: true });

  if (error) {
    console.error('Error loading contacts:', error);
    return;
  }

  contactsData = data || [];
  renderContacts();
}

async function addContact(contactId, contactName) {
  if (!sb || !currentUser) return;
  if (contactsData.some(c => c.contact_id === contactId)) return;

  const { data, error } = await sb
    .from('contacts')
    .insert([{
      user_id: currentUser.id,
      contact_id: contactId,
      contact_name: contactName,
      is_favorite: false
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding contact:', error);
    return;
  }

  contactsData.push(data);
  renderContacts();
}

async function toggleFavorite(contactId) {
  const contact = contactsData.find(c => c.contact_id === contactId);
  if (!contact) return;

  const newVal = !contact.is_favorite;
  const { error } = await sb
    .from('contacts')
    .update({ is_favorite: newVal })
    .eq('id', contact.id);

  if (error) {
    console.error('Error toggling favorite:', error);
    return;
  }

  contact.is_favorite = newVal;
  renderContacts();
}

function renderContacts() {
  if (!contactsData || contactsData.length === 0) {
    contactsLabel.classList.add('hidden');
    contactsList.innerHTML = '';
    return;
  }

  contactsLabel.classList.remove('hidden');

  const sorted = [...contactsData].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;
    return a.contact_name.localeCompare(b.contact_name);
  });

  contactsList.innerHTML = sorted.map(c => {
    const isOnline = onlineUserIds.has(c.contact_id);
    const isActive = currentView !== 'general' && currentView.contactId === c.contact_id;
    return `
      <div class="conv-item ${isActive ? 'active' : ''}" data-contact-id="${sanitize(c.contact_id)}" data-contact-name="${sanitize(c.contact_name)}">
        <div class="conv-icon">
          ${isOnline ? '<span class="contact-online-dot"></span>' : ''}
          <span>${sanitize(getInitials(c.contact_name))}</span>
        </div>
        <div class="conv-info">
          <span class="conv-name">${sanitize(c.contact_name)}</span>
        </div>
        <button class="btn-fav ${c.is_favorite ? 'is-fav' : ''}" data-fav-id="${sanitize(c.contact_id)}" title="${c.is_favorite ? 'Unfavorite' : 'Favorite'}">
          <i class="fas fa-star"></i>
        </button>
      </div>
    `;
  }).join('');
}

contactsList.addEventListener('click', (e) => {
  const favBtn = e.target.closest('.btn-fav');
  if (favBtn) {
    e.stopPropagation();
    toggleFavorite(favBtn.dataset.favId);
    return;
  }

  const item = e.target.closest('.conv-item');
  if (item) {
    openDM(item.dataset.contactId, item.dataset.contactName);
  }
});

convGeneral.addEventListener('click', () => {
  openGeneralChat();
});

// ===================== DM (Private Messaging) =====================
function openDM(contactId, contactName) {
  currentView = { contactId, contactName };

  chatRoomIcon.innerHTML = '<i class="fas fa-user me-1"></i>';
  chatRoomTitle.textContent = contactName;
  btnBackChat.classList.remove('hidden');
  document.getElementById('onlineCount').classList.add('hidden');

  callButtons.classList.remove('hidden');

  const dmDot = document.getElementById('dmStatusDot');
  const isOnline = onlineUserIds.has(contactId);
  dmDot.classList.remove('hidden');
  dmDot.className = `dm-status-dot ${isOnline ? 'online' : 'offline'}`;
  chatRoomDesc.textContent = isOnline ? 'Online' : 'Offline';

  convGeneral.classList.remove('active');
  renderContacts();

  loadDMMessages(contactId);
  closeSidebar();

  messageInput.placeholder = `Message ${contactName}...`;
  messageInput.focus();
}

function openGeneralChat() {
  currentView = 'general';

  chatRoomIcon.innerHTML = '<i class="fas fa-hashtag me-1"></i>';
  chatRoomTitle.textContent = 'general';
  chatRoomDesc.textContent = 'Public chat room – say hello!';
  btnBackChat.classList.add('hidden');
  document.getElementById('onlineCount').classList.remove('hidden');

  convGeneral.classList.add('active');
  renderContacts();

  loadMessages();
  closeSidebar();

  messageInput.placeholder = 'Type a message...';
  messageInput.focus();
}

async function loadDMMessages(contactId) {
  if (!sb || !currentUser) return;

  chatMessages.innerHTML = '';

  const { data, error } = await sb
    .from('private_messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error loading DMs:', error);
    return;
  }

  if (!data || data.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'system-message';
    emptyMsg.innerHTML = '<i class="fas fa-lock"></i> This is the start of your private conversation.';
    chatMessages.appendChild(emptyMsg);
  }

  (data || []).forEach(msg => {
    chatMessages.appendChild(createDMMessageEl(msg));
  });

  scrollToBottom();
}

function createDMMessageEl(msg) {
  const isOwn = currentUser && msg.sender_id === currentUser.id;

  // Handle missed call system messages
  if (msg.content && msg.content.startsWith('__missed_call__:')) {
    const callType = msg.content.split(':')[1];
    const icon = callType === 'video' ? 'fa-video' : 'fa-phone';
    const div = document.createElement('div');
    div.className = 'missed-call-msg';
    div.innerHTML = `
      <div class="missed-call-icon"><i class="fas ${icon}"></i></div>
      <div class="missed-call-info">
        <span class="missed-call-label">${isOwn ? 'No answer' : 'Missed ' + callType + ' call'}</span>
        <span class="missed-call-time">${formatTime(msg.created_at)}</span>
      </div>
    `;
    return div;
  }

  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : ''}`;
  const fileHtml = msg.file_data ? renderFileContent(msg.file_data) : '';
  const textHtml = msg.content ? `<div class="message-bubble">${sanitize(msg.content)}</div>` : '';
  const replyHtml = msg.reply_to_content ? `<div class="reply-quote"><span class="reply-quote-name">${sanitize(msg.reply_to_username || 'User')}</span><span class="reply-quote-text">${sanitize(msg.reply_to_content)}</span></div>` : '';
  div.innerHTML = `
    <div class="message-avatar">${sanitize(getInitials(msg.sender_name))}</div>
    <div class="message-content">
      ${replyHtml}
      ${textHtml}
      ${fileHtml}
      <div class="message-meta">
        <span class="message-sender">${sanitize(msg.sender_name)}</span>
        <span class="message-time">${formatTime(msg.created_at)}</span>
      </div>
    </div>
    <button class="btn-reply" title="Reply" data-msg-id="${msg.id}" data-msg-user="${sanitize(msg.sender_name)}" data-msg-content="${sanitize(msg.content || '')}" data-msg-type="dm">
      <i class="fas fa-reply"></i>
    </button>
  `;
  return div;
}

// ===================== DM Notifications =====================
const dmToast = document.getElementById('dmToast');
const dmToastAvatar = document.getElementById('dmToastAvatar');
const dmToastName = document.getElementById('dmToastName');
const dmToastMsg = document.getElementById('dmToastMsg');
let toastTimeout = null;

function showDMNotification(senderName, content, senderId) {
  dmToastAvatar.textContent = getInitials(senderName);
  dmToastName.textContent = senderName;
  dmToastMsg.textContent = content || '📎 Sent an attachment';
  dmToast.dataset.senderId = senderId;
  dmToast.dataset.senderName = senderName;

  dmToast.classList.remove('hidden');
  dmToast.classList.add('show');

  // Play notification sound
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* ignore */ }

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    dmToast.classList.remove('show');
    dmToast.classList.add('hidden');
  }, 4000);
}

dmToast.addEventListener('click', () => {
  const senderId = dmToast.dataset.senderId;
  const senderName = dmToast.dataset.senderName;
  if (senderId && senderName) {
    openDM(senderId, senderName);
  }
  dmToast.classList.remove('show');
  dmToast.classList.add('hidden');
  clearTimeout(toastTimeout);
});

function subscribeToDMs() {
  if (!sb || !currentUser) return;

  dmChannel = sb
    .channel('private:dms')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'private_messages'
    }, async (payload) => {
      const msg = payload.new;
      // Ignore messages not involving us
      if (msg.sender_id !== currentUser.id && msg.receiver_id !== currentUser.id) return;

      const isFromOther = msg.sender_id !== currentUser.id;

      // If someone new messages us, auto-add them as a contact
      if (isFromOther) {
        const alreadyContact = contactsData.some(c => c.contact_id === msg.sender_id);
        if (!alreadyContact) {
          await addContact(msg.sender_id, msg.sender_name);
        }

        // Show notification if not currently viewing their chat
        const isViewingTheirChat = currentView !== 'general' && currentView.contactId === msg.sender_id;
        if (!isViewingTheirChat) {
          showDMNotification(msg.sender_name, msg.content, msg.sender_id);
        }
      }

      // Render message if we're in that DM
      if (currentView !== 'general') {
        const otherId = currentView.contactId;
        if ((msg.sender_id === currentUser.id && msg.receiver_id === otherId) ||
            (msg.sender_id === otherId && msg.receiver_id === currentUser.id)) {
          chatMessages.appendChild(createDMMessageEl(msg));
          scrollToBottom();
        }
      }
    })
    .subscribe();
}

btnBackChat.addEventListener('click', () => {
  openGeneralChat();
});

// ===================== WebRTC Calling =====================
const callButtons = document.getElementById('callButtons');
const btnVoiceCall = document.getElementById('btnVoiceCall');
const btnVideoCall = document.getElementById('btnVideoCall');
const incomingCallModal = document.getElementById('incomingCallModal');
const incomingCallAvatar = document.getElementById('incomingCallAvatar');
const incomingCallName = document.getElementById('incomingCallName');
const incomingCallType = document.getElementById('incomingCallType');
const btnDeclineCall = document.getElementById('btnDeclineCall');
const btnAcceptCall = document.getElementById('btnAcceptCall');
const callOverlay = document.getElementById('callOverlay');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const callInfoCenter = document.getElementById('callInfoCenter');
const callAvatar = document.getElementById('callAvatar');
const callPeerName = document.getElementById('callPeerName');
const callTimer = document.getElementById('callTimer');
const btnToggleMute = document.getElementById('btnToggleMute');
const btnToggleVideo = document.getElementById('btnToggleVideo');
const btnEndCall = document.getElementById('btnEndCall');

let peerConnection = null;
let localStream = null;
let callSignalChannel = null;
let callTimerInterval = null;
let callStartTime = null;
let incomingCallData = null;
let isMuted = false;
let isVideoOff = false;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function subscribeToCallSignals() {
  if (!sb || !currentUser) return;

  callSignalChannel = sb
    .channel(`call-signals-${currentUser.id}`)
    .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
      handleIncomingCall(payload);
    })
    .on('broadcast', { event: 'call-answer' }, ({ payload }) => {
      handleCallAnswer(payload);
    })
    .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
      handleICECandidate(payload);
    })
    .on('broadcast', { event: 'call-end' }, () => {
      endCall(false);
    })
    .on('broadcast', { event: 'call-declined' }, async ({ payload }) => {
      endCall(false);
      // Insert missed call message from caller's perspective
      if (currentView !== 'general' && currentUser) {
        const callType = payload.withVideo ? 'video' : 'voice';
        await sb.from('private_messages').insert([{
          sender_id: currentUser.id,
          receiver_id: currentView.contactId,
          sender_name: currentUser.username,
          content: `__missed_call__:${callType}`,
          file_data: null,
          reply_to_content: null,
          reply_to_username: null
        }]);
      }
    })
    .subscribe();
}

function handleIncomingCall(data) {
  incomingCallData = data;
  incomingCallAvatar.textContent = getInitials(data.callerName);
  incomingCallName.textContent = data.callerName;
  incomingCallType.textContent = data.withVideo ? 'Incoming video call...' : 'Incoming voice call...';
  incomingCallModal.classList.remove('hidden');
}

btnDeclineCall.addEventListener('click', () => {
  if (incomingCallData) {
    sendCallSignal(incomingCallData.callerId, 'call-declined', {
      withVideo: incomingCallData.withVideo
    });
  }
  incomingCallData = null;
  incomingCallModal.classList.add('hidden');
});

btnAcceptCall.addEventListener('click', async () => {
  if (!incomingCallData) return;
  incomingCallModal.classList.add('hidden');

  const data = incomingCallData;
  incomingCallData = null;

  showCallOverlay(data.callerName, data.withVideo);

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: data.withVideo
    });

    if (data.withVideo) {
      localVideo.srcObject = localStream;
      localVideo.classList.remove('hidden');
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      if (data.withVideo) {
        remoteVideo.classList.remove('hidden');
        callInfoCenter.style.display = 'none';
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal(data.callerId, 'ice-candidate', { candidate: event.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        startCallTimer();
      }
      if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
        endCall(false);
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendCallSignal(data.callerId, 'call-answer', { answer });

  } catch (err) {
    console.error('Failed to accept call:', err);
    endCall(true);
  }
});

async function startCall(withVideo) {
  if (currentView === 'general' || !currentUser) return;

  const peerId = currentView.contactId;
  const peerName = currentView.contactName;

  showCallOverlay(peerName, withVideo);
  callTimer.textContent = 'Calling...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });

    if (withVideo) {
      localVideo.srcObject = localStream;
      localVideo.classList.remove('hidden');
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      if (withVideo) {
        remoteVideo.classList.remove('hidden');
        callInfoCenter.style.display = 'none';
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal(peerId, 'ice-candidate', { candidate: event.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        startCallTimer();
      }
      if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
        endCall(false);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendCallSignal(peerId, 'call-offer', {
      offer,
      callerId: currentUser.id,
      callerName: currentUser.username,
      withVideo
    });

  } catch (err) {
    console.error('Failed to start call:', err);
    alert('Could not access microphone/camera. Please allow permissions.');
    endCall(false);
  }
}

async function handleCallAnswer(data) {
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
}

async function handleICECandidate(data) {
  if (!peerConnection) return;
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (err) {
    console.error('ICE candidate error:', err);
  }
}

function sendCallSignal(targetUserId, event, payload) {
  if (!sb) return;
  sb.channel(`call-signals-${targetUserId}`).subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      sb.channel(`call-signals-${targetUserId}`).send({
        type: 'broadcast',
        event,
        payload
      });
    }
  });
}

function showCallOverlay(peerName, withVideo) {
  callAvatar.textContent = getInitials(peerName);
  callPeerName.textContent = peerName;
  callTimer.textContent = 'Connecting...';
  callInfoCenter.style.display = '';
  remoteVideo.classList.add('hidden');
  localVideo.classList.add('hidden');
  callOverlay.classList.remove('hidden');
  isMuted = false;
  isVideoOff = !withVideo;
  btnToggleMute.classList.remove('muted');
  btnToggleMute.innerHTML = '<i class="fas fa-microphone"></i>';
  if (withVideo) {
    btnToggleVideo.classList.remove('video-off');
    btnToggleVideo.innerHTML = '<i class="fas fa-video"></i>';
  } else {
    btnToggleVideo.classList.add('video-off');
    btnToggleVideo.innerHTML = '<i class="fas fa-video-slash"></i>';
  }
}

function startCallTimer() {
  callStartTime = Date.now();
  callTimer.textContent = '00:00';
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    callTimer.textContent = `${mins}:${secs}`;
  }, 1000);
}

function endCall(notify) {
  if (notify && currentView !== 'general') {
    sendCallSignal(currentView.contactId, 'call-end', {});
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }

  callStartTime = null;
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  callOverlay.classList.add('hidden');
  incomingCallModal.classList.add('hidden');
}

btnVoiceCall.addEventListener('click', () => startCall(false));
btnVideoCall.addEventListener('click', () => startCall(true));
btnEndCall.addEventListener('click', () => endCall(true));

btnToggleMute.addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  btnToggleMute.classList.toggle('muted', isMuted);
  btnToggleMute.innerHTML = isMuted
    ? '<i class="fas fa-microphone-slash"></i>'
    : '<i class="fas fa-microphone"></i>';
});

btnToggleVideo.addEventListener('click', async () => {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();

  if (videoTracks.length > 0) {
    isVideoOff = !isVideoOff;
    videoTracks.forEach(t => t.enabled = !isVideoOff);
    localVideo.classList.toggle('hidden', isVideoOff);
  }

  btnToggleVideo.classList.toggle('video-off', isVideoOff);
  btnToggleVideo.innerHTML = isVideoOff
    ? '<i class="fas fa-video-slash"></i>'
    : '<i class="fas fa-video"></i>';
});

// ===================== Init =====================
function initChat() {
  loadMessages();
  loadContacts();
  subscribeToMessages();
  subscribeToDMs();
  subscribeToPresence();
  subscribeToCallSignals();
}

function init() {
  initTheme();

  if (currentUser && currentUser.id && currentUser.username) {
    setUserUI(currentUser);
    hideAuthModal();
    initChat();
  } else {
    showAuthModal();
  }

  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    const notice = document.createElement('div');
    notice.className = 'system-message';
    notice.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <strong>Setup Required:</strong> Open <code>app.js</code> and add your Supabase URL & anon key.
    `;
    chatMessages.appendChild(notice);
  }
}

init();
