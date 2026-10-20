# MeetUp — Video Conferencing App

A full-stack, Zoom/Google Meet–style video meeting app. Multi-party video calls run
peer-to-peer over WebRTC; Socket.IO is the signaling and presence layer; MongoDB stores
users and meetings.

## Features

- **Auth:** email/password (bcrypt + JWT), Google OAuth (Passport.js), and guest join (name only, no DB entry)
- **Meetings:** instant meetings, scheduled meetings with a shareable link, meeting history, Google-Meet-style room codes (`abc-defg-hij`)
- **Pre-join lobby:** camera preview, mic/camera toggles, permission-denied message with Retry
- **Video calls:** WebRTC mesh (one connection per pair), gallery view and speaker view, active-speaker highlight (Web Audio API), per-participant connection-status dot
- **In-call tools:** screen sharing, chat with unread badge, raise hand, participants panel
- **Host controls:** mute participant, mute all, remove participant, end meeting for everyone, local recording
- **Resilience:** socket auto-reconnect + automatic room rejoin, "meeting not found / already ended" screens, loading states
- **Polish:** dark mode (follows OS, remembers your choice), landing page, responsive layout
- **Deployment:** Dockerfiles, docker-compose (Mongo + backend + nginx-served frontend)

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 (Vite), Tailwind CSS, React Router |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Real-time media | WebRTC (STUN by default, TURN-ready) |

## Project structure

```
.
├── docker-compose.yml
├── .env.example                 # for docker compose
├── backend/
│   ├── Dockerfile
│   ├── server.js                # Express + Socket.IO bootstrap
│   ├── config/                  # db.js, passport.js
│   ├── controllers/             # authController, meetingController
│   ├── middleware/              # authMiddleware (JWT "protect")
│   ├── models/                  # User, Meeting
│   ├── routes/                  # authRoutes, meetingRoutes
│   ├── sockets/meetingSocket.js # rooms, signaling relay, chat, host controls
│   └── utils/generateRoomId.js
└── frontend/
    ├── Dockerfile, nginx.conf
    └── src/
        ├── pages/               # Landing, Login, Signup, JoinGuest, Dashboard,
        │                        # MeetingHistory, MeetingLobby, MeetingRoom
        ├── components/          # VideoGrid, VideoTile, SpeakerView, ChatPanel,
        │                        # ParticipantsPanel, ThemeToggle, ...
        ├── hooks/               # useSocket, useWebRTC, useChat, useActiveSpeaker,
        │                        # useRecording, useAuth, useTheme
        ├── services/            # api.js, socket.js, webrtc.js, recording.js
        └── context/             # AuthContext, ThemeContext
```

---

# Local development

**Prerequisites:** Node.js 18+, and a MongoDB database — either MongoDB installed locally
or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

## 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/video-conference-app   # or your Atlas string
JWT_SECRET=<long random string>
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it:

```bash
npm run dev
```

You should see `MongoDB connected` and `Server running on http://localhost:5000`.
If it crashes with `ECONNREFUSED 127.0.0.1:27017`, MongoDB isn't running — start it, or use Atlas.

## 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to the backend, so no
frontend configuration is needed.

## 3. Try it

Sign up (or join as guest) → **New Meeting** → copy the invite link.

### Testing with more than one participant

A camera can normally be used by **one tab at a time**, so two tabs on the same laptop won't
both get video. Use a second device instead (another laptop or a phone on the same Wi-Fi):

1. Find your computer's IP: `ipconfig` (Windows, "IPv4 Address") or `ifconfig` (Mac/Linux), e.g. `192.168.1.5`.
2. In `backend/.env` allow that origin, then restart the backend:
   ```env
   FRONTEND_URL=http://localhost:5173,http://192.168.1.5:5173
   ```
3. On the other device open `http://192.168.1.5:5173` (not `localhost`).

> Browsers only allow camera/microphone access on `https://` or `localhost`. Over a plain
> `http://192.168.x.x` address some browsers (notably Chrome on Android/iOS) block
> `getUserMedia`. For phone testing use an HTTPS tunnel (e.g. ngrok/cloudflared) or test
> laptop-to-laptop.

Using two tabs on one machine, you'll also hear audio echo — use headphones or mute one tab.

## 4. Google login (optional)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID → Web application**.
2. Add the authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
3. In the OAuth consent screen choose **External** and add your Google account under **Test users**.
4. Put the credentials in `backend/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and restart the backend.

If these are blank, the Google strategy simply isn't registered — everything else works.

---

# Production deployment (Docker)

`docker-compose.yml` starts three containers: **MongoDB**, the **backend**, and the
**frontend** (built to static files and served by nginx, which also reverse-proxies
`/api` and `/socket.io` to the backend — so the app talks to a single origin).

```bash
cp .env.example .env
# edit .env: set JWT_SECRET
docker compose up --build
```

Open **http://localhost:3000**.

Docker starts its **own** MongoDB, so you do not put a `MONGO_URI` in the root `.env`
(the compose file sets it). `backend/.env` is only for running without Docker.

## Root `.env` reference

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes | Signs login tokens |
| `FRONTEND_PORT` | no (3000) | Port the app is served on |
| `FRONTEND_URL` | no | Public URL(s), comma-separated — used for CORS. **Set to your real `https://` domain in production** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enable Google login |
| `GOOGLE_CALLBACK_URL` | no | Must match the redirect URI registered in Google Cloud (through nginx: `https://your-domain/api/auth/google/callback`) |

## Going live checklist

- **HTTPS is required.** Browsers won't grant camera/mic on plain `http://` for real domains. Put a TLS-terminating proxy (Caddy, Traefik, nginx + Let's Encrypt, or your cloud load balancer) in front of the frontend container.
- **CORS:** set `FRONTEND_URL` to exactly the origin users visit.
- **Secrets:** use a strong `JWT_SECRET`; never commit `.env`.
- **Database:** for real data use a managed MongoDB (Atlas) and point the backend's `MONGO_URI` at it instead of the bundled container.
- **Google OAuth:** add the production redirect URI in Google Cloud Console.

## TURN server (important for real-world networks)

The app uses Google's public **STUN** server. STUN only helps two peers discover each other's
public address; it **fails when one or both peers are behind strict/symmetric NATs**
(some corporate networks, mobile carriers, public Wi-Fi). In those cases the call never
connects. A **TURN** server relays media as a fallback.

To add one, run [coturn](https://github.com/coturn/coturn) (or use a managed TURN provider)
and add it to `ICE_SERVERS` in `frontend/src/services/webrtc.js`:

```js
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' },
];
```

TURN credentials shipped in frontend code are visible to users; for production, have the
backend issue short-lived TURN credentials instead.

---

# API reference

Meeting routes need `Authorization: Bearer <token>` (guests included).

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/guest` | Guest token (name only, nothing stored) |
| GET | `/api/auth/google` , `/google/callback` | Google OAuth flow |
| GET | `/api/auth/me` | Current user |
| POST | `/api/meetings/create` | Start an instant meeting |
| POST | `/api/meetings/schedule` | Schedule a meeting |
| GET | `/api/meetings/history` | Your meetings |
| GET | `/api/meetings/:roomId` | Look up a room (404 not found, 410 ended) |
| POST | `/api/meetings/:roomId/join` | Register as participant (idempotent) |
| DELETE | `/api/meetings/:roomId` | Host ends the meeting |
| GET | `/api/health` | Health check |

## Socket.IO events

| Client → server | Purpose |
|---|---|
| `join-room`, `leave-room` | Enter/leave a room (re-sent automatically after a reconnect) |
| `offer`, `answer`, `ice-candidate` | WebRTC signaling, relayed to one peer (`to: socketId`) |
| `update-status` | Broadcast your mic/camera state |
| `raise-hand`, `lower-hand` | Hand raise |
| `send-message` | Chat |
| `mute-participant`, `mute-all`, `remove-participant`, `end-meeting-for-all` | **Host only** — checked against the host stored in MongoDB, never trusted from the client |

Server → client: `existing-participants`, `user-joined`, `user-left`, `participant-updated`,
`receive-message`, `force-mute`, `removed-from-meeting`, `meeting-ended`, `error-message`,
`offer`, `answer`, `ice-candidate`.

Who connects to whom: whoever is **already in the room** sends the WebRTC offer to a
newcomer, so each pair has exactly one initiator (no "glare").

---

# Known limitations

- **Mesh topology:** every participant uploads video to every other participant, so quality drops past ~4–6 people. Larger meetings need an SFU (LiveKit, mediasoup, Janus).
- **No TURN by default** — see above.
- **"Join now" doesn't ask anyone:** there is no waiting room; joining is immediate.
- **Recording is local and host-only:** it captures what the host's screen shows plus audio from participants present when recording started; people who join mid-recording appear in the video but their audio isn't added. Nothing is uploaded.
- **Screen share is video only** (no system audio).
- **Rooms live in server memory:** restarting the backend drops live presence (people reconnect automatically), and running several backend instances would need a shared adapter (e.g. the Socket.IO Redis adapter).
- **Guests** have no meeting history by design.
- No automated tests are included.
