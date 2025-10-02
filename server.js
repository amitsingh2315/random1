const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store waiting users and active rooms
const waitingUsers = [];
const activeRooms = new Map();
const userSockets = new Map(); // Track user sockets for better management

// Helper function to cleanup user from waiting list and rooms
function cleanupUser(userId) {
  // Remove from waiting list
  const waitingIndex = waitingUsers.findIndex(user => user.id === userId);
  if (waitingIndex !== -1) {
    waitingUsers.splice(waitingIndex, 1);
    console.log(`Removed user ${userId} from waiting list`);
  }
  
  // Find and clean up rooms
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.users.includes(userId)) {
      // Notify partner about disconnection
      const partnerId = room.users.find(id => id !== userId);
      if (partnerId && userSockets.has(partnerId)) {
        userSockets.get(partnerId).emit('partner-disconnected');
      }
      
      // Remove room
      activeRooms.delete(roomId);
      console.log(`Cleaned up room ${roomId} for user ${userId}`);
      break;
    }
  }
  
  // Remove from user sockets
  userSockets.delete(userId);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Track user socket
  userSockets.set(socket.id, socket);

  // Handle user looking for a chat
  socket.on('find-chat', () => {
    console.log('User looking for chat:', socket.id);
    
    // Remove user from any existing waiting list or rooms
    cleanupUser(socket.id);
    
    if (waitingUsers.length > 0) {
      // Match with waiting user
      const partner = waitingUsers.shift();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create room
      activeRooms.set(roomId, {
        users: [socket.id, partner.id],
        createdAt: Date.now(),
        status: 'connecting'
      });
      
      // Join both users to the room
      socket.join(roomId);
      partner.join(roomId);
      
      // Notify both users about the match
      socket.emit('chat-matched', { roomId, partnerId: partner.id });
      partner.emit('chat-matched', { roomId, partnerId: socket.id });
      
      console.log(`Matched users: ${socket.id} and ${partner.id} in room ${roomId}`);
      console.log(`Active rooms: ${activeRooms.size}, Waiting users: ${waitingUsers.length}`);
    } else {
      // Add to waiting list
      waitingUsers.push(socket);
      socket.emit('waiting-for-match');
      console.log(`User added to waiting list: ${socket.id}. Total waiting: ${waitingUsers.length}`);
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    socket.to(data.roomId).emit('chat-message', {
      message: data.message,
      from: socket.id,
      timestamp: Date.now()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    cleanupUser(socket.id);
  });

  // Handle ending chat
  socket.on('end-chat', (data) => {
    const room = activeRooms.get(data.roomId);
    if (room) {
      // Notify partner about chat ending
      const partnerId = room.users.find(id => id !== socket.id);
      if (partnerId && userSockets.has(partnerId)) {
        userSockets.get(partnerId).emit('chat-ended');
      }
      
      // Remove room
      activeRooms.delete(data.roomId);
      console.log(`Chat ended in room ${data.roomId}`);
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Active rooms: ${activeRooms.size}`);
  console.log(`Waiting users: ${waitingUsers.length}`);
});
