import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { IconMail, IconPhone, IconCheckCircle, IconInfo } from "../components/Icons";

export function meta() {
    return [
        { title: "Contact Us & Support | PartyLine" },
        {
            name: "description",
            content:
                "Get in touch with the PartyLine team for help with your shared phone lines, duty shifts, or SMS notification preferences."
        }
    ];
}

export default function ContactPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [category, setCategory] = useState("support");
    const [message, setMessage] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate submission
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
        }, 600);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600/30 selection:text-white">
            <Navbar />

            <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="text-center sm:text-left border-b border-slate-800 pb-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-4">
                            <IconMail className="h-3.5 w-3.5" />
                            <span>Wentworth Senior Project Team Support</span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                            Contact & Support
                        </h1>
                        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl">
                            Have questions about our rental SMS proxy, shift scheduling, or managing your phone number
                            preferences? Reach out to our student project team.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                        {/* Contact Form */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xs">
                            <h2 className="text-lg font-bold text-white mb-1">Send a Message</h2>
                            <p className="text-xs text-slate-400 mb-6">
                                Fill out the form below and we will respond within 24 to 48 business hours.
                            </p>

                            {submitted ? (
                                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
                                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                                        <IconCheckCircle className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-white">Message Received</h3>
                                    <p className="text-xs text-emerald-200">
                                        Thank you, {name}! Your message regarding &quot;{category}&quot; has been
                                        submitted. We&apos;ve dispatched a confirmation copy to{" "}
                                        <span className="underline">{email}</span>.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSubmitted(false);
                                            setMessage("");
                                        }}
                                        className="mt-2 text-xs font-semibold text-emerald-300 hover:underline"
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                                    <div>
                                        <label className="block font-medium text-slate-300 mb-1">
                                            Your Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Jane Doe"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block font-medium text-slate-300 mb-1">
                                                Email Address *
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="jane@example.com"
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-300 mb-1">
                                                Phone Number (Optional)
                                            </label>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="+1 (617) 555-0192"
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-medium text-slate-300 mb-1">
                                            Inquiry Category
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="support">Technical Support & Troubleshooting</option>
                                            <option value="sms-opt-out">SMS Preferences & Opt-Out Assistance</option>
                                            <option value="organization">Organization & Twilio Setup</option>
                                            <option value="privacy">Privacy & Data Compliance</option>
                                            <option value="other">General Inquiries</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-medium text-slate-300 mb-1">Message *</label>
                                        <textarea
                                            required
                                            rows={4}
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="How can we help your team?"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Sending..." : "Submit Inquiry"}
                                    </button>

                                    <p className="text-[11px] text-slate-500 text-center">
                                        By submitting this form, you agree to our{" "}
                                        <Link to="/privacy" className="underline hover:text-slate-400">
                                            Privacy Policy
                                        </Link>{" "}
                                        and{" "}
                                        <Link to="/terms" className="underline hover:text-slate-400">
                                            Terms
                                        </Link>
                                        . We never share your phone or contact information with third parties for
                                        marketing.
                                    </p>
                                </form>
                            )}
                        </div>

                        {/* Direct Contact Details & Quick FAQs */}
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
                                <h3 className="text-base font-bold text-white">Direct Contacts</h3>

                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-blue-600/15 p-2 text-blue-400 shrink-0">
                                        <IconMail className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Support & Compliance Email</p>
                                        <a
                                            href="mailto:support@partyline.lucasbacchi.com"
                                            className="text-sm font-semibold text-blue-400 hover:underline"
                                        >
                                            support@partyline.lucasbacchi.com
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-indigo-600/15 p-2 text-indigo-400 shrink-0">
                                        <IconPhone className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">SMS Keyword Commands</p>
                                        <p className="text-xs text-slate-300">
                                            Text <strong className="text-white">HELP</strong> for immediate help or{" "}
                                            <strong className="text-white">STOP</strong> to opt out of alerts.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-slate-800 p-2 text-slate-300 shrink-0">
                                        <IconInfo className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Operating Address</p>
                                        <p className="text-xs text-slate-300">
                                            PartyLine Phone System Project
                                            <br />
                                            Wentworth Institute of Technology
                                            <br />
                                            550 Huntington Ave, Boston, MA 02115
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick FAQ Box */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
                                <h3 className="text-base font-bold text-white">Frequently Asked</h3>

                                <div className="space-y-3 text-xs text-slate-300">
                                    <div>
                                        <p className="font-semibold text-white">
                                            How do I cancel shift text notifications?
                                        </p>
                                        <p className="mt-0.5 text-slate-400">
                                            Reply <strong className="text-slate-200">STOP</strong> to any message
                                            received from PartyLine. You will receive an instant confirmation.
                                        </p>
                                    </div>
                                    <div className="border-t border-slate-800/80 pt-2">
                                        <p className="font-semibold text-white">
                                            Will members&apos; personal numbers be exposed?
                                        </p>
                                        <p className="mt-0.5 text-slate-400">
                                            No. Callers only see your shared organization line, and your personal mobile
                                            number remains shielded.
                                        </p>
                                    </div>
                                    <div className="border-t border-slate-800/80 pt-2">
                                        <p className="font-semibold text-white">What are the SMS rates?</p>
                                        <p className="mt-0.5 text-slate-400">
                                            PartyLine does not charge separate messaging fees to recipients, but
                                            standard message and data rates from your mobile carrier may apply.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
