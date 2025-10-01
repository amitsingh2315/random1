# Random Video Chat

A fully functional random video chat website similar to Omegle, built with Node.js, Express, Socket.IO, and WebRTC.

## Features

- 🎥 **Random Video Matching**: Connect with random strangers from around the world
- 💬 **Text Chat**: Send messages alongside video calls
- 🎛️ **Media Controls**: Mute/unmute audio and turn video on/off
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Peer-to-Peer**: Direct video connections for privacy and performance
- ⚡ **Real-time**: Instant connection and messaging using Socket.IO

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Video/Audio**: WebRTC (Web Real-Time Communication)
- **Styling**: Modern CSS with gradients and animations

## Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- A modern web browser with WebRTC support
- Camera and microphone access

## Installation

1. **Clone or download the project**
   ```bash
   # If you have git installed
   git clone <repository-url>
   cd random-video-chat1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Development

To run the server in development mode with auto-restart:

```bash
npm run dev
```

## Usage

1. **Start a Chat**: Click "Start Chatting" to begin looking for a partner
2. **Wait for Match**: The system will automatically match you with another user
3. **Video Chat**: Once matched, you'll see both video streams
4. **Send Messages**: Use the text input to send messages
5. **Control Media**: Use the control buttons to mute/unmute or turn video on/off
6. **End Chat**: Click the red phone button to end the current chat
7. **Start New Chat**: Click "Start New Chat" to find another partner

## Browser Compatibility

This application requires a modern browser with WebRTC support:

- ✅ Chrome 56+
- ✅ Firefox 52+
- ✅ Safari 11+
- ✅ Edge 79+

## Security Notes

- The application uses WebRTC for peer-to-peer connections
- No video/audio data is stored on the server
- Only signaling data passes through the server
- Users are matched randomly and anonymously

## Troubleshooting

### Camera/Microphone Issues
- Ensure your browser has permission to access camera and microphone
- Check that no other applications are using your camera
- Try refreshing the page and granting permissions again

### Connection Issues
- Check your internet connection
- Ensure you're not behind a restrictive firewall
- Try using a different browser

### No Matches Found
- Wait a bit longer - the system matches users as they become available
- Try refreshing the page and starting a new search

## File Structure

```
random-video-chat1/
├── server.js              # Express server with Socket.IO
├── package.json           # Dependencies and scripts
├── README.md             # This file
└── public/               # Frontend files
    ├── index.html        # Main HTML page
    ├── style.css         # CSS styling
    └── script.js         # JavaScript for WebRTC and UI
```

## Customization

### Changing the Port
Edit the `PORT` variable in `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change 3000 to your desired port
```

### Styling
Modify `public/style.css` to change the appearance:
- Colors and gradients
- Layout and spacing
- Animations and transitions

### Features
Extend `public/script.js` to add new features:
- Screen sharing
- File sharing
- Video recording
- User profiles

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this project.

## Support

If you encounter any issues or have questions, please check the troubleshooting section above or create an issue in the project repository.
