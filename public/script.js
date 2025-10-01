class VideoChat {
    constructor() {
        this.socket = io();
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.roomId = null;
        this.partnerId = null;
        this.isMuted = false;
        this.isVideoOn = true;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Screens
        this.startScreen = document.getElementById('start-screen');
        this.waitingScreen = document.getElementById('waiting-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.endScreen = document.getElementById('end-screen');
        
        // Buttons
        this.startChatBtn = document.getElementById('start-chat-btn');
        this.cancelSearchBtn = document.getElementById('cancel-search-btn');
        this.endChatBtn = document.getElementById('end-chat-btn');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.videoBtn = document.getElementById('video-btn');
        this.sendBtn = document.getElementById('send-btn');
        
        // Video elements
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
    }

    setupEventListeners() {
        this.startChatBtn.addEventListener('click', () => this.startChat());
        this.cancelSearchBtn.addEventListener('click', () => this.cancelSearch());
        this.endChatBtn.addEventListener('click', () => this.endChat());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('waiting-for-match', () => {
            this.showScreen('waiting-screen');
        });

        this.socket.on('chat-matched', (data) => {
            this.roomId = data.roomId;
            this.partnerId = data.partnerId;
            this.showScreen('chat-screen');
            
            // Ensure remote video element is ready
            this.remoteVideo.muted = false;
            this.remoteVideo.autoplay = true;
            this.remoteVideo.playsInline = true;
            
            // Initialize peer connection with a small delay
            setTimeout(() => {
                this.initializePeerConnection();
            }, 100);
            
            // Set up connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                    console.log('Connection timeout, attempting restart...');
                    this.restartConnection();
                }
            }, 10000); // 10 second timeout
        });

        this.socket.on('offer', async (data) => {
            await this.handleOffer(data.offer);
        });

        this.socket.on('answer', async (data) => {
            await this.handleAnswer(data.answer);
        });

        this.socket.on('ice-candidate', async (data) => {
            await this.handleIceCandidate(data.candidate);
        });

        this.socket.on('chat-message', (data) => {
            this.displayMessage(data.message, false, data.timestamp);
        });

        this.socket.on('partner-disconnected', () => {
            this.showScreen('end-screen');
            this.cleanup();
        });

        this.socket.on('chat-ended', () => {
            this.showScreen('end-screen');
            this.cleanup();
        });
    }

    async startChat() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.localVideo.srcObject = this.localStream;
            this.localVideo.muted = true; // Mute local video to prevent echo
            
            // Wait a moment for video to load before starting chat
            setTimeout(() => {
                this.socket.emit('find-chat');
            }, 500);
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Unable to access camera and microphone. Please check your permissions and try again.');
        }
    }

    cancelSearch() {
        this.socket.emit('disconnect');
        this.showScreen('start-screen');
        this.cleanup();
    }

    async initializePeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Add local stream to peer connection
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream:', event.streams[0]);
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
            
            // Ensure video plays
            this.remoteVideo.onloadedmetadata = () => {
                this.remoteVideo.play().catch(e => console.log('Error playing remote video:', e));
            };
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    roomId: this.roomId
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                console.log('Connection failed, attempting to restart...');
                this.restartConnection();
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed, attempting to restart...');
                this.restartConnection();
            }
        };

        // Handle data channel (for additional reliability)
        this.peerConnection.ondatachannel = (event) => {
            console.log('Data channel received');
        };

        // Create and send offer
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await this.peerConnection.setLocalDescription(offer);
            console.log('Offer created and sent');
            this.socket.emit('offer', {
                offer: offer,
                roomId: this.roomId
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(offer) {
        console.log('Handling offer from partner');
        
        if (!this.peerConnection) {
            await this.initializePeerConnection();
        }

        try {
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                answer: answer,
                roomId: this.roomId
            });
            console.log('Answer sent to partner');
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer) {
        console.log('Handling answer from partner');
        try {
            await this.peerConnection.setRemoteDescription(answer);
            console.log('Remote description set successfully');
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        console.log('Handling ICE candidate');
        if (this.peerConnection) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
                console.log('ICE candidate added successfully');
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                this.muteBtn.classList.toggle('active', this.isMuted);
                this.muteBtn.querySelector('.icon').textContent = this.isMuted ? '🔇' : '🔊';
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoOn = videoTrack.enabled;
                this.videoBtn.classList.toggle('active', !this.isVideoOn);
                this.videoBtn.querySelector('.icon').textContent = this.isVideoOn ? '📹' : '📷';
            }
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (message && this.roomId) {
            this.socket.emit('chat-message', {
                message: message,
                roomId: this.roomId
            });
            this.displayMessage(message, true);
            this.chatInput.value = '';
        }
    }

    displayMessage(message, isOwn, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        
        const time = timestamp ? new Date(timestamp) : new Date();
        const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div>${this.escapeHtml(message)}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    endChat() {
        if (this.roomId) {
            this.socket.emit('end-chat', { roomId: this.roomId });
        }
        this.showScreen('end-screen');
        this.cleanup();
    }

    startNewChat() {
        this.showScreen('start-screen');
        this.cleanup();
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    async restartConnection() {
        console.log('Restarting WebRTC connection...');
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Wait a bit before restarting
        setTimeout(async () => {
            if (this.roomId && this.localStream) {
                await this.initializePeerConnection();
            }
        }, 1000);
    }

    cleanup() {
        // Clear connection timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        this.chatMessages.innerHTML = '';
        this.roomId = null;
        this.partnerId = null;
        this.isMuted = false;
        this.isVideoOn = true;
        
        // Reset UI
        this.muteBtn.classList.remove('active');
        this.videoBtn.classList.remove('active');
        this.muteBtn.querySelector('.icon').textContent = '🔇';
        this.videoBtn.querySelector('.icon').textContent = '📹';
    }
}

// Initialize the video chat when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoChat();
});
