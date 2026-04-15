# Kalinda GTM

PACER prospect search and OpenAI-powered research tool.

## Architecture

- **Backend**: FastAPI (Python) -- wraps PACER PCL party search + filing summary generation
- **Frontend**: Next.js 16 + Tailwind + shadcn/ui with SF Pro Display font
- **Database**: Supabase (Postgres) -- stores prospects, search results, and research

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Edit `backend/.env` and fill in your keys:

```
PACER_LOGIN_ID=sayanbhatia
PACER_PASSWORD=<your password>
OPENAI_API_KEY=<your OpenAI key>
SUPABASE_URL=https://ocofvxnvrodqxpytgsum.supabase.co
SUPABASE_SERVICE_KEY=<your Supabase service role key>
```

Run the backend from the **project root** (not from inside `backend/`):

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will automatically refresh the PACER NG token every 25 minutes.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and hits the backend at `http://localhost:8000`.

## Usage

### Batch Search

1. Go to **Batch Search** in the nav
2. Upload a CSV with columns: `First Name`, `Last Name`, `Company Name`
3. Click **Search PACER** -- progress streams in real time
4. Download results CSV or click **Research** on any prospect

### Single Search

1. Go to **Single Search** in the nav
2. Enter a first and last name, click **Search**
3. View filing summary and case details
4. Click **Research** to run OpenAI deep research

### Research

- Clicking **Research** on any prospect opens a prompt confirmation modal
- If no firm name is on file, you'll be asked to enter one first
- The research result appears in a slide-out sidebar
