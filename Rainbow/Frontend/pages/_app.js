// pages/_app.js
import "../styles/globals.css"
import { useEffect, useState } from 'react';
export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* <Navbar /> */}
      <main className="p-6">
        <Component {...pageProps} />
      </main>
    </>
  )
}
