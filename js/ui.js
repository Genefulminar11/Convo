// ===================== UI Utilities =====================
// Theme, sidebar, emoji picker, file attachment, modals, confirm dialogs, chat search
window.Convo = window.Convo || {};

(function () {
  const { sanitize, formatFileSize, getInitials } = window.Convo;

  // ===================== State =====================
  let currentUser = null;
  let currentView = 'general';
  let contactsData = [];
  let onlineUserIds = new Set();
  let selectedFile = null;
  let replyingTo = null;
  let blockedUsers = new Set();
  let blockedByUsers = new Set();

  // Restore session
  try {
    const saved = localStorage.getItem('convo_session');
    if (saved) currentUser = JSON.parse(saved);
  } catch (e) { /* ignore */ }

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
  const callButtons = document.getElementById('callButtons');
  const btnSearchChat = document.getElementById('btnSearchChat');
  const headerMenuWrap = document.getElementById('headerMenuWrap');
  const btnHeaderMenu = document.getElementById('btnHeaderMenu');
  const headerDropdown = document.getElementById('headerDropdown');
  const btnDeleteConvo = document.getElementById('btnDeleteConvo');
  const btnBlockUser = document.getElementById('btnBlockUser');
  const btnUnblockUser = document.getElementById('btnUnblockUser');
  const blockedBanner = document.getElementById('blockedBanner');
  const blockedBannerMsg = document.getElementById('blockedBannerMsg');
  const blockedBannerSub = document.getElementById('blockedBannerSub');
  const btnBannerUnblock = document.getElementById('btnBannerUnblock');
  const chatInputArea = document.getElementById('chatInputArea');
  const replyBar = document.getElementById('replyBar');
  const replyBarName = document.getElementById('replyBarName');
  const replyBarContent = document.getElementById('replyBarContent');
  const replyBarClose = document.getElementById('replyBarClose');
  const chatSearchBar = document.getElementById('chatSearchBar');
  const chatSearchInput = document.getElementById('chatSearchInput');
  const chatSearchCount = document.getElementById('chatSearchCount');
  const btnSearchPrev = document.getElementById('btnSearchPrev');
  const btnSearchNext = document.getElementById('btnSearchNext');
  const btnSearchClose = document.getElementById('btnSearchClose');

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  // ===================== Shared State Accessors =====================
  function getCurrentUser() { return currentUser; }
  function setCurrentUser(u) { currentUser = u; }
  function getCurrentView() { return currentView; }
  function setCurrentView(v) { currentView = v; }
  function getContactsData() { return contactsData; }
  function setContactsData(d) { contactsData = d; }
  function getOnlineUserIds() { return onlineUserIds; }
  function getSelectedFile() { return selectedFile; }
  function setSelectedFile(f) { selectedFile = f; }
  function getReplyingTo() { return replyingTo; }
  function setReplyingTo(r) { replyingTo = r; }
  function getBlockedUsers() { return blockedUsers; }
  function getBlockedByUsers() { return blockedByUsers; }

  // ===================== DOM Accessors =====================
  function getDOM() {
    return {
      chatMessages, messageForm, messageInput, authModal,
      registerForm, loginForm, authRegister, authLogin, authWelcome,
      registerError, loginError, userNameDisplay, userIdSmall,
      btnLogout, themeToggle, sidebarOpenBtn, sidebar, userCountNum,
      searchInput, searchResults, contactsList, contactsLabel,
      convGeneral, btnBackChat, chatRoomIcon, chatRoomTitle, chatRoomDesc,
      btnEmoji, emojiPanel, btnAttach, fileInput, filePreview,
      filePreviewName, filePreviewSize, btnFileRemove, callButtons,
      btnSearchChat, headerMenuWrap, btnHeaderMenu, headerDropdown,
      btnDeleteConvo, btnBlockUser, btnUnblockUser,
      blockedBanner, blockedBannerMsg, blockedBannerSub, btnBannerUnblock,
      chatInputArea, replyBar, replyBarName, replyBarContent, replyBarClose,
      chatSearchBar, chatSearchInput, chatSearchCount,
      btnSearchPrev, btnSearchNext, btnSearchClose
    };
  }

  // ===================== Scrolling =====================
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ===================== Error Display =====================
  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    el.textContent = '';
    el.classList.add('hidden');
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
      label.textContent = 'Search Results';
      const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
      const filtered = allEmojis.filter(() => true);
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
    const tab = e.target.closest('.emoji-cat-tab');
    if (tab) {
      activeEmojiCategory = tab.dataset.cat;
      emojiSearchQuery = '';
      buildEmojiPanel();
      emojiPanel.classList.remove('hidden');
      return;
    }

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

  // ===================== Blocked UI =====================
  function updateBlockedUI() {
    if (typeof currentView === 'string') {
      blockedBanner.classList.add('hidden');
      chatInputArea.classList.remove('hidden');
      return;
    }
    const contactId = currentView.contactId;
    const contactName = currentView.contactName;

    if (blockedUsers.has(contactId)) {
      blockedBannerMsg.textContent = `You blocked ${contactName}`;
      blockedBannerSub.textContent = "You can't message or call them in this chat, and you won't receive their messages or calls.";
      btnBannerUnblock.textContent = 'Unblock';
      btnBannerUnblock.classList.remove('hidden');
      blockedBanner.classList.remove('hidden');
      chatInputArea.classList.add('hidden');
      callButtons.classList.add('hidden');
    } else if (blockedByUsers.has(contactId)) {
      blockedBannerMsg.textContent = "You can't reply to this conversation";
      blockedBannerSub.textContent = "This user is no longer available.";
      btnBannerUnblock.classList.add('hidden');
      blockedBanner.classList.remove('hidden');
      chatInputArea.classList.add('hidden');
      callButtons.classList.add('hidden');
    } else {
      blockedBanner.classList.add('hidden');
      chatInputArea.classList.remove('hidden');
    }
  }

  // ===================== Confirm Action Dialog =====================
  function showConfirmAction(title, message, onConfirm) {
    const existing = document.getElementById('confirmActionOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'confirm-action-overlay';
    overlay.id = 'confirmActionOverlay';
    overlay.innerHTML = `
      <div class="confirm-action-box">
        <h4>${title}</h4>
        <p>${message}</p>
        <div class="confirm-action-btns">
          <button class="btn-action-cancel" id="btnActionCancel">Cancel</button>
          <button class="btn-action-confirm" id="btnActionConfirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btnActionCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('btnActionConfirm').addEventListener('click', async () => {
      overlay.remove();
      await onConfirm();
    });
  }

  // ===================== Chat Search =====================
  let searchMatches = [];
  let searchIndex = -1;

  btnSearchChat.addEventListener('click', () => {
    chatSearchBar.classList.toggle('hidden');
    if (!chatSearchBar.classList.contains('hidden')) {
      chatSearchInput.value = '';
      clearSearchHighlights();
      chatSearchCount.classList.add('hidden');
      chatSearchInput.focus();
    } else {
      clearSearchHighlights();
    }
  });

  btnSearchClose.addEventListener('click', () => {
    chatSearchBar.classList.add('hidden');
    clearSearchHighlights();
  });

  chatSearchInput.addEventListener('input', () => {
    const q = chatSearchInput.value.trim().toLowerCase();
    clearSearchHighlights();
    if (!q) {
      chatSearchCount.classList.add('hidden');
      return;
    }
    const msgs = chatMessages.querySelectorAll('.message');
    searchMatches = [];
    msgs.forEach(el => {
      const bubble = el.querySelector('.message-bubble');
      if (bubble && bubble.textContent.toLowerCase().includes(q)) {
        searchMatches.push(el);
        el.classList.add('message-highlight');
      }
    });
    chatSearchCount.classList.remove('hidden');
    if (searchMatches.length > 0) {
      searchIndex = searchMatches.length - 1;
      updateSearchNav();
    } else {
      searchIndex = -1;
      chatSearchCount.textContent = '0/0';
    }
  });

  btnSearchNext.addEventListener('click', () => {
    if (searchMatches.length === 0) return;
    searchIndex = (searchIndex + 1) % searchMatches.length;
    updateSearchNav();
  });

  btnSearchPrev.addEventListener('click', () => {
    if (searchMatches.length === 0) return;
    searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    updateSearchNav();
  });

  function updateSearchNav() {
    searchMatches.forEach(el => el.classList.remove('message-highlight-active'));
    if (searchMatches[searchIndex]) {
      searchMatches[searchIndex].classList.add('message-highlight-active');
      searchMatches[searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    chatSearchCount.textContent = `${searchIndex + 1}/${searchMatches.length}`;
  }

  function clearSearchHighlights() {
    searchMatches.forEach(el => {
      el.classList.remove('message-highlight', 'message-highlight-active');
    });
    searchMatches = [];
    searchIndex = -1;
  }

  // ===================== Reply =====================
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

  // ===================== Exports =====================
  window.Convo.state = {
    getCurrentUser, setCurrentUser,
    getCurrentView, setCurrentView,
    getContactsData, setContactsData,
    getOnlineUserIds, getSelectedFile, setSelectedFile,
    getReplyingTo, setReplyingTo,
    getBlockedUsers, getBlockedByUsers
  };
  window.Convo.dom = getDOM;
  window.Convo.scrollToBottom = scrollToBottom;
  window.Convo.showError = showError;
  window.Convo.hideError = hideError;
  window.Convo.initTheme = initTheme;
  window.Convo.openSidebar = openSidebar;
  window.Convo.closeSidebar = closeSidebar;
  window.Convo.updateBlockedUI = updateBlockedUI;
  window.Convo.showConfirmAction = showConfirmAction;
  window.Convo.clearSearchHighlights = clearSearchHighlights;
})();
