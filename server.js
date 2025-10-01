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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user looking for a chat
  socket.on('find-chat', () => {
    console.log('User looking for chat:', socket.id);
    
    if (waitingUsers.length > 0) {
      // Match with waiting user
      const partner = waitingUsers.shift();
      const roomId = `${socket.id}-${partner.id}`;
      
      // Create room
      activeRooms.set(roomId, {
        users: [socket.id, partner.id],
        createdAt: Date.now()
      });
      
      // Join both users to the room
      socket.join(roomId);
      partner.join(roomId);
      
      // Notify both users about the match
      socket.emit('chat-matched', { roomId, partnerId: partner.id });
      partner.emit('chat-matched', { roomId, partnerId: socket.id });
      
      console.log('Matched users:', socket.id, 'and', partner.id);
    } else {
      // Add to waiting list
      waitingUsers.push(socket);
      socket.emit('waiting-for-match');
      console.log('User added to waiting list:', socket.id);
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
    
    // Remove from waiting list if present
    const waitingIndex = waitingUsers.findIndex(user => user.id === socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }
    
    // Find and clean up rooms
    for (const [roomId, room] of activeRooms.entries()) {
      if (room.users.includes(socket.id)) {
        // Notify partner about disconnection
        socket.to(roomId).emit('partner-disconnected');
        
        // Remove room
        activeRooms.delete(roomId);
        break;
      }
    }
  });

  // Handle ending chat
  socket.on('end-chat', (data) => {
    const room = activeRooms.get(data.roomId);
    if (room) {
      socket.to(data.roomId).emit('chat-ended');
      activeRooms.delete(data.roomId);
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
