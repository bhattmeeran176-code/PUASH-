# PUASH

PUASH is a mobile-first shopping marketplace inspired by Kashmir.

## Included
- React + Vite + TypeScript frontend
- Supabase client connection
- Live product and category catalogue
- Customer accounts and private delivery address book
- Product search, category filters, sorting, and dedicated product detail pages
- Customer wishlist with save/remove controls on product cards and product detail pages, shown in the customer account
- Client-side cart with quantity controls
- Admin product catalogue: add, edit, publish/hide, image upload, and stock adjustment
- Secure Cash on Delivery order placement through a database function
- Server-calculated prices and delivery fee; stock checked and deducted transactionally
- Customer order history and order status tracking
- Product ratings and reviews from customers with delivered orders (one review per customer per product)
- Admin order list, search, status filters, and fulfilment updates
- Automatic stock restoration when an order is cancelled
- Responsive mobile-first layout and web app manifest

## Important limitations
- PUASH currently supports Cash on Delivery only; online payments are not integrated.
- Delivery operations, courier integration, returns/refunds, and customer support workflows are not yet integrated.
- The live catalogue must contain genuine products, accurate prices, images, and available stock before accepting customer orders.
- Keep the Supabase leaked-password protection setting enabled before opening registration to the public.

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
