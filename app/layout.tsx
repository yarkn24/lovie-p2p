import { ReactNode } from 'react';

export const metadata = {
  title: 'Lovie P2P',
  description: 'Request and send money peer-to-peer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
