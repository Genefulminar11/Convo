// ===================== Contacts, Presence, Search, Block System =====================
window.Convo = window.Convo || {};

(function () {
  const { sb, sanitize, getInitials, getAvatarHtml, showConfirmAction, updateBlockedUI, clearSearchHighlights, closeSidebar, scrollToBottom } = window.Convo;
  const { loadMessages } = window.Convo;
  const state = window.Convo.state;
  const dom = window.Convo.dom();

  let presenceChannel = null;

  // ===================== Presence (Online Users) =====================
  function subscribeToPresence() {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    presenceChannel = sb.channel('online-users', {
      config: {
        presence: { key: currentUser.id }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const presState = presenceChannel.presenceState();
        updateOnlineUsers(presState);
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

  function updateOnlineUsers(presState) {
    const users = [];
    const onlineUserIds = state.getOnlineUserIds();
    onlineUserIds.clear();
    for (const key in presState) {
      const presences = presState[key];
      if (presences && presences.length > 0) {
        users.push(presences[0]);
        onlineUserIds.add(presences[0].user_id);
      }
    }

    dom.userCountNum.textContent = users.length;
    renderContacts();

    const currentView = state.getCurrentView();
    if (currentView === 'general') {
      dom.chatRoomDesc.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;
    }

    if (currentView !== 'general' && currentView.contactId) {
      const dmDot = document.getElementById('dmStatusDot');
      const isOnline = onlineUserIds.has(currentView.contactId);
      dmDot.className = `dm-status-dot ${isOnline ? 'online' : 'offline'}`;
      dom.chatRoomDesc.textContent = isOnline ? 'Online' : 'Offline';
    }
  }

  function getPresenceChannel() { return presenceChannel; }

  // ===================== Search Users =====================
  let searchTimeout;
  dom.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = dom.searchInput.value.trim();
    if (query.length < 2) {
      dom.searchResults.classList.add('hidden');
      dom.searchResults.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(() => searchUsers(query), 300);
  });

  async function searchUsers(query) {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    const { data, error } = await sb
      .from('users')
      .select('id, username')
      .ilike('username', `%${query}%`)
      .neq('id', currentUser.id)
      .limit(20);

    if (error || !data) {
      dom.searchResults.classList.add('hidden');
      return;
    }

    const blockedByUsers = state.getBlockedByUsers();
    const filtered = data.filter(u => !blockedByUsers.has(u.id));
    const contactsData = state.getContactsData();

    if (filtered.length === 0) {
      dom.searchResults.innerHTML = '<div class="search-empty"><i class="fas fa-user-slash me-1"></i> No users found</div>';
      dom.searchResults.classList.remove('hidden');
      return;
    }

    dom.searchResults.innerHTML = filtered.map(u => {
      const isContact = contactsData.some(c => c.contact_id === u.id);
      return `
        <div class="search-result-item" data-user-id="${sanitize(u.id)}" data-username="${sanitize(u.username)}">
          <div class="search-result-avatar">${getAvatarHtml(u.id, u.username)}</div>
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
    dom.searchResults.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) {
      dom.searchResults.classList.add('hidden');
    }
  });

  dom.searchResults.addEventListener('click', async (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;

    const userId = item.dataset.userId;
    const username = item.dataset.username;
    const contactsData = state.getContactsData();
    const isContact = contactsData.some(c => c.contact_id === userId);

    if (!isContact) {
      await addContact(userId, username);
    }

    dom.searchResults.classList.add('hidden');
    dom.searchInput.value = '';
    if (window.Convo.openDM) window.Convo.openDM(userId, username);
  });

  // ===================== Contacts Management =====================
  async function loadContacts() {
    const currentUser = state.getCurrentUser();
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

    state.setContactsData(data || []);
    renderContacts();
  }

  async function loadBlockedUsers() {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    const { data: blocked } = await sb
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUser.id);

    const blockedUsers = state.getBlockedUsers();
    blockedUsers.clear();
    (blocked || []).forEach(b => blockedUsers.add(b.blocked_id));

    const { data: blockedBy } = await sb
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', currentUser.id);

    const blockedByUsers = state.getBlockedByUsers();
    blockedByUsers.clear();
    (blockedBy || []).forEach(b => blockedByUsers.add(b.blocker_id));
  }

  async function addContact(contactId, contactName) {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;
    const contactsData = state.getContactsData();
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
    const contactsData = state.getContactsData();
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
    const contactsData = state.getContactsData();
    if (!contactsData || contactsData.length === 0) {
      dom.contactsLabel.classList.add('hidden');
      dom.contactsList.innerHTML = '';
      return;
    }

    dom.contactsLabel.classList.remove('hidden');
    const currentView = state.getCurrentView();
    const onlineUserIds = state.getOnlineUserIds();

    const sorted = [...contactsData].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;
      return a.contact_name.localeCompare(b.contact_name);
    });

    dom.contactsList.innerHTML = sorted.map(c => {
      const isOnline = onlineUserIds.has(c.contact_id);
      const isActive = currentView !== 'general' && currentView.contactId === c.contact_id;
      return `
        <div class="conv-item ${isActive ? 'active' : ''}" data-contact-id="${sanitize(c.contact_id)}" data-contact-name="${sanitize(c.contact_name)}">
          <div class="conv-icon">
            ${isOnline ? '<span class="contact-online-dot"></span>' : ''}
            ${getAvatarHtml(c.contact_id, c.contact_name)}
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

  dom.contactsList.addEventListener('click', (e) => {
    const favBtn = e.target.closest('.btn-fav');
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.favId);
      return;
    }

    const item = e.target.closest('.conv-item');
    if (item) {
      if (window.Convo.openDM) window.Convo.openDM(item.dataset.contactId, item.dataset.contactName);
    }
  });

  dom.convGeneral.addEventListener('click', () => {
    if (window.Convo.openGeneralChat) window.Convo.openGeneralChat();
  });

  // ===================== Open General Chat =====================
  function openGeneralChat() {
    const currentUser = state.getCurrentUser();
    const onlineUserIds = state.getOnlineUserIds();
    state.setCurrentView('general');

    dom.chatRoomIcon.innerHTML = '<i class="fas fa-hashtag me-1"></i>';
    dom.chatRoomTitle.textContent = 'general';
    dom.chatRoomDesc.textContent = `${onlineUserIds.size} user${onlineUserIds.size !== 1 ? 's' : ''} online`;
    dom.btnBackChat.classList.add('hidden');
    document.getElementById('onlineCount').classList.add('hidden');
    dom.callButtons.classList.add('hidden');
    dom.btnSearchChat.classList.add('hidden');
    dom.headerMenuWrap.classList.add('hidden');
    dom.chatSearchBar.classList.add('hidden');
    clearSearchHighlights();
    dom.headerDropdown.classList.add('hidden');
    document.getElementById('channelHeaderActions').classList.add('hidden');

    const btnClear = document.getElementById('btnClearAllMsgs');
    if (currentUser && currentUser.is_admin) {
      btnClear.classList.remove('hidden');
    } else {
      btnClear.classList.add('hidden');
    }

    updateBlockedUI();

    dom.convGeneral.classList.add('active');
    renderContacts();
    if (window.Convo.renderChannels) window.Convo.renderChannels();

    loadMessages();
    closeSidebar();

    dom.messageInput.placeholder = 'Type a message...';
    dom.messageInput.focus();
  }

  // ===================== Header Menu (3-dot) =====================
  dom.btnHeaderMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.headerDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    dom.headerDropdown.classList.add('hidden');
  });

  dom.headerDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Delete Conversation
  dom.btnDeleteConvo.addEventListener('click', () => {
    dom.headerDropdown.classList.add('hidden');
    const currentView = state.getCurrentView();
    if (typeof currentView === 'string') return;
    showConfirmAction(
      'Delete Conversation',
      `Delete all messages with <span class="highlight-name">@${sanitize(currentView.contactName)}</span>? This cannot be undone.`,
      async () => {
        const currentUser = state.getCurrentUser();
        const contactId = currentView.contactId;
        await sb.from('private_messages').delete()
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUser.id})`);
        await sb.from('contacts').delete()
          .or(`and(user_id.eq.${currentUser.id},contact_id.eq.${contactId}),and(user_id.eq.${contactId},contact_id.eq.${currentUser.id})`);
        if (window.Convo.sendCallSignal) {
          window.Convo.sendCallSignal(contactId, 'convo-deleted', {
            deletedBy: currentUser.id,
            deletedByName: currentUser.username
          });
        }
        const contactsData = state.getContactsData();
        state.setContactsData(contactsData.filter(c => c.contact_id !== contactId));
        openGeneralChat();
      }
    );
  });

  // Block User
  dom.btnBlockUser.addEventListener('click', () => {
    dom.headerDropdown.classList.add('hidden');
    const currentView = state.getCurrentView();
    if (typeof currentView === 'string') return;
    showConfirmAction(
      'Block User',
      `Block <span class="highlight-name">@${sanitize(currentView.contactName)}</span>? They won't be able to find or message you.`,
      async () => {
        const currentUser = state.getCurrentUser();
        const contactId = currentView.contactId;
        await sb.from('blocked_users').insert([{
          blocker_id: currentUser.id,
          blocked_id: contactId
        }]);
        state.getBlockedUsers().add(contactId);
        await sb.from('contacts').delete()
          .eq('user_id', contactId)
          .eq('contact_id', currentUser.id);
        if (window.Convo.sendCallSignal) {
          window.Convo.sendCallSignal(contactId, 'convo-deleted', {
            deletedBy: currentUser.id,
            deletedByName: currentUser.username
          });
          window.Convo.sendCallSignal(contactId, 'user-blocked', {
            blockedBy: currentUser.id
          });
        }
        dom.btnBlockUser.classList.add('hidden');
        dom.btnUnblockUser.classList.remove('hidden');
        updateBlockedUI();
      }
    );
  });

  // Unblock User
  dom.btnUnblockUser.addEventListener('click', () => {
    dom.headerDropdown.classList.add('hidden');
    const currentView = state.getCurrentView();
    if (typeof currentView === 'string') return;
    showConfirmAction(
      'Unblock User',
      `Unblock <span class="highlight-name">@${sanitize(currentView.contactName)}</span>? They will be able to find and message you again.`,
      async () => {
        const currentUser = state.getCurrentUser();
        const contactId = currentView.contactId;
        await sb.from('blocked_users').delete()
          .eq('blocker_id', currentUser.id)
          .eq('blocked_id', contactId);
        state.getBlockedUsers().delete(contactId);
        if (window.Convo.sendCallSignal) {
          window.Convo.sendCallSignal(contactId, 'user-unblocked', {
            unblockedBy: currentUser.id
          });
        }
        dom.btnUnblockUser.classList.add('hidden');
        dom.btnBlockUser.classList.remove('hidden');
        updateBlockedUI();
      }
    );
  });

  // Banner unblock
  dom.btnBannerUnblock.addEventListener('click', async () => {
    const currentView = state.getCurrentView();
    if (typeof currentView === 'string') return;
    const currentUser = state.getCurrentUser();
    const contactId = currentView.contactId;
    await sb.from('blocked_users').delete()
      .eq('blocker_id', currentUser.id)
      .eq('blocked_id', contactId);
    state.getBlockedUsers().delete(contactId);
    if (window.Convo.sendCallSignal) {
      window.Convo.sendCallSignal(contactId, 'user-unblocked', {
        unblockedBy: currentUser.id
      });
    }
    dom.btnUnblockUser.classList.add('hidden');
    dom.btnBlockUser.classList.remove('hidden');
    updateBlockedUI();
  });

  // ===================== Exports =====================
  window.Convo.loadContacts = loadContacts;
  window.Convo.loadBlockedUsers = loadBlockedUsers;
  window.Convo.addContact = addContact;
  window.Convo.renderContacts = renderContacts;
  window.Convo.subscribeToPresence = subscribeToPresence;
  window.Convo.getPresenceChannel = getPresenceChannel;
  window.Convo.openGeneralChat = openGeneralChat;
})();
