// ===================== WebRTC Calling & Signal Handling =====================
window.Convo = window.Convo || {};

(function () {
  const { sb, getInitials, updateBlockedUI } = window.Convo;
  const state = window.Convo.state;

  // ===================== DOM Elements =====================
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

  // ===================== State =====================
  let peerConnection = null;
  let localStream = null;
  let callSignalChannel = null;
  let callTimerInterval = null;
  let callStartTime = null;
  let incomingCallData = null;
  let isMuted = false;
  let isVideoOff = false;
  let currentCallWithVideo = false;
  let currentCallPeerId = null;
  let currentCallPeerName = null;
  const _sendChannels = {};

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // ===================== Signal Channel =====================
  function subscribeToCallSignals() {
    const currentUser = state.getCurrentUser();
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
      .on('broadcast', { event: 'call-end' }, async ({ payload }) => {
        const wasUnanswered = !callStartTime && (peerConnection || incomingCallData);
        const callType = (payload && payload.withVideo) || currentCallWithVideo ? 'video' : 'voice';
        const callerId = payload && payload.callerId;
        const callerName = payload && payload.callerName;
        const currentUser = state.getCurrentUser();
        endCall(false);
        if (wasUnanswered && currentUser && sb) {
          if (callerId) {
            await sb.from('private_messages').insert([{
              sender_id: callerId,
              receiver_id: currentUser.id,
              sender_name: callerName || 'Unknown',
              content: `__missed_call__:${callType}`,
              file_data: null,
              reply_to_content: null,
              reply_to_username: null
            }]);
          }
        }
      })
      .on('broadcast', { event: 'convo-deleted' }, ({ payload }) => {
        if (!payload || !payload.deletedBy) return;
        const deletedBy = payload.deletedBy;
        const contactsData = state.getContactsData();
        state.setContactsData(contactsData.filter(c => c.contact_id !== deletedBy));
        if (window.Convo.renderContacts) window.Convo.renderContacts();
        const currentView = state.getCurrentView();
        if (currentView !== 'general' && currentView.contactId === deletedBy) {
          if (window.Convo.openGeneralChat) window.Convo.openGeneralChat();
        }
      })
      .on('broadcast', { event: 'user-blocked' }, ({ payload }) => {
        if (!payload || !payload.blockedBy) return;
        state.getBlockedByUsers().add(payload.blockedBy);
        const currentView = state.getCurrentView();
        if (currentView !== 'general' && currentView.contactId === payload.blockedBy) {
          updateBlockedUI();
        }
      })
      .on('broadcast', { event: 'user-unblocked' }, ({ payload }) => {
        if (!payload || !payload.unblockedBy) return;
        state.getBlockedByUsers().delete(payload.unblockedBy);
        const currentView = state.getCurrentView();
        if (currentView !== 'general' && currentView.contactId === payload.unblockedBy) {
          updateBlockedUI();
        }
      })
      .on('broadcast', { event: 'call-declined' }, async ({ payload }) => {
        const callType = payload.withVideo ? 'video' : 'voice';
        const peerId = currentCallPeerId;
        const currentUser = state.getCurrentUser();
        endCall(false);
        if (peerId && currentUser && sb) {
          await sb.from('private_messages').insert([{
            sender_id: currentUser.id,
            receiver_id: peerId,
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

  function getCallSignalChannel() { return callSignalChannel; }

  // ===================== Incoming Call =====================
  function handleIncomingCall(data) {
    incomingCallData = data;
    currentCallWithVideo = data.withVideo;
    currentCallPeerId = data.callerId;
    currentCallPeerName = data.callerName;
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

  // ===================== Start Call =====================
  async function startCall(withVideo) {
    const currentUser = state.getCurrentUser();
    const currentView = state.getCurrentView();
    if (currentView === 'general' || currentView.channelId || !currentUser) return;

    const peerId = currentView.contactId;
    const peerName = currentView.contactName;

    currentCallWithVideo = withVideo;
    currentCallPeerId = peerId;
    currentCallPeerName = peerName;

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

  // ===================== Signaling Helpers =====================
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
    const channelName = `call-signals-${targetUserId}`;

    if (_sendChannels[targetUserId]) {
      _sendChannels[targetUserId].send({ type: 'broadcast', event, payload });
      return;
    }

    const ch = sb.channel(channelName);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        _sendChannels[targetUserId] = ch;
        ch.send({ type: 'broadcast', event, payload });
      }
    });
  }

  function cleanupSendChannels() {
    Object.keys(_sendChannels).forEach(id => {
      try { _sendChannels[id].unsubscribe(); } catch (e) { /* ignore */ }
      delete _sendChannels[id];
    });
  }

  // ===================== Call UI =====================
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
    const currentUser = state.getCurrentUser();
    const currentView = state.getCurrentView();
    if (notify && currentView !== 'general' && currentView.contactId) {
      sendCallSignal(currentView.contactId, 'call-end', {
        withVideo: currentCallWithVideo,
        callerId: currentUser ? currentUser.id : null,
        callerName: currentUser ? currentUser.username : null
      });
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
    currentCallPeerId = null;
    currentCallPeerName = null;
    currentCallWithVideo = false;
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    callOverlay.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    cleanupSendChannels();
  }

  // ===================== Button Listeners =====================
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

  // ===================== Exports =====================
  window.Convo.subscribeToCallSignals = subscribeToCallSignals;
  window.Convo.getCallSignalChannel = getCallSignalChannel;
  window.Convo.sendCallSignal = sendCallSignal;
  window.Convo.endCall = endCall;
})();
