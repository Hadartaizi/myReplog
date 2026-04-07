import { ScrollViewStyleReset } from 'expo-router/html';
import { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="he" dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <title>Replog</title>

        {/* מחבר את ה-manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* אייקון לאייפון */}
        <link rel="apple-touch-icon" href="/Replog.png" />

        <meta name="apple-mobile-web-app-title" content="Replog" />
        <meta name="theme-color" content="#ffffff" />

        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}