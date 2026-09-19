import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '애정 지방법원',
  description:
    '서운했던 마음을 귀여운 고소장으로 정리해 링크 하나로 전하는 서비스',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
