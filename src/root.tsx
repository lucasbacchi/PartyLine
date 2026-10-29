import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { UserProvider } from "./context/UserContext";
import { AppProvider } from "./context/AppContext";

export const links: Route.LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    }
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <UserProvider>
            <AppProvider>
                <Outlet />
            </AppProvider>
        </UserProvider>
    );
}

export function HydrateFallback() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="relative flex items-center justify-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-500 text-xl font-black text-white shadow-lg shadow-blue-500/25 animate-pulse">
                        P
                    </span>
                    <div className="absolute -inset-2 rounded-2xl border-2 border-indigo-500/30 animate-spin" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-slate-300">Loading PartyLine...</p>
                    <p className="text-xs text-slate-500">Preparing your shared phone workspace</p>
                </div>
            </div>
        </main>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
                <h1 className="text-2xl font-bold text-white">{message}</h1>
                <p className="mt-2 text-sm text-slate-400">{details}</p>
                {stack && (
                    <pre className="mt-4 w-full p-4 overflow-x-auto text-left text-xs bg-slate-950 rounded-xl border border-slate-800 text-red-400 font-mono">
                        <code>{stack}</code>
                    </pre>
                )}
            </div>
        </main>
    );
}
