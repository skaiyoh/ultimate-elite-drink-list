import type { Metadata } from 'next';
import { Archivo_Narrow, IBM_Plex_Sans } from 'next/font/google';
import { ProfileProvider } from '@/components/profile/ProfileProvider';
import { AppNav } from '@/components/ui/AppNav';
import { StorageBanner } from '@/components/ui/StorageBanner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { STORAGE_KEYS } from '@/lib/storage/localStore';
import '@/styles/global.css';

/**
 * Two families, per spec §10.
 *
 * Archivo Narrow is the docket face: a condensed grotesque with enough weight
 * to hold a printed-ticket look, and narrow enough that a long drink name
 * stays on one line. IBM Plex Sans is the instrument face — true tabular
 * figures, so a running clock does not jitter as digits change width.
 *
 * Only Plex is preloaded: it sets every body string and the hero clock, which
 * are what a round is read from. Archivo appears in headings, which can swap.
 */
const display = Archivo_Narrow({
  subsets: ['latin'], weight: ['500', '600'], display: 'swap',
  variable: '--font-display', preload: false,
});

const body = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400', '600'], display: 'swap',
  variable: '--font-body', preload: true,
});

export const metadata: Metadata = {
  title: 'Ultimate Elite Drink List',
  description: 'Bartender service-speed drill.',
};

/**
 * Runs before first paint so a dark-themed device never flashes the light
 * palette while React hydrates. It cannot import the theme repository — this
 * executes before any bundle — so it reads the same key directly, interpolated
 * from STORAGE_KEYS so the two cannot drift apart. The value is JSON, because
 * that is how localStore writes everything.
 *
 * The markup is a compile-time constant built from our own constant; no user
 * input reaches it, which is what makes this use of dangerouslySetInnerHTML
 * the standard no-flash pattern rather than an injection surface.
 */
const themeScript = `try{var r=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.theme)});`
  + `var t=r&&JSON.parse(r);`
  + `if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StorageBanner />
        <header className="app-header">
          {/* AppNav removes itself during a round; the theme control stays,
              because changing the palette does not navigate away from one. */}
          <AppNav />
          <ThemeToggle />
        </header>
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
