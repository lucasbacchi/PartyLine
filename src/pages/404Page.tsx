import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export function meta() {
    return [{ title: "Page Not Found | PartyLine" }, { name: "description", content: "Page not found" }];
}

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-2xl font-bold text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
                    404
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-white">Page Not Found</h1>
                <p className="mt-2 text-sm text-slate-400 max-w-sm">
                    The link you followed may be broken or the page may have been moved.
                </p>
                <Link
                    to="/"
                    className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-500 transition cursor-pointer shadow-lg shadow-blue-500/20"
                >
                    Return to PartyLine Home
                </Link>
            </main>
            <Footer />
        </div>
    );
}
