# PUASH

PUASH is a mobile-first shopping marketplace prototype inspired by Kashmir.

## Included
- React + Vite + TypeScript frontend
- Supabase client connection
- Live product and category reads from Supabase
- Customer account with private delivery address book (add, edit, delete, default address)
- Sample catalogue fallback while the live product catalogue is empty
- Product search, sorting, and detail view
- Client-side cart with quantity controls
- Demo checkout and order confirmation
- Responsive mobile-first layout and web app manifest

## Backend status
The PUASH Supabase project is connected for public catalogue reads. Database tables have Row Level Security enabled. Product and category management, customer authentication, secure order placement, payment processing, and fulfilment still need to be implemented. Checkout remains a demo and does not collect payment or create a real order.

## Environment variables
The app has safe public-project defaults in `src/supabase.ts`. For another environment, copy `.env.example` to `.env.local` and add the Supabase project URL and **publishable** key. Never put a Supabase secret or service-role key in frontend code.

## Run locally
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```
