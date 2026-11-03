import { Link } from "react-router";

export default function Footer() {
    return (
        <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-500">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
                <Link to="/" className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-500 text-xs font-black text-white shadow-xs">
                        P
                    </span>
                    <span className="font-semibold text-slate-300">PartyLine</span>
                </Link>
                <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
                    <Link to="/events" className="hover:text-slate-200 transition">
                        Events
                    </Link>
                    <Link to="/org/users" className="hover:text-slate-200 transition">
                        Team
                    </Link>
                    <Link to="/org/settings" className="hover:text-slate-200 transition">
                        Settings
                    </Link>
                    <Link to="/account" className="hover:text-slate-200 transition">
                        Account
                    </Link>
                </div>
                <p>© {new Date().getFullYear()} PartyLine Phone System. Built for teams & shared duty shifts.</p>
            </div>
        </footer>
    );
}
