# Osprey Trading Assistant

An AI-powered trading assistant with human approval built with Next.js, TypeScript, and Supabase.

## Frontend Features ✅

- **Authentication System**: Complete login/signup with email/password and OAuth (GitHub, Google)
- **Responsive UI**: Built with Tailwind CSS and shadcn/ui components
- **Protected Routes**: Dashboard accessible only to authenticated users
- **Type Safety**: Full TypeScript implementation
- **Modern Stack**: Next.js 13+ with App Router

## Getting Started

1. **Install dependencies**:
```bash
npm install
```

2. **Configure Supabase**:
Update `.env.local` with your actual Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
```

3. **Run development server**:
```bash
npm run dev
```

4. **Open your browser**: Navigate to http://localhost:3000

## Project Structure

```
src/
├── app/
│   ├── login/           # Login page with auth forms
│   ├── dashboard/       # Protected dashboard (placeholder)
│   └── globals.css      # Global styles with CSS variables
├── components/ui/       # shadcn/ui components
├── contexts/           # React contexts (AuthContext)
├── lib/               # Utility functions (Supabase client)
```

## Tech Stack

- **Frontend**: Next.js 13+, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Authentication**: Supabase Auth
- **Build Tool**: Next.js built-in bundler

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Next Steps (Backend Implementation)

- Set up FastAPI backend with trading logic
- Implement Redis Pub/Sub for real-time proposals
- Connect to broker APIs (Alpaca, etc.)
- Add WebSocket connection for real-time updates
- Deploy to Vercel (frontend) and AWS EC2 (backend)