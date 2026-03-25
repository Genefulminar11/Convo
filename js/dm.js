// ===================== DM (Private Messaging) & Notifications =====================
window.Convo = window.Convo || {};

(function () {
  const { sb, sanitize, getInitials, getAvatarHtml, formatTime, scrollToBottom } = window.Convo;
  const { renderFileContent, updateBlockedUI, clearSearchHighlights, closeSidebar } = window.Convo;
  const state = window.Convo.state;
  const dom = window.Convo.dom();

  let dmChannel = null;

  // ===================== DM Toast Notifications =====================
  const dmToast = document.getElementById('dmToast');
  const dmToastAvatar = document.getElementById('dmToastAvatar');
  const dmToastName = document.getElementById('dmToastName');
  const dmToastMsg = document.getElementById('dmToastMsg');
  let toastTimeout = null;

  function showDMNotification(senderName, content, senderId) {
    dmToastAvatar.innerHTML = getAvatarHtml(senderId, senderName);
    dmToastName.textContent = senderName;
    dmToastMsg.textContent = content || '📎 Sent an attachment';
    dmToast.dataset.senderId = senderId;
    dmToast.dataset.senderName = senderName;

    dmToast.classList.remove('hidden');
    dmToast.classList.add('show');

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

  // ===================== DM Message Rendering =====================
  function createDMMessageEl(msg) {
    const currentUser = state.getCurrentUser();
    const isOwn = currentUser && msg.sender_id === currentUser.id;

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
      <div class="message-avatar">${getAvatarHtml(msg.sender_id, msg.sender_name)}</div>
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

  // ===================== Load DM Messages =====================
  async function loadDMMessages(contactId) {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    dom.chatMessages.innerHTML = '';

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
      dom.chatMessages.appendChild(emptyMsg);
    }

    (data || []).forEach(msg => {
      dom.chatMessages.appendChild(createDMMessageEl(msg));
    });

    scrollToBottom();
  }

  // ===================== Open DM View =====================
  function openDM(contactId, contactName) {
    state.setCurrentView({ contactId, contactName });

    dom.chatRoomIcon.innerHTML = '<i class="fas fa-user me-1"></i>';
    dom.chatRoomTitle.textContent = contactName;
    dom.btnBackChat.classList.remove('hidden');
    document.getElementById('onlineCount').classList.add('hidden');

    dom.callButtons.classList.remove('hidden');
    dom.btnSearchChat.classList.remove('hidden');
    dom.headerMenuWrap.classList.remove('hidden');
    dom.chatSearchBar.classList.add('hidden');
    clearSearchHighlights();
    document.getElementById('btnClearAllMsgs').classList.add('hidden');
    document.getElementById('channelHeaderActions').classList.add('hidden');

    const blockedUsers = state.getBlockedUsers();
    if (blockedUsers.has(contactId)) {
      dom.btnBlockUser.classList.add('hidden');
      dom.btnUnblockUser.classList.remove('hidden');
    } else {
      dom.btnBlockUser.classList.remove('hidden');
      dom.btnUnblockUser.classList.add('hidden');
    }

    const dmDot = document.getElementById('dmStatusDot');
    const onlineUserIds = state.getOnlineUserIds();
    const isOnline = onlineUserIds.has(contactId);
    dmDot.classList.remove('hidden');
    dmDot.className = `dm-status-dot ${isOnline ? 'online' : 'offline'}`;
    dom.chatRoomDesc.textContent = isOnline ? 'Online' : 'Offline';

    dom.convGeneral.classList.remove('active');
    if (window.Convo.renderContacts) window.Convo.renderContacts();
    if (window.Convo.renderChannels) window.Convo.renderChannels();

    loadDMMessages(contactId);
    closeSidebar();

    dom.messageInput.placeholder = `Message ${contactName}...`;
    updateBlockedUI();
    const blockedByUsers = state.getBlockedByUsers();
    if (!blockedUsers.has(contactId) && !blockedByUsers.has(contactId)) {
      dom.messageInput.focus();
    }
  }

  // ===================== Subscribe to DMs =====================
  function subscribeToDMs() {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    dmChannel = sb
      .channel('private:dms')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages'
      }, async (payload) => {
        const msg = payload.new;
        const currentUser = state.getCurrentUser();
        const currentView = state.getCurrentView();
        if (msg.sender_id !== currentUser.id && msg.receiver_id !== currentUser.id) return;

        const isFromOther = msg.sender_id !== currentUser.id;
        const blockedUsers = state.getBlockedUsers();
        const blockedByUsers = state.getBlockedByUsers();

        if (isFromOther && (blockedUsers.has(msg.sender_id) || blockedByUsers.has(msg.sender_id))) return;

        if (isFromOther) {
          const contactsData = state.getContactsData();
          const alreadyContact = contactsData.some(c => c.contact_id === msg.sender_id);
          if (!alreadyContact) {
            if (window.Convo.addContact) await window.Convo.addContact(msg.sender_id, msg.sender_name);
          }

          const isViewingTheirChat = currentView !== 'general' && currentView.contactId === msg.sender_id;
          if (!isViewingTheirChat) {
            showDMNotification(msg.sender_name, msg.content, msg.sender_id);
          }
        }

        if (currentView !== 'general') {
          const otherId = currentView.contactId;
          if ((msg.sender_id === currentUser.id && msg.receiver_id === otherId) ||
              (msg.sender_id === otherId && msg.receiver_id === currentUser.id)) {
            dom.chatMessages.appendChild(createDMMessageEl(msg));
            scrollToBottom();
          }
        }
      })
      .subscribe();
  }

  function getDMChannel() { return dmChannel; }

  // ===================== Back Button =====================
  dom.btnBackChat.addEventListener('click', () => {
    if (window.Convo.openGeneralChat) window.Convo.openGeneralChat();
  });

  // ===================== Exports =====================
  window.Convo.openDM = openDM;
  window.Convo.loadDMMessages = loadDMMessages;
  window.Convo.createDMMessageEl = createDMMessageEl;
  window.Convo.subscribeToDMs = subscribeToDMs;
  window.Convo.getDMChannel = getDMChannel;
  window.Convo.showDMNotification = showDMNotification;
})();
