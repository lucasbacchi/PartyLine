import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export function meta() {
    return [
        { title: "SMS Policy & Rental Agreement Proof | PartyLine" },
        {
            name: "description",
            content: "PartyLine SMS Proxy Policy and example rental agreement showing SMS consent for facility rentals."
        }
    ];
}

export default function SmsTermsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col justify-between">
            <Navbar />

            <main className="flex-1 py-10 px-4 sm:px-6">
                <div className="mx-auto max-w-2xl space-y-8">
                    {/* Header */}
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                            Wentworth Senior Capstone Project · 10DLC Compliance
                        </p>
                        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
                            SMS Messaging Policy & Opt-In Proof
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            PartyLine operates an SMS proxy for organizations renting community spaces and facilities.
                            This page documents how renters consent to receive text messages and how to opt out.
                        </p>
                    </div>

                    {/* Non-Sharing Rule */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs sm:text-sm text-slate-300">
                        <strong className="text-white">Mobile Information Privacy:</strong> No mobile information will
                        be shared with third parties or affiliates for marketing or promotional purposes. All text
                        messaging originator opt-in data and consent will not be shared with any third parties under any
                        circumstances.
                    </div>

                    {/* How It Works */}
                    <section className="space-y-3">
                        <h2 className="text-base font-semibold text-white">1. How Renter Messaging Works</h2>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            When an organization rents out a space (such as a hall or athletic field), the renter is
                            provided the organization&apos;s PartyLine contact number on their rental agreement. If the
                            renter texts this number with questions during their rental, PartyLine proxies the message
                            to whoever is on duty, and returns the volunteer&apos;s reply to the renter without
                            revealing either person&apos;s personal cell phone number.
                        </p>
                    </section>

                    {/* Visual Rental Agreement Mockup */}
                    <section className="space-y-3">
                        <h2 className="text-base font-semibold text-white">
                            2. Visual Proof: Facility Rental Agreement Example
                        </h2>
                        <p className="text-xs text-slate-400">
                            Below is an example of the rental agreement notice provided to renters when booking a space,
                            showing where renters are informed of the phone number and agree to receive SMS replies:
                        </p>

                        {/* Simulated Paper Rental Agreement Card */}
                        <div className="rounded-lg border border-slate-700 bg-slate-900 text-slate-200 p-5 sm:p-6 shadow-md space-y-4 font-sans text-xs">
                            {/* Agreement Header */}
                            <div className="border-b border-slate-700 pb-3 flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-sm text-white uppercase tracking-wider">
                                        [Organization Name] Facility Rental Agreement
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Community Hall &amp; Field Reservations
                                    </p>
                                </div>
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
                                    FORM-RA-2026
                                </span>
                            </div>

                            {/* Booking Summary */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                                <div>
                                    <span className="text-slate-500">Renter Name:</span> [Renter Name]
                                </div>
                                <div>
                                    <span className="text-slate-500">Facility:</span> [Main Hall / Field 1]
                                </div>
                                <div>
                                    <span className="text-slate-500">Date &amp; Time:</span> [Date, Time Range]
                                </div>
                                <div>
                                    <span className="text-slate-500">Contact Phone:</span> [Renter Mobile Number]
                                </div>
                            </div>

                            {/* Section with Highlighted SMS Consent */}
                            <div className="rounded border-2 border-dashed border-blue-500/40 bg-blue-950/20 p-3 space-y-2">
                                <p className="font-bold text-xs text-white uppercase tracking-wide">
                                    Section 4: On-Site Support &amp; SMS Communication Consent
                                </p>
                                <p className="text-[11px] text-slate-300 leading-relaxed">
                                    For access codes, facility check-in, or questions during your reservation, call or
                                    text our on-duty host line at:{" "}
                                    <strong className="text-white font-mono">[Organization Phone Number]</strong>.
                                </p>
                                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                    <strong className="text-blue-300">SMS Disclosure &amp; Consent:</strong> By sending
                                    a text message to this contact number, the renter agrees and consents to receive
                                    automated and proxied SMS replies regarding their reservation from on-duty facility
                                    hosts via PartyLine. Message frequency varies based on communication. Message and
                                    data rates may apply. Reply <strong className="text-white font-mono">STOP</strong>{" "}
                                    to cancel at any time, or <strong className="text-white font-mono">HELP</strong> for
                                    help. Terms: partyline.lucasbacchi.com/terms | Privacy:
                                    partyline.lucasbacchi.com/privacy.
                                </p>
                            </div>

                            {/* Simulated Signature Block */}
                            <div className="pt-2 flex flex-col sm:flex-row justify-between gap-4 text-[11px] text-slate-400">
                                <div className="border-t border-slate-700 pt-1 flex-1">
                                    Renter Signature: <span className="italic text-slate-300">[Signature on file]</span>
                                </div>
                                <div className="border-t border-slate-700 pt-1 w-28">
                                    Date: <span className="text-slate-300">[Date]</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sample Message Flow */}
                    <section className="space-y-3">
                        <h2 className="text-base font-semibold text-white">3. Example Messages Exchanged</h2>
                        <div className="space-y-2 text-xs">
                            <div className="rounded border border-slate-800 bg-slate-900/50 p-3 font-mono text-slate-300">
                                <span className="text-slate-500 block text-[10px]">
                                    // Inbound text from renter to organization number:
                                </span>
                                &quot;Hi, what is the lockbox code for the field lights tonight?&quot;
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-900/50 p-3 font-mono text-slate-300">
                                <span className="text-slate-500 block text-[10px]">
                                    // Proxied reply from on-duty host:
                                </span>
                                &quot;[Organization] via PartyLine: Hello [Name], the light code is 4821. Enjoy your
                                reservation! Reply STOP to opt out, HELP for info.&quot;
                            </div>
                        </div>
                    </section>

                    {/* Opt-out instructions */}
                    <section className="space-y-2 text-xs sm:text-sm text-slate-400 border-t border-slate-800 pt-4">
                        <h2 className="text-base font-semibold text-white">4. Opt-Out &amp; Support</h2>
                        <p>
                            • To stop receiving texts, reply <strong className="text-white">STOP</strong> to any
                            message.
                        </p>
                        <p>
                            • For assistance, reply <strong className="text-white">HELP</strong> or contact{" "}
                            <a href="mailto:support@partyline.lucasbacchi.com" className="text-blue-400 underline">
                                support@partyline.lucasbacchi.com
                            </a>
                            .
                        </p>
                        <p>
                            • Message and data rates may apply. Carriers are not liable for delayed or undelivered
                            messages.
                        </p>
                    </section>

                    {/* Links */}
                    <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800 pt-4">
                        <Link to="/privacy" className="text-blue-400 hover:underline">
                            Privacy Policy
                        </Link>
                        <Link to="/terms" className="text-blue-400 hover:underline">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
