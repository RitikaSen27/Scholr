# NoteVault — College Notes Sharing Platform

A full-stack application for college students to upload, discover, and download lecture notes. Features OCR-based student ID registration, gamified badges, daily streak tracking, and real-time WebSocket notifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Zustand · Lucide React |
| **Backend** | FastAPI · SQLAlchemy · Alembic · PostgreSQL · WebSockets |
| **OCR** | OpenCV · PyTesseract |
| **Storage** | AWS S3 |
| **Auth** | JWT (access + refresh tokens) · bcrypt |

---

## Project Structure

```
project/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py   # User, Badge, Note ORM models
│   │   ├── schemas.py  # Pydantic I/O schemas
│   │   ├── auth.py     # JWT + bcrypt utilities
│   │   ├── routers/    # auth, ocr, notes, websocket
│   │   └── services/   # ocr, badge, streak, s3
│   ├── alembic/        # Database migrations
│   └── requirements.txt
│
├── frontend/           # Next.js application
│   ├── app/
│   │   ├── login/      # Sign-in page
│   │   ├── register/   # 2-step OCR registration
│   │   ├── dashboard/  # Stat cards + badges + streak
│   │   ├── hub/        # Upload / Download CTA hub
│   │   ├── upload/     # File upload page
│   │   └── notes/      # Folder-based note explorer
│   ├── components/     # WebSocketProvider
│   ├── store/          # Zustand auth store (persisted)
│   ├── lib/api.ts      # Axios + auto-refresh interceptor
│   └── types/          # TypeScript interfaces
│
├── start-backend.sh
└── start-frontend.sh
```

---

## Quick Start

### Prerequisites

- Python 3.9+ with `python3` available
- Node.js 18+
- PostgreSQL database
- AWS S3 bucket (and credentials)
- Tesseract OCR installed (`brew install tesseract` on macOS)

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT secrets, and AWS credentials

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

Or just run: `./start-backend.sh`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if using start script)
npm install

# Configure environment
cp .env.local.example .env.local

# Start dev server
npm run dev
```

Or just run: `./start-frontend.sh`

The app will be available at **http://localhost:3000**.

---

## Key Features

### 🔐 OCR Registration
1. Student uploads a photo of their ID card
2. OpenCV preprocesses the image (grayscale + CLAHE + adaptive threshold)
3. Tesseract extracts the alphanumeric student ID
4. Registration form pre-fills the locked ID field

### 🎖️ Gamification
| Badge | Trigger |
|---|---|
| 🥉 Beginner | 5 total uploads |
| 🥈 Intermediate | 50 total uploads |
| 🏆 Sophisticated | 100-day consecutive upload streak |

### 🔥 Streak Tracking
- Uploading on consecutive days increments your streak
- Missing a day resets the streak to 1
- Progress towards the 100-day Sophisticated badge is always visible

### ⚡ Real-Time WebSocket Alerts
- Upload success confirmation
- New badge unlock notification
- Streak increment toast

### 📂 Notes Explorer
- Organized by Subject Code folders
- Notes sorted newest-first within each folder
- Filenames masked: only `{upload_date} — {tag}` is shown
- Download via pre-signed S3 URLs (5-minute expiry)

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with hashed password + JWT pair |
| POST | `/api/auth/login` | Login, returns full user profile + JWT pair |
| POST | `/api/auth/refresh` | Rotate access token using refresh token |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/ocr/extract-id` | Extract student ID from ID card image |
| POST | `/api/notes/upload` | Upload note file (PDF/DOC/DOCX) |
| GET | `/api/notes/list` | Get all notes grouped by subject |
| GET | `/api/notes/download/{id}` | Get S3 presigned download URL |
| WS | `/ws/{user_id}?token=...` | Real-time notification stream |

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/college_notes
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=college-notes-uploads
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## AWS Deployment Notes

- **Database**: Use Amazon RDS PostgreSQL
- **Backend**: Deploy to EC2 / ECS / Lambda with API Gateway
- **Frontend**: Deploy to Vercel or Amplify; set environment variables accordingly
- **S3**: Configure bucket CORS to allow downloads from your frontend domain
- **Tesseract**: Must be installed on the server running the OCR service
