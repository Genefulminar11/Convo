// ===================== General Chat (Public Messages) =====================
// Message rendering, loading, sending, realtime subscription, replies, admin delete
window.Convo = window.Convo || {};

(function () {
  const { sb, sanitize, getAvatarHtml, formatTime, uploadFile, showConfirmAction, scrollToBottom } = window.Convo;
  const state = window.Convo.state;
  const dom = window.Convo.dom();

  let realtimeChannel = null;

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
    const currentUser = state.getCurrentUser();
    const isOwn = currentUser && msg.user_id === currentUser.id;
    const isAdmin = currentUser && currentUser.is_admin;
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.msgId = msg.id;
    const fileHtml = msg.file_data ? renderFileContent(msg.file_data) : '';
    const textHtml = msg.content ? `<div class="message-bubble">${sanitize(msg.content)}</div>` : '';
    const replyHtml = msg.reply_to_content ? `<div class="reply-quote"><span class="reply-quote-name">${sanitize(msg.reply_to_username || 'User')}</span><span class="reply-quote-text">${sanitize(msg.reply_to_content)}</span></div>` : '';
    const adminDeleteHtml = isAdmin ? `<button class="btn-admin-delete" title="Delete message" data-msg-id="${msg.id}"><i class="fas fa-trash"></i></button>` : '';
    div.innerHTML = `
      <div class="message-avatar">${getAvatarHtml(msg.user_id, msg.username)}</div>
      <div class="message-content">
        ${replyHtml}
        ${textHtml}
        ${fileHtml}
        <div class="message-meta">
          <span class="message-sender">${sanitize(msg.username)}</span>
          <span class="message-time">${formatTime(msg.created_at)}</span>
        </div>
      </div>
      ${adminDeleteHtml}
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
    dom.chatMessages.innerHTML = '';
    if (data.length === 0 && welcomeMsg) {
      dom.chatMessages.appendChild(welcomeMsg);
    }

    data.forEach(msg => {
      dom.chatMessages.appendChild(createMessageEl(msg));
    });

    scrollToBottom();
  }

  // ===================== Admin: Delete Messages =====================
  const btnClearAllMsgs = document.getElementById('btnClearAllMsgs');

  dom.chatMessages.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-admin-delete');
    if (!delBtn) return;
    const currentUser = state.getCurrentUser();
    if (!currentUser || !currentUser.is_admin) return;
    const msgId = delBtn.dataset.msgId;
    if (!msgId) return;
    const { error } = await sb.from('messages').delete().eq('id', msgId);
    if (error) console.error('Delete message error:', error);
  });

  btnClearAllMsgs.addEventListener('click', () => {
    const currentUser = state.getCurrentUser();
    if (!currentUser || !currentUser.is_admin) return;
    showConfirmAction(
      'Clear All Messages',
      'Delete <span class="highlight-name">all messages</span> in the general chat? This cannot be undone.',
      async () => {
        const { error } = await sb.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
          console.error('Clear all error:', error);
          return;
        }
        dom.chatMessages.innerHTML = '';
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'system-message';
        welcomeMsg.id = 'welcomeMsg';
        welcomeMsg.innerHTML = '<i class="fas fa-hand-wave"></i> Welcome to <strong>Convo</strong>! Messages are loaded in real-time.';
        dom.chatMessages.appendChild(welcomeMsg);
      }
    );
  });

  // ===================== Send Message =====================
  dom.messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = state.getCurrentUser();
    const currentView = state.getCurrentView();
    const content = dom.messageInput.value.trim();
    let selectedFile = state.getSelectedFile();
    let replyingTo = state.getReplyingTo();

    if ((!content && !selectedFile) || !currentUser || !sb) return;

    dom.messageInput.value = '';
    dom.messageInput.focus();

    let fileData = null;
    if (selectedFile) {
      const btnSend = document.getElementById('btnSend');
      btnSend.disabled = true;
      btnSend.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      fileData = await uploadFile(selectedFile);
      btnSend.disabled = false;
      btnSend.innerHTML = '<i class="fas fa-paper-plane"></i>';
      state.setSelectedFile(null);
      dom.fileInput.value = '';
      dom.filePreview.classList.add('hidden');
    }

    const msgContent = content || '';
    const fileJson = fileData ? JSON.stringify(fileData) : null;
    const replyContent = replyingTo ? replyingTo.content : null;
    const replyUsername = replyingTo ? replyingTo.username : null;

    state.setReplyingTo(null);
    dom.replyBar.classList.add('hidden');

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
        dom.messageInput.value = content;
      }
    } else if (currentView.channelId) {
      const { error } = await sb
        .from('channel_messages')
        .insert([{
          channel_id: currentView.channelId,
          user_id: currentUser.id,
          username: currentUser.username,
          content: msgContent,
          file_data: fileJson,
          reply_to_content: replyContent,
          reply_to_username: replyUsername
        }]);

      if (error) {
        console.error('Error sending channel message:', error);
        dom.messageInput.value = content;
      }
    } else {
      const blockedByUsers = state.getBlockedByUsers();
      if (blockedByUsers.has(currentView.contactId)) {
        dom.messageInput.value = content;
        return;
      }
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
        dom.messageInput.value = content;
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
        if (state.getCurrentView() === 'general') {
          dom.chatMessages.appendChild(createMessageEl(payload.new));
          scrollToBottom();
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        if (state.getCurrentView() === 'general') {
          const el = dom.chatMessages.querySelector(`[data-msg-id="${payload.old.id}"]`);
          if (el) el.remove();
        }
      })
      .subscribe();
  }

  function getRealtimeChannel() { return realtimeChannel; }

  // ===================== Exports =====================
  window.Convo.renderFileContent = renderFileContent;
  window.Convo.createMessageEl = createMessageEl;
  window.Convo.loadMessages = loadMessages;
  window.Convo.subscribeToMessages = subscribeToMessages;
  window.Convo.getRealtimeChannel = getRealtimeChannel;
})();
