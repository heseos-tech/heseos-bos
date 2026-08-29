"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/partner/ui";
import { IconUser, IconHistory, IconHelp, IconFile, IconShield, IconLogout, IconChevronRight } from "@/components/partner/icons";

const ROLE_LABEL = { presales: "Pre-Sales Executive", sales_engineer: "Sales Engineer" };

const MENU = [
  { icon: IconUser, label: "My Profile" },
  { icon: IconHistory, label: "My Activity" },
  { icon: IconShield, label: "How It Works" },
  { icon: IconHelp, label: "Help & Support" },
  { icon: IconFile, label: "Terms & Conditions" },
];

export default function TeamProfileScreen({ employee }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/employee", { method: "DELETE" });
    router.push("/team/login");
    router.refresh();
  }

  const coverage = employee.role === "presales"
    ? (Array.isArray(employee.cities) && employee.cities[0] === "ALL" ? "All Cities" : (employee.cities || []).join(", ") || employee.location || "—")
    : (employee.location || "No city set");

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Profile</div>
      </div>

      <div className="hp-profile-head">
        <Avatar name={employee.name} size="lg" />
        <div className="hp-profile-name">{employee.name}</div>
        <div className="hp-profile-role">{ROLE_LABEL[employee.role] || employee.role}</div>
        <div className="hp-profile-id">{employee.email}</div>
        <div className="hp-profile-id">Coverage: {coverage}</div>
      </div>

      <div className="hp-menu-list">
        {MENU.map((m) => {
          const Icon = m.icon;
          return (
            <button key={m.label} className="hp-menu-item" onClick={() => { setToast(`${m.label} coming soon`); setTimeout(() => setToast(""), 2000); }}>
              <span className="hp-menu-icon"><Icon size={17} /></span>
              <span className="hp-menu-label">{m.label}</span>
              <IconChevronRight size={16} style={{ color: "var(--hp-text-faint)" }} />
            </button>
          );
        })}
      </div>

      <div className="hp-menu-list">
        <button className="hp-menu-item danger" onClick={logout} disabled={loggingOut}>
          <span className="hp-menu-icon"><IconLogout size={17} /></span>
          <span className="hp-menu-label">{loggingOut ? "Logging out…" : "Logout"}</span>
        </button>
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
