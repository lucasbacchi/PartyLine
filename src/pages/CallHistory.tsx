import { useState, useMemo } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp, type TenantRole, type OrgMember } from "../context/AppContext";
import {
    IconBuilding,
    IconPlus,
    IconTrash,
    IconShield,
    IconCopy,
    IconCheck,
    IconCheckCircle
} from "../components/Icons";

export function meta() {
    return [
        { title: "Call History | PartyLine" },
        { name: "description", content: "View and manage your call history." }
    ];
}