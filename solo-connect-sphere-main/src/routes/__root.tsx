import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-7xl">404</h1>
        <p className="mt-2 text-muted-foreground">Lost in the void.</p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "SoloS — Connect to who's near" },
      { name: "description", content: "SoloS is a proximity-first social app. Discover people nearby, share moments, and connect in real-time." },
      { property: "og:title", content: "SoloS — Connect to who's near" },
      { property: "og:description", content: "SoloS is a proximity-first social app. Discover people nearby, share moments, and connect in real-time." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "SoloS — Connect to who's near" },
      { name: "twitter:description", content: "SoloS is a proximity-first social app. Discover people nearby, share moments, and connect in real-time." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/079451c3-0547-4046-a7f5-39cda44d8bb9/id-preview-65834722--1579382c-c0fe-4045-83f0-047b2b93e442.lovable.app-1777784943885.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/079451c3-0547-4046-a7f5-39cda44d8bb9/id-preview-65834722--1579382c-c0fe-4045-83f0-047b2b93e442.lovable.app-1777784943885.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster theme="dark" position="top-center" />
        <Scripts />
      </body>
    </html>
  );
}
