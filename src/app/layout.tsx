import type { Metadata } from 'next';
import { ProfileProvider } from '@/components/profile/ProfileProvider';
import { StorageBanner } from '@/components/ui/StorageBanner';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Ultimate Elite Drink List',
  description: 'Bartender service-speed drill.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StorageBanner />
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
