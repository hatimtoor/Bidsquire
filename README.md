# Bidsquire

A team-based auction management platform for finding items on HiBid and relisting them on eBay. Your team moves each item through a structured pipeline — from research to photography to final review — while AI handles title generation, descriptions, and price estimates.

---

## What It Does

- Browse HiBid auctions and fetch item details with one click
- AI (via n8n + Claude) auto-generates eBay titles, descriptions, and price estimates
- Team workflow: researchers, photographers, and reviewers each have their own dashboard
- Push finalized items directly to eBay as a draft or live listing
- Credit system controls usage — buy more via Stripe
- Full multi-tenancy: each organisation sees only their own items and users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| Backend | Django 5 + Django REST Framework |
| Database | PostgreSQL 15 |
| Auth | JWT (httpOnly cookies) |
| Payments | Stripe |
| Automation / AI | n8n + Claude (Anthropic) |
| Email | Nodemailer |
| Proxy | Nginx |
| Containers | Docker + Docker Compose |

---

## The Item Pipeline

Every item flows through these stages:

```
research → winning → photography → research2 → finalized → admin_review
```

1. **Research** — Researcher fetches item from HiBid. n8n scrapes the listing and AI generates a draft eBay title, description, and estimate.
2. **Winning** — Item was won at auction, awaiting physical receipt.
3. **Photography** — Photographer uploads photos (up to 12 images).
4. **Research 2** — Second researcher finalises the eBay listing details. 2 credits deducted here.
5. **Finalized** — Item ready. Admin can push it to eBay as a draft or post it live.

---

## User Roles

| Role | Access |
|---|---|
| `super_admin` | System-wide — all orgs, all users, credit config |
| `admin` | Their org — full dashboard, fetch items, manage team |
| `researcher` | Items in `research` stage only |
| `photographer` | Items in `photography` stage only |
| `researcher2` | Items in `research2` stage only |

---

## Project Structure

```
ebay_project/
├── project/          ← Next.js frontend
├── backend/          ← Django API (n8n webhook receiver)
├── nginx/            ← Reverse proxy config
├── postgres-init/    ← SQL schema + migrations
├── n8n-workflows/    ← Exportable n8n workflow JSON
├── docker-compose.yml
└── docker-compose.prod.yml
```

---

## Getting Started (Local)

### Prerequisites
- Docker Desktop
- Node.js 18+ and Bun
- Python 3.11+

### 1. Clone the repo

```bash
git clone https://github.com/hatimtoor/Bidsquire.git
cd Bidsquire
```

### 2. Set up environment variables

```bash
cp env.example .env
```

Edit `.env` and fill in:

```
# Database
POSTGRES_DB=bidsquire
POSTGRES_USER=bidsquire_user
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://bidsquire_user:your_password@localhost:5432/bidsquire

# Auth
NEXTAUTH_SECRET=your_secret_here
CROSS_APP_SECRET=your_cross_app_secret

# Stripe (use test keys locally)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# eBay
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_REDIRECT_URI=http://localhost:3000/api/ebay/callback

# n8n
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/...
```

### 3. Start the database

```bash
docker-compose -f docker-compose.db-only.yml up -d
```

### 4. Start the frontend

```bash
cd project
bun install
bun run dev
```

Open `http://localhost:3000`

### 5. Start the Django backend (optional — only needed for n8n webhook receiver)

```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

---

## Default Accounts (seeded on first run)

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@auctionflow.com | SuperAdmin@2024! |
| Admin | admin@auctionflow.com | Admin@bids25 |

> Change these immediately in any production environment.

---

## Production Deployment

```bash
# Copy and fill in production env
cp env.prod.template .env.production

# Start everything
docker-compose -f docker-compose.prod.yml up -d
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full server setup including Nginx, SSL, and domain configuration.

---

## n8n Workflow Setup

1. Open your n8n instance
2. Import the workflow from `n8n-workflows/ai-researcher.json`
3. Set the webhook callback URL in the workflow to point to your app's `/api/webhook/receive-ai-research` endpoint
4. Activate the workflow

---

## Testing

See [TESTING_GUIDE.docx](TESTING_GUIDE.docx) for a full pre-production testing checklist covering all features, edge cases, and a quick 5-minute smoke test.

---

## Credit System

| Action | Cost |
|---|---|
| Fetch item from HiBid | 1 credit |
| Complete research2 stage | 2 credits |

Trial accounts start with 100 credits. Additional credits are purchased via Stripe.

---

## License

Private — all rights reserved.
