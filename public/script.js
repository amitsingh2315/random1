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
        this.pendingIceCandidates = [];
        
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
            
            // Ensure remote video element is ready for both audio and video
            this.remoteVideo.muted = false;
            this.remoteVideo.autoplay = true;
            this.remoteVideo.playsInline = true;
            this.remoteVideo.controls = false;
            
            // Set up event listeners for remote video
            this.remoteVideo.oncanplay = () => {
                console.log('Remote video can play');
                this.remoteVideo.play().catch(e => console.log('Error playing remote video on canplay:', e));
            };
            
            this.remoteVideo.onplay = () => {
                console.log('Remote video started playing');
            };
            
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
            }, 15000); // Increased to 15 second timeout
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
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            
            this.localVideo.srcObject = this.localStream;
            this.localVideo.muted = true; // Mute local video to prevent echo
            
            // Verify we have both audio and video tracks
            const audioTracks = this.localStream.getAudioTracks();
            const videoTracks = this.localStream.getVideoTracks();
            
            console.log('Local audio tracks:', audioTracks.length);
            console.log('Local video tracks:', videoTracks.length);
            
            if (audioTracks.length === 0) {
                console.warn('No audio track found in local stream');
            }
            if (videoTracks.length === 0) {
                console.warn('No video track found in local stream');
            }
            
            // Ensure audio tracks are enabled
            audioTracks.forEach(track => {
                track.enabled = true;
                console.log('Audio track enabled:', track.enabled, 'muted:', track.muted);
            });
            
            // Test TURN server connectivity
            this.testTurnServer();
            
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
                // Google STUN servers
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                
                // Additional reliable STUN servers
                { urls: 'stun:stun.ekiga.net' },
                { urls: 'stun:stun.ideasip.com' },
                { urls: 'stun:stun.schlund.de' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.voiparound.com' },
                { urls: 'stun:stun.voipbuster.com' },
                { urls: 'stun:stun.voipstunt.com' },
                { urls: 'stun:stun.counterpath.com' },
                { urls: 'stun:stun.1und1.de' },
                { urls: 'stun:stun.gmx.net' },
                { urls: 'stun:stun.callwithus.com' },
                { urls: 'stun:stun.internetcalls.com' },
                
                // TURN servers for NAT traversal (free public TURN servers)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:80?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                
                // Additional TURN servers
                {
                    urls: 'turn:freeturn.tel:3478',
                    username: 'free',
                    credential: 'free'
                },
                {
                    urls: 'turn:freeturn.tel:3478?transport=tcp',
                    username: 'free',
                    credential: 'free'
                }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidateTimeout: 30000,
            iceGatheringTimeout: 10000
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
            
            // Ensure both video and audio play automatically
            this.remoteVideo.onloadedmetadata = () => {
                console.log('Remote video metadata loaded, playing...');
                this.forcePlayRemoteVideo();
            };
            
            // Also try to play when data is available
            this.remoteVideo.oncanplay = () => {
                console.log('Remote video can play, attempting to play...');
                this.forcePlayRemoteVideo();
            };
            
            // Handle audio tracks specifically
            const audioTracks = this.remoteStream.getAudioTracks();
            if (audioTracks.length > 0) {
                console.log('Remote audio track found:', audioTracks[0]);
                // Ensure audio plays automatically
                this.remoteVideo.muted = false;
                this.remoteVideo.autoplay = true;
                this.remoteVideo.playsInline = true;
                
                // Set up audio track event listeners
                audioTracks.forEach(track => {
                    track.onmute = () => console.log('Remote audio track muted');
                    track.onunmute = () => console.log('Remote audio track unmuted');
                    track.onended = () => console.log('Remote audio track ended');
                });
            } else {
                console.warn('No remote audio tracks found');
            }
            
            // Handle video tracks
            const videoTracks = this.remoteStream.getVideoTracks();
            if (videoTracks.length > 0) {
                console.log('Remote video track found:', videoTracks[0]);
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate.candidate);
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    roomId: this.roomId
                });
            } else {
                console.log('ICE gathering complete');
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                console.log('WebRTC connection established successfully!');
                // Clear connection timeout when connected
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
            } else if (this.peerConnection.connectionState === 'failed') {
                console.log('Connection failed, attempting to restart...');
                this.restartConnection();
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'connected') {
                console.log('ICE connection established successfully!');
            } else if (this.peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed, attempting to restart...');
                this.restartConnection();
            } else if (this.peerConnection.iceConnectionState === 'disconnected') {
                console.log('ICE connection disconnected, attempting to reconnect...');
                this.restartConnection();
            }
        };

        // Handle ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
        };

        // Handle data channel (for additional reliability)
        this.peerConnection.ondatachannel = (event) => {
            console.log('Data channel received');
        };

        // Create and send offer
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: false
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
            
            // Process any pending ICE candidates
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log('Processing pending ICE candidates after answer:', this.pendingIceCandidates.length);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('Pending ICE candidate added successfully after answer');
                    } catch (error) {
                        console.error('Error adding pending ICE candidate after answer:', error);
                    }
                }
                this.pendingIceCandidates = [];
            }
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer) {
        console.log('Handling answer from partner');
        try {
            await this.peerConnection.setRemoteDescription(answer);
            console.log('Remote description set successfully');
            
            // Process any pending ICE candidates
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log('Processing pending ICE candidates:', this.pendingIceCandidates.length);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('Pending ICE candidate added successfully');
                    } catch (error) {
                        console.error('Error adding pending ICE candidate:', error);
                    }
                }
                this.pendingIceCandidates = [];
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        console.log('Handling ICE candidate:', candidate.candidate);
        if (this.peerConnection && this.peerConnection.remoteDescription) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
                console.log('ICE candidate added successfully');
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
                // If the candidate is invalid, it might be because the connection is already established
                if (error.name !== 'OperationError') {
                    console.log('ICE candidate might be invalid or connection already established');
                }
            }
        } else {
            console.log('Peer connection not ready or no remote description, storing candidate');
            // Store candidate for later if peer connection isn't ready
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(candidate);
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

    async testTurnServer() {
        console.log('Testing TURN server connectivity...');
        const testConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ]
        });
        
        testConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('TURN server test - ICE candidate:', event.candidate.candidate);
                if (event.candidate.candidate.includes('typ relay')) {
                    console.log('✅ TURN server is working!');
                }
            }
        };
        
        testConnection.onicegatheringstatechange = () => {
            if (testConnection.iceGatheringState === 'complete') {
                console.log('TURN server test complete');
                testConnection.close();
            }
        };
        
        // Create a data channel to trigger ICE gathering
        testConnection.createDataChannel('test');
        const offer = await testConnection.createOffer();
        await testConnection.setLocalDescription(offer);
    }

    async forcePlayRemoteVideo() {
        if (this.remoteVideo && this.remoteVideo.srcObject) {
            try {
                // Ensure video is not muted and has autoplay
                this.remoteVideo.muted = false;
                this.remoteVideo.autoplay = true;
                this.remoteVideo.playsInline = true;
                
                // Try to play the video
                await this.remoteVideo.play();
                console.log('Remote video playing successfully');
            } catch (error) {
                console.log('Error playing remote video:', error);
                
                // If autoplay is blocked, try again after user interaction
                if (error.name === 'NotAllowedError') {
                    console.log('Autoplay blocked, will retry on user interaction');
                    // Add a click listener to retry play
                    const retryPlay = () => {
                        this.remoteVideo.play().catch(e => console.log('Retry play failed:', e));
                        document.removeEventListener('click', retryPlay);
                    };
                    document.addEventListener('click', retryPlay);
                }
            }
        }
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
        this.pendingIceCandidates = [];
        
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
