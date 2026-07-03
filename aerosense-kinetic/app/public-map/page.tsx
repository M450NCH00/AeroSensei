'use client';

import dynamic from 'next/dynamic';

// This forces Next.js to only load the map on the client side (browser)
// completely bypassing the server-side rendering crash.
const MapClient = dynamic(() => import('./PublicMapClient'), {
  ssr: false,
});

export default function Page() {
  return <MapClient />;
}