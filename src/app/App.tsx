import { useState, useRef, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n";
import {
  LayoutDashboard, ArrowLeftRight, Upload, Building2,
  Bot, BarChart3, ScrollText, Bell, Users, ShieldCheck,
  Settings, CreditCard, HelpCircle, Search, ChevronDown,
  ChevronRight, X, Check, AlertTriangle, Plus, Filter,
  Download, RefreshCw, Eye, Edit, Trash2, MoreHorizontal,
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  FileText, Zap, Lock, Mail, Calendar, Clock,
  Activity, LogOut, User, Menu, Sparkles,
  CheckCircle2, XCircle, AlertCircle, Loader2, FileUp,
  DollarSign, Send, MessageSquare, Copy, Hash,
  Shield, Key, Database, ChevronUp, SlidersHorizontal,
  FileSpreadsheet, Banknote, Building, Briefcase, Globe,
  GitMerge, Wand2, FileBarChart, Package, Link, Star,
  RotateCcw, BarChart2, ChevronLeft, Info, Target, Percent,
  Network, Split, Merge, Inbox, CheckSquare, BookOpen,
  Video, LifeBuoy, Columns3, Landmark, CircleUser,
  Layers, Wifi, WifiOff, ServerCrash, AlertOctagon,
  ShieldAlert, ArrowRight, Fingerprint, Smartphone, Unlink,
  ExternalLink, FolderOpen, Flag, Tag, AtSign, Phone,
  BellRing, BellOff, Circle, Dot, MoreVertical, Table,
  ToggleLeft, Webhook, CpuIcon, Sliders, Play,
  PauseCircle, Timer, Gauge, Coins, Receipt,
  FileCheck, FileX, FilePlus, FileSearch,
  CloudUpload, Cloud, CloudOff, FolderSync,
  PiggyBank, Wallet, TrendingUp as TrendUp2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar,
  ComposedChart
} from "recharts";

// ─── Types ───────────────────────────────────────────────────
type View =
  | "login" | "register" | "forgot-password" | "reset-password"
  | "email-verification" | "mfa" | "session-expired" | "accept-invitation"
  | "onboarding"
  | "dashboard" | "transactions" | "reconciliation" | "imports"
  | "matching-rules" | "bank-accounts" | "integrations" | "ai-assistant"
  | "reports" | "audit-logs" | "notifications" | "users" | "roles"
  | "settings" | "billing" | "help"
  | "403" | "404" | "500" | "maintenance" | "offline";

// ─── Mock Data ───────────────────────────────────────────────
const monthlyData = [
  { month: "Jan", matched: 3840, unmatched: 420, exceptions: 95 },
  { month: "Feb", matched: 4120, unmatched: 380, exceptions: 72 },
  { month: "Mar", matched: 4890, unmatched: 310, exceptions: 58 },
  { month: "Apr", matched: 5230, unmatched: 290, exceptions: 44 },
  { month: "May", matched: 4780, unmatched: 340, exceptions: 61 },
  { month: "Jun", matched: 5640, unmatched: 260, exceptions: 39 },
  { month: "Jul", matched: 6120, unmatched: 220, exceptions: 33 },
  { month: "Aug", matched: 5980, unmatched: 245, exceptions: 41 },
  { month: "Sep", matched: 6340, unmatched: 198, exceptions: 27 },
  { month: "Oct", matched: 6890, unmatched: 174, exceptions: 22 },
  { month: "Nov", matched: 7120, unmatched: 156, exceptions: 18 },
  { month: "Dec", matched: 7480, unmatched: 124, exceptions: 14 },
];

const accuracyData = [
  { month: "Jan", accuracy: 89.1, aiAccuracy: 91.2 },
  { month: "Feb", accuracy: 91.5, aiAccuracy: 93.0 },
  { month: "Mar", accuracy: 92.3, aiAccuracy: 94.1 },
  { month: "Apr", accuracy: 94.7, aiAccuracy: 95.8 },
  { month: "May", accuracy: 93.4, aiAccuracy: 95.2 },
  { month: "Jun", accuracy: 95.6, aiAccuracy: 96.7 },
  { month: "Jul", accuracy: 96.5, aiAccuracy: 97.4 },
  { month: "Aug", accuracy: 96.1, aiAccuracy: 97.1 },
  { month: "Sep", accuracy: 97.3, aiAccuracy: 98.0 },
  { month: "Oct", accuracy: 97.8, aiAccuracy: 98.5 },
  { month: "Nov", accuracy: 98.2, aiAccuracy: 98.9 },
  { month: "Dec", accuracy: 98.7, aiAccuracy: 99.1 },
];

const transactions: TxRow[] = [
  { id: "TXN-2024-00847", date: "2024-12-15", description: "AWS Cloud Services - Monthly Invoice", vendor: "Amazon Web Services", account: "Tech Infrastructure", debit: 24750.00, credit: 0, source: "SAP ERP", status: "matched", ref: "INV-AWS-2024-1215" },
  { id: "TXN-2024-00848", date: "2024-12-15", description: "Stripe Payment Gateway Settlement", vendor: "Stripe Inc.", account: "Payment Receipts", debit: 0, credit: 187432.50, source: "Stripe API", status: "matched", ref: "STR-PAY-20241215" },
  { id: "TXN-2024-00849", date: "2024-12-14", description: "Salesforce CRM Annual Subscription", vendor: "Salesforce Inc.", account: "SaaS Subscriptions", debit: 18500.00, credit: 0, source: "QuickBooks", status: "exception", ref: "SF-LIC-2024-Q4" },
  { id: "TXN-2024-00850", date: "2024-12-14", description: "Payroll Direct Deposit - Dec W1", vendor: "Internal Payroll", account: "Payroll Expenses", debit: 342180.00, credit: 0, source: "ADP", status: "matched", ref: "PAY-2024-DEC-W1" },
  { id: "TXN-2024-00851", date: "2024-12-13", description: "Office Lease - December 2024", vendor: "Metro Commercial Realty", account: "Rent Expenses", debit: 42000.00, credit: 0, source: "Manual Entry", status: "pending", ref: "LEASE-DEC-2024" },
  { id: "TXN-2024-00852", date: "2024-12-13", description: "Client Payment - Global Tech Solutions", vendor: "Global Tech Solutions", account: "Accounts Receivable", debit: 0, credit: 95000.00, source: "Bank Import", status: "unmatched", ref: "WIRE-GTS-001247" },
  { id: "TXN-2024-00853", date: "2024-12-12", description: "Microsoft Azure Subscription", vendor: "Microsoft Corp.", account: "Tech Infrastructure", debit: 8340.00, credit: 0, source: "QuickBooks", status: "matched", ref: "MSFT-AZ-DEC2024" },
  { id: "TXN-2024-00854", date: "2024-12-12", description: "Federal Tax Deposit Q4 2024", vendor: "US Treasury", account: "Tax Liabilities", debit: 124500.00, credit: 0, source: "Manual Entry", status: "matched", ref: "IRS-Q4-2024-TAX" },
  { id: "TXN-2024-00855", date: "2024-12-11", description: "Insurance Premium - Commercial", vendor: "Hartford Financial", account: "Insurance Expenses", debit: 12750.00, credit: 0, source: "SAP ERP", status: "matched", ref: "HTF-COMM-DEC24" },
  { id: "TXN-2024-00856", date: "2024-12-11", description: "Marketing Campaign - Q4 Digital", vendor: "AdTech Partners LLC", account: "Marketing Expenses", debit: 35000.00, credit: 0, source: "QuickBooks", status: "exception", ref: "MKT-Q4-2024-DIG" },
  { id: "TXN-2024-00857", date: "2024-12-10", description: "Supplier Payment - Acme Manufacturing", vendor: "Acme Manufacturing Co.", account: "Accounts Payable", debit: 67800.00, credit: 0, source: "SAP ERP", status: "matched", ref: "AP-ACME-DEC-047" },
  { id: "TXN-2024-00858", date: "2024-12-10", description: "Bank Fee - Wire Transfer International", vendor: "JPMorgan Chase", account: "Bank Charges", debit: 45.00, credit: 0, source: "Bank Import", status: "unmatched", ref: "JPM-FEE-20241210" },
];

type TxRow = {
  id: string; date: string; description: string; vendor: string;
  account: string; debit: number; credit: number; source: string;
  status: "matched" | "unmatched" | "pending" | "exception"; ref: string;
};

const auditLogs = [
  { id: 1, user: "Sarah Chen", action: "Reconciliation Approved", resource: "DEC-2024 Bank Rec", time: "2 min ago", ip: "192.168.1.42", device: "Chrome / macOS", type: "success" },
  { id: 2, user: "James Wilson", action: "Matching Rule Created", resource: "Rule: Stripe Settlements", time: "18 min ago", ip: "10.0.0.15", device: "Firefox / Windows", type: "info" },
  { id: 3, user: "Maria Rodriguez", action: "Import Failed", resource: "bank_dec_2024.csv", time: "45 min ago", ip: "192.168.1.78", device: "Chrome / macOS", type: "error" },
  { id: 4, user: "David Kim", action: "User Role Changed", resource: "michael.brown@co.com", time: "1 hr ago", ip: "10.0.0.22", device: "Safari / iOS", type: "warning" },
  { id: 5, user: "Sarah Chen", action: "Exception Resolved", resource: "TXN-2024-00849", time: "2 hr ago", ip: "192.168.1.42", device: "Chrome / macOS", type: "success" },
  { id: 6, user: "System", action: "Scheduled Import Completed", resource: "SAP ERP Sync", time: "3 hr ago", ip: "10.0.0.1", device: "Automated", type: "info" },
  { id: 7, user: "James Wilson", action: "Report Exported", resource: "Q4-2024-Reconciliation.pdf", time: "4 hr ago", ip: "10.0.0.15", device: "Firefox / Windows", type: "info" },
  { id: 8, user: "Admin", action: "MFA Policy Updated", resource: "Organization Settings", time: "6 hr ago", ip: "192.168.1.1", device: "Chrome / Windows", type: "warning" },
];

const bankAccounts = [
  { id: 1, name: "JPMorgan Chase - Operating", bank: "JPMorgan Chase", accountNo: "****4521", type: "Checking", balance: 2847293.50, lastSync: "2 min ago", status: "active", currency: "USD" },
  { id: 2, name: "Bank of America - Payroll", bank: "Bank of America", accountNo: "****8834", type: "Checking", balance: 485720.00, lastSync: "15 min ago", status: "active", currency: "USD" },
  { id: 3, name: "Wells Fargo - Savings", bank: "Wells Fargo", accountNo: "****2290", type: "Savings", balance: 1250000.00, lastSync: "1 hr ago", status: "active", currency: "USD" },
  { id: 4, name: "Citibank - International", bank: "Citibank", accountNo: "****6617", type: "Checking", balance: 342180.00, lastSync: "3 hr ago", status: "syncing", currency: "EUR" },
];

const aiMessages = [
  { id: 1, role: "assistant", content: "Hello! I'm your AI reconciliation assistant. I've analyzed your December 2024 financial data. Here's a quick summary:\n\n• **12,847 transactions** processed across 4 bank accounts\n• **11,423 matched** (88.9% accuracy — up 2.3% from November)\n• **1,124 unmatched** requiring attention\n• **300 exceptions** flagged for review\n\nWould you like me to help resolve any of these, or would you like a detailed anomaly report?", time: "9:02 AM" },
  { id: 2, role: "user", content: "Can you explain the unmatched transactions for Salesforce?", time: "9:04 AM" },
  { id: 3, role: "assistant", content: "Sure! I found **2 unmatched Salesforce transactions** in December 2024:\n\n**1. TXN-2024-00849 — $18,500.00**\nThis appears to be the Q4 annual subscription renewal. The SAP ERP record shows the purchase order as `SF-LIC-2024-Q4`, but your bank statement shows it cleared on Dec 13 as `SALESFORCE.COM *SUBSCR` — a slightly different reference format.\n\n**Root cause:** Reference mismatch between ERP and bank.\n\n**My recommendation:** Create a matching rule that maps `SALESFORCE.COM *SUBSCR` → vendor `Salesforce Inc.` with amount tolerance of ±$50.\n\nShall I create this rule automatically?", time: "9:04 AM" },
  { id: 4, role: "user", content: "Yes, create the rule. Also check for any anomalies this month.", time: "9:05 AM" },
  { id: 5, role: "assistant", content: "✅ **Matching rule created** — Rule ID: MR-2024-087 (Active)\n\n**Anomaly Report — December 2024:**\n\n🔴 **High Severity:**\n• Wire transfer to `Global Tech Solutions` ($95,000) has no corresponding invoice in ERP — requires immediate review\n\n🟡 **Medium Severity:**\n• Marketing spend ($35,000) exceeds Q4 budget by 16.7%\n• 3 duplicate payment attempts detected for vendor `AdTech Partners LLC`\n\n🟢 **Low Severity:**\n• Bank fee charges increased 12% vs. November — consider renegotiating wire transfer fees\n\n**Overall risk assessment:** Medium. I recommend prioritizing the Global Tech Solutions wire review.", time: "9:05 AM" },
];

const matchingRules = [
  { id: "MR-001", name: "Stripe Settlement Matching", conditions: "Vendor contains 'Stripe'", tolerance: "$0.50", dateTol: "1 day", priority: 1, matches: 1842, accuracy: "99.2%", status: "active" },
  { id: "MR-002", name: "Payroll Direct Deposits", conditions: "Description contains 'PAYROLL' or 'ADP'", tolerance: "$0.00", dateTol: "0 days", priority: 2, matches: 624, accuracy: "100%", status: "active" },
  { id: "MR-003", name: "Cloud Vendor Subscriptions", conditions: "Vendor in [AWS, Azure, GCP]", tolerance: "$1.00", dateTol: "3 days", priority: 3, matches: 312, accuracy: "97.8%", status: "active" },
  { id: "MR-004", name: "Salesforce Reference Mapping", conditions: "Description contains 'SALESFORCE'", tolerance: "$50.00", dateTol: "5 days", priority: 4, matches: 24, accuracy: "95.1%", status: "active" },
  { id: "MR-005", name: "International Wire Transfers", conditions: "Amount > $10,000 AND currency != USD", tolerance: "$100.00", dateTol: "2 days", priority: 5, matches: 89, accuracy: "93.4%", status: "draft" },
];

const importHistory = [
  { id: 1, name: "bank_dec_2024_jpmorgan.csv", source: "JPMorgan Bank", records: 2847, matched: 2701, errors: 3, size: "1.2 MB", time: "Today 09:14", status: "success" },
  { id: 2, name: "sap_erp_dec_2024.xml", source: "SAP ERP", records: 5120, matched: 4982, errors: 0, size: "4.8 MB", time: "Today 08:30", status: "success" },
  { id: 3, name: "stripe_settlements_dec.csv", source: "Stripe API", records: 1842, matched: 1842, errors: 0, size: "0.9 MB", time: "Yesterday 23:00", status: "success" },
  { id: 4, name: "quickbooks_export_nov.xlsx", source: "QuickBooks", records: 3412, matched: 3198, errors: 12, size: "2.1 MB", time: "Dec 1 14:22", status: "partial" },
  { id: 5, name: "bank_nov_2024_bofa.ofx", source: "Bank of America", records: 1924, matched: 0, errors: 1924, size: "0.7 MB", time: "Nov 30 11:45", status: "error" },
];

const bankTxns = [
  { id: "B001", date: "Dec 15", desc: "STRIPE PAYOUT - Settlement", amount: 187432.50, type: "credit", ref: "STR-PAY-20241215", matched: true },
  { id: "B002", date: "Dec 15", desc: "AWS CLOUD SERVICES", amount: -24750.00, type: "debit", ref: "AWS-INV-1215", matched: true },
  { id: "B003", date: "Dec 14", desc: "SALESFORCE.COM *SUBSCR", amount: -18500.00, type: "debit", ref: "SF-DEC14-8821", matched: false },
  { id: "B004", date: "Dec 14", desc: "ADP PAYROLL DIRECT DEP", amount: -342180.00, type: "debit", ref: "ADP-PAY-DEC1", matched: true },
  { id: "B005", date: "Dec 13", desc: "WIRE IN - GLOBAL TECH SOLUT", amount: 95000.00, type: "credit", ref: "WIRE-GTS-001247", matched: false },
  { id: "B006", date: "Dec 12", desc: "MSFT AZURE SUBSCRIPTION", amount: -8340.00, type: "debit", ref: "MSFT-AZ-DEC", matched: true },
];

const ledgerTxns = [
  { id: "L001", date: "Dec 15", desc: "Stripe Payment Gateway Settlement", amount: 187432.50, type: "credit", account: "Payment Receipts", matched: true },
  { id: "L002", date: "Dec 15", desc: "AWS Cloud Services - Monthly", amount: -24750.00, type: "debit", account: "Tech Infrastructure", matched: true },
  { id: "L003", date: "Dec 14", desc: "Salesforce CRM Q4 License", amount: -18500.00, type: "debit", account: "SaaS Subscriptions", matched: false },
  { id: "L004", date: "Dec 14", desc: "Payroll Direct Deposit Dec W1", amount: -342180.00, type: "debit", account: "Payroll Expenses", matched: true },
  { id: "L005", date: "Dec 12", desc: "Microsoft Azure Subscription", amount: -8340.00, type: "debit", account: "Tech Infrastructure", matched: true },
  { id: "L006", date: "Dec 10", desc: "Acme Manufacturing AP Payment", amount: -67800.00, type: "debit", account: "Accounts Payable", matched: false },
];

const exceptionPieData = [
  { name: "Matched", value: 88.9, fill: "#10b981" },
  { name: "Unmatched", value: 8.7, fill: "#94a3b8" },
  { name: "Exceptions", value: 2.4, fill: "#ef4444" },
];

const importSourceData = [
  { name: "SAP ERP", value: 42, fill: "#2563eb" },
  { name: "Bank Import", value: 28, fill: "#10b981" },
  { name: "Stripe API", value: 15, fill: "#8b5cf6" },
  { name: "QuickBooks", value: 11, fill: "#f59e0b" },
  { name: "Manual", value: 4, fill: "#94a3b8" },
];

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ─── Utility Helpers ─────────────────────────────────────────
function cx(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    matched: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    unmatched: "bg-slate-50 text-slate-600 border border-slate-200",
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    exception: "bg-red-50 text-red-700 border border-red-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    inactive: "bg-slate-50 text-slate-500 border border-slate-200",
    syncing: "bg-blue-50 text-blue-700 border border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    error: "bg-red-50 text-red-700 border border-red-200",
    partial: "bg-amber-50 text-amber-700 border border-amber-200",
    draft: "bg-slate-50 text-slate-600 border border-slate-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    info: "bg-blue-50 text-blue-700 border border-blue-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  const labels: Record<string, string> = {
    matched: t("status.matched"), unmatched: t("status.unmatched"), pending: t("status.pending"),
    exception: t("status.exception"), active: t("status.active"), inactive: t("status.inactive"),
    syncing: t("status.syncing"), success: t("status.success"), error: t("status.error"), partial: t("status.partial"),
    draft: t("status.draft"), warning: t("status.warning"), info: t("status.info"), high: t("status.high"), medium: t("status.medium"), low: t("status.low"),
  };
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", map[status] || map.info)}>
      <span className={cx("w-1.5 h-1.5 rounded-full",
        status === "matched" || status === "active" || status === "success" ? "bg-emerald-500" :
        status === "exception" || status === "error" || status === "high" ? "bg-red-500" :
        status === "pending" || status === "warning" || status === "medium" || status === "partial" ? "bg-amber-500" :
        "bg-slate-400"
      )} />
      {labels[status] || status}
    </span>
  );
}

function Btn({
  children, variant = "primary", size = "md", onClick, className = "", disabled = false, type = "button"
}: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg"; onClick?: () => void; className?: string; disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 focus:ring-slate-300 shadow-sm",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600 focus:ring-slate-300",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 shadow-sm",
    outline: "bg-transparent hover:bg-blue-50 text-blue-600 border border-blue-300 focus:ring-blue-400",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cx(base, variants[variant], sizes[size], className)}>
      {children}
    </button>
  );
}

function Input({
  label, placeholder, type = "text", value, onChange, icon, className = "", hint, error
}: {
  label?: string; placeholder?: string; type?: string; value?: string;
  onChange?: (v: string) => void; icon?: React.ReactNode; className?: string;
  hint?: string; error?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange?.(e.target.value)}
          className={cx(
            "w-full rounded-lg border bg-white text-sm text-slate-900 placeholder-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all",
            error ? "border-red-300" : "border-slate-200",
            icon ? "pl-9 pr-3 py-2.5" : "px-3 py-2.5"
          )}
        />
      </div>
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Card({ children, className = "", padding = true, ...rest }: {
  children: React.ReactNode; className?: string; padding?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("bg-white rounded-xl border border-slate-200 shadow-sm", padding ? "p-5" : "", className)} {...rest}>
      {children}
    </div>
  );
}

function KpiCard({ title, value, sub, trend, trendUp, icon, color = "blue", small = false }: {
  title: string; value: string; sub?: string; trend?: string; trendUp?: boolean;
  icon: React.ReactNode; color?: "blue" | "green" | "amber" | "red" | "purple" | "slate"; small?: boolean;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-50 text-slate-600",
  };
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={cx("p-2 rounded-lg", colors[color])}>{icon}</div>
        {trend && (
          <span className={cx("flex items-center gap-0.5 text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{trend}
          </span>
        )}
      </div>
      <div className={cx("font-bold text-slate-900 font-mono", small ? "text-xl" : "text-2xl")}>{value}</div>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{title}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </Card>
  );
}

function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className={cx("relative bg-white rounded-2xl shadow-2xl w-full", sizes[size])} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ name, size = "md", color }: { name: string; size?: "sm" | "md" | "lg"; color?: string }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500"];
  const bg = color || colors[name.charCodeAt(0) % colors.length];
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-8 h-8 text-sm", lg: "w-10 h-10 text-base" };
  return (
    <div className={cx("rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0", bg, sizes[size])}>
      {initials}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = "blue", showLabel = false }: {
  value: number; max?: number; color?: string; showLabel?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colors: Record<string, string> = {
    blue: "bg-blue-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500"
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cx("h-full rounded-full transition-all duration-500", colors[color] || "bg-blue-500")} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-xs text-slate-500 w-8 text-right">{Math.round(pct)}%</span>}
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: {
  icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="p-4 bg-slate-50 rounded-2xl text-slate-300">{icon}</div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      {action}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("bg-slate-100 rounded animate-pulse", className)} />;
}

// ─── Sidebar ─────────────────────────────────────────────────
const navItems = [
  { id: "dashboard", label: t("navigation.dashboard"), icon: LayoutDashboard },
  { id: "transactions", label: t("navigation.transactions"), icon: ArrowLeftRight },
  { id: "reconciliation", label: t("navigation.reconciliation"), icon: GitMerge },
  { id: "imports", label: t("navigation.imports"), icon: Upload },
  { id: "matching-rules", label: t("navigation.matchingRules"), icon: SlidersHorizontal },
  { id: "bank-accounts", label: t("navigation.bankAccounts"), icon: Landmark },
  { id: "integrations", label: t("navigation.integrations"), icon: Network },
  { id: "ai-assistant", label: t("navigation.aiAssistant"), icon: Bot },
  { id: "reports", label: t("navigation.reports"), icon: BarChart3 },
  { id: "audit-logs", label: t("navigation.auditLogs"), icon: ScrollText },
];

const bottomNavItems = [
  { id: "notifications", label: t("navigation.notifications"), icon: Bell, badge: 4 },
  { id: "users", label: t("navigation.users"), icon: Users },
  { id: "roles", label: t("navigation.roles"), icon: ShieldCheck },
  { id: "settings", label: t("navigation.settings"), icon: Settings },
  { id: "billing", label: t("navigation.billing"), icon: CreditCard },
  { id: "help", label: t("navigation.helpCenter"), icon: HelpCircle },
];

function Sidebar({ current, onChange, collapsed, onToggle }: {
  current: View; onChange: (v: View) => void; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <aside className={cx(
      "h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className={cx("flex items-center border-b border-slate-100 h-14 flex-shrink-0", collapsed ? "justify-center px-3" : "gap-2.5 px-4")}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <GitMerge size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">E-Reconcile</div>
            <div className="text-[10px] text-slate-400 leading-tight font-medium">MN Finance AI</div>
          </div>
        )}
        <button onClick={onToggle} className={cx("ml-auto p-1 hover:bg-slate-100 rounded text-slate-400", collapsed ? "hidden" : "")}>
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {!collapsed && <p className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main</p>}
        <nav className="flex flex-col gap-0.5">
          {navItems.map(item => {
            const active = current === item.id;
            return (
              <button key={item.id} onClick={() => onChange(item.id as View)}
                className={cx(
                  "flex items-center gap-3 rounded-lg transition-all duration-150 text-sm font-medium text-left",
                  collapsed ? "justify-center w-10 h-10 mx-auto" : "px-3 py-2 w-full",
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
                title={collapsed ? item.label : undefined}>
                <item.icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && <p className="px-2 py-1 mt-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Management</p>}
        <nav className="flex flex-col gap-0.5 mt-1">
          {bottomNavItems.map(item => {
            const active = current === item.id;
            return (
              <button key={item.id} onClick={() => onChange(item.id as View)}
                className={cx(
                  "flex items-center gap-3 rounded-lg transition-all duration-150 text-sm font-medium text-left relative",
                  collapsed ? "justify-center w-10 h-10 mx-auto" : "px-3 py-2 w-full",
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
                title={collapsed ? item.label : undefined}>
                <item.icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {"badge" in item && item.badge && !collapsed && (
                  <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                {"badge" in item && item.badge && collapsed && (
                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile */}
      <div className={cx("border-t border-slate-100 p-2", collapsed ? "flex justify-center" : "")}>
        <div className={cx("flex items-center gap-2.5 rounded-lg p-2 hover:bg-slate-50 cursor-pointer", collapsed ? "" : "w-full")}>
          <Avatar name="Sarah Chen" size="sm" color="bg-blue-600" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">Sarah Chen</div>
              <div className="text-[10px] text-slate-500 truncate">Finance Manager</div>
            </div>
          )}
          {!collapsed && <ChevronUp size={12} className="text-slate-400" />}
        </div>
      </div>
    </aside>
  );
}

function TopNav({ onNavigate, sidebarCollapsed, onSidebarToggle }: {
  onNavigate: (v: View) => void; sidebarCollapsed: boolean; onSidebarToggle: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-5 flex-shrink-0">
      {sidebarCollapsed && (
        <button onClick={onSidebarToggle} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <Menu size={18} />
        </button>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("system.searchPlaceholder")}
            className="w-full pl-8 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Quick Actions */}
        <Btn variant="primary" size="sm" onClick={() => onNavigate("imports")} className="hidden md:inline-flex">
          <Plus size={13} /> {t("actions.import")}
        </Btn>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{t("notifications.title")}</span>
                <span className="text-xs text-blue-600 cursor-pointer hover:underline">Mark all read</span>
              </div>
              {[
                { msg: "Reconciliation completed for December 2024", time: "2m ago", type: "success" },
                { msg: "4 exceptions require your review", time: "18m ago", type: "warning" },
                { msg: "SAP ERP sync failed — retrying", time: "1h ago", type: "error" },
                { msg: "New team member invited: michael.b@co.com", time: "3h ago", type: "info" },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                  <div className={cx("mt-0.5 w-2 h-2 rounded-full flex-shrink-0",
                    n.type === "success" ? "bg-emerald-500" :
                    n.type === "warning" ? "bg-amber-500" :
                    n.type === "error" ? "bg-red-500" : "bg-blue-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700">{n.msg}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
              <div className="p-3 text-center">
                <button onClick={() => { onNavigate("notifications"); setNotifOpen(false); }} className="text-xs text-blue-600 hover:underline">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* Workspace */}
        <button className="hidden md:flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm text-slate-600 border border-slate-200 transition-colors">
          <Building size={14} />
          <span className="text-xs font-medium">Acme Corp</span>
          <ChevronDown size={12} />
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <Avatar name="Sarah Chen" size="sm" color="bg-blue-600" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50">
              <div className="p-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Sarah Chen</p>
                <p className="text-xs text-slate-500">sarah.chen@acmecorp.com</p>
                <StatusBadge status="active" />
              </div>
              {[
                { label: t("navigation.profileSettings"), icon: User },
                { label: t("navigation.security"), icon: Shield },
                { label: t("navigation.billing"), icon: CreditCard },
              ].map(item => (
                <button key={item.label} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
                  <item.icon size={14} className="text-slate-400" />{item.label}
                </button>
              ))}
              <div className="border-t border-slate-100 p-1">
                <button onClick={() => onNavigate("login")} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg text-left">
                  <LogOut size={14} />Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Auth Screens ─────────────────────────────────────────────
function AuthLayout({ children, title, subtitle }: {
  children: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <GitMerge size={20} className="text-white" />
            </div>
            <div className="text-left">
              <div className="text-base font-bold text-slate-900">E-Reconcile MN</div>
              <div className="text-xs text-slate-500">AI Financial Reconciliation</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <Card className="shadow-xl shadow-slate-200/60">{children}</Card>
        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 E-Reconcile MN · <span className="hover:underline cursor-pointer text-slate-500">Privacy</span> · <span className="hover:underline cursor-pointer text-slate-500">Terms</span>
        </p>
      </div>
    </div>
  );
}

function LoginScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [email, setEmail] = useState("sarah.chen@acmecorp.com");
  const [password, setPassword] = useState("••••••••••");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onNavigate("dashboard"); }, 1200);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your E-Reconcile account">
      <div className="flex flex-col gap-4">
        <Input label="Email address" type="email" placeholder="you@company.com"
          value={email} onChange={setEmail} icon={<Mail size={15} />} />
        <div>
          <Input label="Password" type="password" placeholder="Enter your password"
            value={password} onChange={setPassword} icon={<Lock size={15} />} />
          <div className="flex justify-end mt-1.5">
            <button onClick={() => onNavigate("forgot-password")} className="text-xs text-blue-600 hover:underline">
              Forgot password?
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="remember" className="rounded border-slate-300 text-blue-600" />
          <label htmlFor="remember" className="text-sm text-slate-600">Remember me for 30 days</label>
        </div>
        <Btn variant="primary" size="lg" onClick={handleLogin} disabled={loading} className="w-full">
          {loading ? <><Loader2 size={16} className="animate-spin" />Signing in...</> : "Sign In"}
        </Btn>
        <div className="relative flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or continue with</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {["Google SSO", "Microsoft SSO"].map(sso => (
            <Btn key={sso} variant="secondary" size="md" className="w-full">
              <Globe size={14} />{sso}
            </Btn>
          ))}
        </div>
        <p className="text-center text-sm text-slate-600 mt-2">
          Don&apos;t have an account?{" "}
          <button onClick={() => onNavigate("register")} className="text-blue-600 font-medium hover:underline">Sign up free</button>
        </p>
      </div>
    </AuthLayout>
  );
}

function RegisterScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  return (
    <AuthLayout title="Create your account" subtitle="Start reconciling smarter in minutes">
      <div className="flex gap-1 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={cx("flex-1 h-1 rounded-full transition-colors", s <= step ? "bg-blue-600" : "bg-slate-200")} />
        ))}
      </div>
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" placeholder="Sarah" />
            <Input label="Last name" placeholder="Chen" />
          </div>
          <Input label="Work email" type="email" placeholder="sarah@company.com" icon={<Mail size={15} />} />
          <Input label="Password" type="password" placeholder="Min. 12 characters" icon={<Lock size={15} />}
            hint="Use a mix of letters, numbers and symbols" />
          <Btn variant="primary" size="lg" onClick={() => setStep(2)} className="w-full">Continue</Btn>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Input label="Company name" placeholder="Acme Corporation" icon={<Building size={15} />} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Industry</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option>Technology</option><option>Finance</option><option>Retail</option><option>Healthcare</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Company size</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option>1–10</option><option>11–50</option><option>51–200</option><option selected>201–1000</option><option>1000+</option>
              </select>
            </div>
          </div>
          <Input label="Country" placeholder="United States" icon={<Globe size={15} />} />
          <div className="flex gap-3">
            <Btn variant="secondary" size="lg" onClick={() => setStep(1)} className="flex-1">Back</Btn>
            <Btn variant="primary" size="lg" onClick={() => setStep(3)} className="flex-1">Continue</Btn>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <CheckCircle2 size={32} className="text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900">Almost there!</p>
            <p className="text-xs text-slate-600 mt-1">Review your plan and confirm your account</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-900">Professional Plan</span>
              <span className="text-sm font-bold text-blue-600">$149/mo</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {["Unlimited transactions", "AI-powered matching", "5 team members", "All integrations", "Audit logs"].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check size={12} className="text-emerald-500" />{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-blue-600" />
            <p className="text-xs text-slate-600">
              I agree to the <span className="text-blue-600 hover:underline cursor-pointer">Terms of Service</span> and{" "}
              <span className="text-blue-600 hover:underline cursor-pointer">Privacy Policy</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" size="lg" onClick={() => setStep(2)} className="flex-1">Back</Btn>
            <Btn variant="primary" size="lg" onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onNavigate("email-verification"); }, 1000); }} disabled={loading} className="flex-1">
              {loading ? <><Loader2 size={14} className="animate-spin" />Creating...</> : "Create Account"}
            </Btn>
          </div>
        </div>
      )}
      <p className="text-center text-sm text-slate-600 mt-4">
        Already have an account?{" "}
        <button onClick={() => onNavigate("login")} className="text-blue-600 font-medium hover:underline">Sign in</button>
      </p>
    </AuthLayout>
  );
}

function ForgotPasswordScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title={sent ? "Check your email" : "Reset your password"}
      subtitle={sent ? "We've sent a reset link to your inbox" : "Enter your email to receive a reset link"}>
      {!sent ? (
        <div className="flex flex-col gap-4">
          <Input label="Email address" type="email" placeholder="you@company.com" icon={<Mail size={15} />} />
          <Btn variant="primary" size="lg" onClick={() => setSent(true)} className="w-full">Send Reset Link</Btn>
          <Btn variant="ghost" size="md" onClick={() => onNavigate("login")} className="w-full">
            <ChevronLeft size={15} />Back to sign in
          </Btn>
        </div>
      ) : (
        <div className="flex flex-col gap-4 items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Mail size={28} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-600">We sent a password reset link to</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">sarah.chen@acmecorp.com</p>
          </div>
          <p className="text-xs text-slate-500">Didn&apos;t receive the email? Check spam or{" "}
            <button className="text-blue-600 hover:underline" onClick={() => setSent(false)}>try again</button>
          </p>
          <Btn variant="secondary" size="md" onClick={() => onNavigate("login")} className="w-full">
            <ChevronLeft size={15} />Back to sign in
          </Btn>
        </div>
      )}
    </AuthLayout>
  );
}

function MFAScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3, r4, r5];

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) refs[i + 1].current?.focus();
    if (next.every(d => d) && next.join("").length === 6) {
      setTimeout(() => onNavigate("dashboard"), 500);
    }
  };

  return (
    <AuthLayout title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app">
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 justify-center">
          {otp.map((d, i) => (
            <input key={i} ref={refs[i]} type="text" maxLength={1} value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => e.key === "Backspace" && !d && i > 0 && refs[i - 1].current?.focus()}
              className="w-11 h-12 text-center text-xl font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all"
            />
          ))}
        </div>
        <Btn variant="primary" size="lg" onClick={() => onNavigate("dashboard")} className="w-full">
          <Fingerprint size={16} />Verify Identity
        </Btn>
        <div className="text-center">
          <p className="text-xs text-slate-500">Having trouble? <button className="text-blue-600 hover:underline">Use backup code</button></p>
        </div>
      </div>
    </AuthLayout>
  );
}

function SessionExpiredScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <AuthLayout title="Session expired" subtitle="Your session has timed out for security">
      <div className="flex flex-col gap-4 items-center text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
          <Clock size={28} className="text-amber-500" />
        </div>
        <p className="text-sm text-slate-600">For your security, we sign you out after 4 hours of inactivity. Sign in again to continue where you left off.</p>
        <Btn variant="primary" size="lg" onClick={() => onNavigate("login")} className="w-full">Sign In Again</Btn>
      </div>
    </AuthLayout>
  );
}

function AcceptInvitationScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <AuthLayout title="You're invited!" subtitle="Join the Acme Corp workspace on E-Reconcile MN">
      <div className="flex flex-col gap-4">
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <Avatar name="James Wilson" size="md" />
          <div>
            <p className="text-sm font-semibold text-slate-900">James Wilson</p>
            <p className="text-xs text-slate-500">invited you as <strong>Finance Manager</strong></p>
          </div>
        </div>
        <Input label="Your name" placeholder="Enter your full name" />
        <Input label="Password" type="password" placeholder="Create a secure password" icon={<Lock size={15} />} />
        <Input label="Confirm password" type="password" placeholder="Confirm your password" icon={<Lock size={15} />} />
        <Btn variant="primary" size="lg" onClick={() => onNavigate("dashboard")} className="w-full">
          <Check size={16} />Accept Invitation
        </Btn>
      </div>
    </AuthLayout>
  );
}

// ─── Onboarding ───────────────────────────────────────────────
function OnboardingScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    "Welcome", "Company Info", "Fiscal Year", "Currency",
    "Connect ERP", "Connect Bank", "Invite Team", "Subscription", "Finish"
  ];

  const goNext = () => step < steps.length - 1 ? setStep(step + 1) : onNavigate("dashboard");
  const goPrev = () => step > 0 && setStep(step - 1);

  const stepContent: Record<number, React.ReactNode> = {
    0: (
      <div className="text-center py-4">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-blue-200">
          <GitMerge size={36} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to E-Reconcile MN</h2>
        <p className="text-slate-600 text-sm mb-6">Let&apos;s get your workspace set up. It takes about 5 minutes and you&apos;ll be reconciling smarter from day one.</p>
        <div className="grid grid-cols-3 gap-3 text-center mb-6">
          {[
            { icon: <Zap size={16} />, label: "AI-Powered Matching" },
            { icon: <Shield size={16} />, label: "Audit Ready" },
            { icon: <RefreshCw size={16} />, label: "Auto-Sync" },
          ].map(f => (
            <div key={f.label} className="bg-slate-50 rounded-xl p-3">
              <div className="text-blue-600 mb-1 flex justify-center">{f.icon}</div>
              <p className="text-xs font-medium text-slate-700">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    ),
    1: (
      <div className="flex flex-col gap-4">
        <Input label="Company name" placeholder="Acme Corporation" icon={<Building size={15} />} />
        <Input label="Legal name" placeholder="Acme Corporation, Inc." />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Industry</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Technology</option><option>Finance & Banking</option><option>Retail</option><option>Manufacturing</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Country</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>United States</option><option>United Kingdom</option><option>Canada</option><option>Australia</option>
            </select>
          </div>
        </div>
        <Input label="Tax ID / EIN" placeholder="XX-XXXXXXX" />
      </div>
    ),
    2: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">This determines your reconciliation periods and reporting cycles.</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Fiscal year start month</label>
          <div className="grid grid-cols-4 gap-2">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
              <button key={m} className={cx("rounded-lg py-2 text-sm font-medium border transition-colors",
                i === 0 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
              )}>{m}</button>
            ))}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">Your fiscal year will run Jan 1 – Dec 31, 2024. This can be changed in Settings later.</p>
        </div>
      </div>
    ),
    3: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Set your functional currency for all financial reports.</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { code: "USD", name: "US Dollar", symbol: "$" },
            { code: "EUR", name: "Euro", symbol: "€" },
            { code: "GBP", name: "British Pound", symbol: "£" },
            { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
            { code: "AUD", name: "Australian Dollar", symbol: "A$" },
            { code: "JPY", name: "Japanese Yen", symbol: "¥" },
          ].map((c, i) => (
            <button key={c.code} className={cx(
              "flex items-center gap-2 p-3 rounded-xl border text-left transition-all",
              i === 0 ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 bg-white"
            )}>
              <span className="text-lg font-mono">{c.symbol}</span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{c.code}</p>
                <p className="text-[10px] text-slate-500">{c.name}</p>
              </div>
              {i === 0 && <Check size={14} className="text-blue-600 ml-auto" />}
            </button>
          ))}
        </div>
      </div>
    ),
    4: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">Connect your ERP system to auto-import transactions.</p>
        {[
          { name: "SAP S/4HANA", logo: "SAP", desc: "Import journal entries & GL", popular: true },
          { name: "Oracle NetSuite", logo: "NS", desc: "Sync all financial modules" },
          { name: "QuickBooks Online", logo: "QB", desc: "Import invoices & payments" },
          { name: "Microsoft Dynamics 365", logo: "D365", desc: "Connect your Dynamics instance" },
          { name: "Xero", logo: "X", desc: "Import from Xero accounting" },
          { name: "Upload CSV / Excel", logo: "CSV", desc: "Manual file import" },
        ].map((erp, i) => (
          <button key={erp.name} className={cx(
            "flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-blue-400",
            i === 0 ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
          )}>
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-slate-600">{erp.logo}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{erp.name}</p>
              <p className="text-xs text-slate-500">{erp.desc}</p>
            </div>
            {erp.popular && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Popular</span>}
            {i === 0 && <Check size={14} className="text-blue-600" />}
          </button>
        ))}
      </div>
    ),
    5: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">Connect your bank accounts for automated statement import.</p>
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center bg-blue-50/50">
          <Landmark size={24} className="text-blue-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Connect via Plaid</p>
          <p className="text-xs text-slate-500 mt-1">Securely link 12,000+ financial institutions</p>
          <Btn variant="primary" size="sm" className="mt-3">Connect Bank Account</Btn>
        </div>
        <p className="text-xs text-center text-slate-400">— or upload a bank statement —</p>
        <Btn variant="secondary" size="md" className="w-full">
          <FileUp size={14} />Upload OFX / QFX / CSV Statement
        </Btn>
      </div>
    ),
    6: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Invite your finance team to collaborate.</p>
        <div className="flex gap-2">
          <Input placeholder="colleague@company.com" className="flex-1" icon={<Mail size={15} />} />
          <Btn variant="secondary" size="md">Invite</Btn>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { name: "James Wilson", email: "james.w@acmecorp.com", role: "Finance Manager" },
            { name: "Maria Rodriguez", email: "maria.r@acmecorp.com", role: "Accountant" },
          ].map(u => (
            <div key={u.email} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Avatar name={u.name} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Finance Manager</option><option>Accountant</option><option>Auditor</option><option>Viewer</option>
              </select>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center">You can always invite more team members from Settings.</p>
      </div>
    ),
    7: (
      <div className="flex flex-col gap-3">
        {[
          { name: "Starter", price: "$49", features: ["5k transactions/mo", "2 team members", "Basic matching"], highlight: false },
          { name: "Professional", price: "$149", features: ["50k transactions/mo", "5 team members", "AI matching", "All integrations", "Audit logs"], highlight: true },
          { name: "Enterprise", price: "Custom", features: ["Unlimited", "Unlimited users", "Custom AI rules", "Priority support", "SLA"], highlight: false },
        ].map(plan => (
          <div key={plan.name} className={cx(
            "rounded-xl border p-4 cursor-pointer transition-all",
            plan.highlight ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-300"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                {plan.highlight && <span className="text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">Recommended</span>}
              </div>
              <span className={cx("text-base font-bold", plan.highlight ? "text-blue-600" : "text-slate-900")}>
                {plan.price}<span className="text-xs font-normal text-slate-500">{plan.price !== "Custom" ? "/mo" : ""}</span>
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Check size={10} className="text-emerald-500" />{f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
    8: (
      <div className="flex flex-col items-center text-center py-4 gap-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">You&apos;re all set!</h2>
          <p className="text-sm text-slate-600 mt-1">Your workspace is ready. Let&apos;s start reconciling.</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 w-full text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Setup Summary</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Company", "Acme Corporation"],
              ["Fiscal Year", "Jan – Dec 2024"],
              ["Currency", "USD ($)"],
              ["ERP", "SAP S/4HANA"],
              ["Bank", "JPMorgan Chase"],
              ["Plan", "Professional"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-slate-600"><strong>{k}:</strong> {v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GitMerge size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">E-Reconcile MN</span>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div key={s} className={cx("flex-1 h-1.5 rounded-full transition-all",
              i < step ? "bg-blue-600" : i === step ? "bg-blue-400" : "bg-slate-200"
            )} />
          ))}
        </div>
        <Card className="shadow-xl shadow-slate-200/60" padding={false}>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Step {step + 1} of {steps.length}</p>
              <h2 className="text-lg font-bold text-slate-900">{steps[step]}</h2>
            </div>
            <span className="text-xs text-slate-400">{Math.round((step / (steps.length - 1)) * 100)}% complete</span>
          </div>
          <div className="p-6 max-h-[400px] overflow-y-auto">{stepContent[step]}</div>
          <div className="p-6 border-t border-slate-100 flex gap-3">
            {step > 0 && <Btn variant="secondary" size="md" onClick={goPrev} className="flex-1">Back</Btn>}
            <Btn variant="primary" size="md" onClick={goNext} className="flex-1">
              {step === steps.length - 1 ? "Go to Dashboard" : "Continue"}
              <ChevronRight size={15} />
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
function DashboardScreen({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">December 2024 · Last updated 2 minutes ago</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" onClick={() => setLoading(!loading)}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh
          </Btn>
          <Btn variant="secondary" size="sm">
            <Calendar size={13} />Dec 2024
            <ChevronDown size={12} />
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => onNavigate("reconciliation")}>
            <Play size={13} />Start Reconciliation
          </Btn>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4">
        <KpiCard title="Total Transactions" value="12,847" sub="Dec 2024 · All sources"
          trend="+8.4%" trendUp={true} icon={<ArrowLeftRight size={16} />} color="blue" />
        <KpiCard title="Matched" value="11,423" sub="88.9% match rate"
          trend="+2.3%" trendUp={true} icon={<CheckCircle2 size={16} />} color="green" />
        <KpiCard title="Unmatched" value="1,124" sub="Requires attention"
          trend="-15.2%" trendUp={true} icon={<XCircle size={16} />} color="slate" />
        <KpiCard title="Exceptions" value="300" sub="2.3% exception rate"
          trend="-22.4%" trendUp={true} icon={<AlertTriangle size={16} />} color="amber" />
        <KpiCard title="Imported Today" value="847" sub="3 sources synced"
          trend="+12.1%" trendUp={true} icon={<Upload size={16} />} color="blue" />
        <KpiCard title="Pending Review" value="189" sub="Assigned to you: 42"
          trend="-8.7%" trendUp={true} icon={<Clock size={16} />} color="purple" />
      </div>

      {/* Balance Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-500 mb-1">Bank Balance</p>
          <p className="text-2xl font-bold text-slate-900 font-mono">$2,847,293.50</p>
          <p className="text-xs text-slate-400 mt-1">JPMorgan Chase · as of today</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-slate-500 mb-1">Ledger Balance</p>
          <p className="text-2xl font-bold text-slate-900 font-mono">$2,841,847.22</p>
          <p className="text-xs text-slate-400 mt-1">SAP ERP GL · as of today</p>
        </Card>
        <Card className={cx("border-l-4", 5446.28 > 0 ? "border-l-red-400" : "border-l-emerald-400")}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-slate-500">Difference</p>
            <StatusBadge status="exception" />
          </div>
          <p className="text-2xl font-bold text-red-500 font-mono">$5,446.28</p>
          <p className="text-xs text-slate-400 mt-1">Requires reconciliation</p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Monthly Reconciliation */}
        <Card className="xl:col-span-2" padding={false}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Monthly Reconciliation Volume</h3>
              <p className="text-xs text-slate-500">Matched vs Unmatched transactions</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Matched</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Unmatched</span>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="matched" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="unmatched" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Exception Breakdown */}
        <Card padding={false}>
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Status Distribution</h3>
            <p className="text-xs text-slate-500">Current period</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={150}>
              <RechartsPieChart>
                <Pie data={exceptionPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {exceptionPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 mt-2">
              {exceptionPieData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 font-mono">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Accuracy + Trend Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card padding={false}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Matching Accuracy</h3>
              <p className="text-xs text-slate-500">Manual vs AI-assisted matching</p>
            </div>
            <div className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Sparkles size={12} />98.7% AI Accuracy
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={accuracyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[85, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                <Line type="monotone" dataKey="accuracy" stroke="#94a3b8" strokeWidth={2} dot={false} name="Manual" />
                <Line type="monotone" dataKey="aiAccuracy" stroke="#2563eb" strokeWidth={2.5} dot={false} name="AI" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Import Sources */}
        <Card padding={false}>
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Import Sources</h3>
            <p className="text-xs text-slate-500">Transaction volume by source</p>
          </div>
          <div className="p-5">
            <div className="flex flex-col gap-3">
              {importSourceData.map(s => (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{s.name}</span>
                    <span className="text-xs font-semibold text-slate-900 font-mono">{s.value}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.value}%`, background: s.fill }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <Card className="xl:col-span-2" padding={false}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => onNavigate("audit-logs")}>View all</button>
          </div>
          <div className="divide-y divide-slate-50">
            {auditLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <Avatar name={log.user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900">{log.action}</p>
                  <p className="text-xs text-slate-500 truncate">{log.resource}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <StatusBadge status={log.type} />
                  <p className="text-[10px] text-slate-400 mt-0.5">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tasks & Alerts */}
        <div className="flex flex-col gap-4">
          <Card padding={false}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Pending Tasks</h3>
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">5 open</span>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { task: "Review Global Tech wire transfer", priority: "high", due: "Today" },
                { task: "Approve December reconciliation", priority: "medium", due: "Dec 20" },
                { task: "Resolve 4 Salesforce exceptions", priority: "medium", due: "Dec 22" },
                { task: "Schedule Q4 audit export", priority: "low", due: "Dec 31" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{t.task}</p>
                    <p className="text-[10px] text-slate-400">Due {t.due}</p>
                  </div>
                  <StatusBadge status={t.priority} />
                </div>
              ))}
            </div>
          </Card>
          <Card padding={false}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">System Alerts</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { msg: "SAP sync scheduled in 2 hours", type: "info" },
                { msg: "Stripe API rate limit approaching", type: "warning" },
                { msg: "Backup completed successfully", type: "success" },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                  {a.type === "info" && <Info size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />}
                  {a.type === "warning" && <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />}
                  {a.type === "success" && <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />}
                  <p className="text-xs text-slate-600">{a.msg}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Transactions ─────────────────────────────────────────────
function TransactionsScreen() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerTx, setDrawerTx] = useState<TxRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = transactions.filter(tx =>
    (statusFilter === "all" || tx.status === statusFilter) &&
    (search === "" || tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.vendor.toLowerCase().includes(search.toLowerCase()) || tx.id.includes(search))
  );

  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">
      {/* Drawer */}
      {drawerTx && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawerTx(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500 font-mono">{drawerTx.id}</p>
                <h2 className="text-sm font-bold text-slate-900 mt-0.5">{drawerTx.description}</h2>
              </div>
              <button onClick={() => setDrawerTx(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={drawerTx.status} />
                <span className={cx("text-xl font-bold font-mono", drawerTx.credit > 0 ? "text-emerald-600" : "text-slate-900")}>
                  {drawerTx.credit > 0 ? "+" : ""}{fmtCurrency(drawerTx.credit || drawerTx.debit)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Date", drawerTx.date],
                  ["Vendor", drawerTx.vendor],
                  ["Account", drawerTx.account],
                  ["Source", drawerTx.source],
                  ["Reference", drawerTx.ref],
                  ["Type", drawerTx.debit > 0 ? "Debit" : "Credit"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Btn variant="primary" size="sm" className="w-full"><GitMerge size={13} />Match Transaction</Btn>
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="secondary" size="sm"><Flag size={13} />Flag</Btn>
                  <Btn variant="secondary" size="sm"><Tag size={13} />Tag</Btn>
                </div>
              </div>
              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-3">Timeline</p>
                <div className="flex flex-col gap-3">
                  {[
                    { action: "Transaction imported", user: "System", time: "Dec 15, 09:14" },
                    { action: "AI matching attempted — 87% confidence", user: "AI Engine", time: "Dec 15, 09:15" },
                    { action: "Flagged as Exception", user: "AI Engine", time: "Dec 15, 09:15" },
                    { action: "Assigned to Sarah Chen", user: "System", time: "Dec 15, 09:16" },
                  ].map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-0.5" />
                        {i < 3 && <div className="w-px flex-1 bg-slate-200 mt-1 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs text-slate-700">{e.action}</p>
                        <p className="text-[10px] text-slate-400">{e.user} · {e.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Comments */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Comments</p>
                <div className="flex gap-2">
                  <Avatar name="Sarah Chen" size="sm" />
                  <input type="text" placeholder="Add a comment..." className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <Btn variant="primary" size="sm"><Send size={12} /></Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">12,847 transactions · December 2024</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-medium text-blue-700">{selected.length} selected</span>
              <Btn variant="primary" size="sm"><GitMerge size={12} />Match</Btn>
              <Btn variant="secondary" size="sm"><Download size={12} />Export</Btn>
              <button onClick={() => setSelected([])} className="text-slate-400 hover:text-slate-600 ml-1"><X size={14} /></button>
            </div>
          )}
          <Btn variant="secondary" size="sm"><Download size={13} />Export</Btn>
          <Btn variant="primary" size="sm"><Plus size={13} />Add Manual</Btn>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("transactions.searchPlaceholder")}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {["all", "matched", "unmatched", "pending", "exception"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cx("px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}>{s === "all" ? "All" : s}</button>
          ))}
        </div>
        <Btn variant="secondary" size="sm"><Filter size={13} />More Filters</Btn>
        <Btn variant="secondary" size="sm"><Calendar size={13} />Dec 1–15</Btn>
      </div>

      {/* Table */}
      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="pl-4 py-3 text-left">
                  <input type="checkbox"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={() => selected.length === filtered.length ? setSelected([]) : setSelected(filtered.map(t => t.id))}
                    className="rounded border-slate-300 text-blue-600" />
                </th>
                {["Transaction ID", "Date", "Description", "Vendor", "Account", "Debit", "Credit", "Source", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(tx => (
                <tr key={tx.id} className={cx("hover:bg-slate-50 transition-colors cursor-pointer", selected.includes(tx.id) ? "bg-blue-50/50" : "")}
                  onClick={() => setDrawerTx(tx)}>
                  <td className="pl-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(tx.id); }}>
                    <input type="checkbox" checked={selected.includes(tx.id)} onChange={() => {}} className="rounded border-slate-300 text-blue-600" />
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-blue-600 font-medium">{tx.id}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 font-mono">{tx.date}</td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <p className="text-xs font-medium text-slate-800 truncate">{tx.description}</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{tx.ref}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{tx.vendor}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.account}</td>
                  <td className="px-3 py-3 text-xs font-mono font-medium text-slate-800 whitespace-nowrap">
                    {tx.debit > 0 ? fmtCurrency(tx.debit) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs font-mono font-medium text-emerald-600 whitespace-nowrap">
                    {tx.credit > 0 ? fmtCurrency(tx.credit) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{tx.source}</span>
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={tx.status} /></td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><MoreHorizontal size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">Showing {filtered.length} of 12,847 transactions</p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 transition-colors" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={14} />
            </button>
            {[1, 2, 3, "...", 48].map((p, i) => (
              <button key={i} onClick={() => typeof p === "number" && setCurrentPage(p)}
                className={cx("w-7 h-7 text-xs rounded-lg transition-colors", currentPage === p ? "bg-blue-600 text-white" : "hover:bg-white text-slate-500 hover:border-slate-200")}>
                {p}
              </button>
            ))}
            <button className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 transition-colors" onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Imports ──────────────────────────────────────────────────
function ImportsScreen() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const [tab, setTab] = useState("upload");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploading(true);
    let prog = 0;
    const interval = setInterval(() => {
      prog += 15;
      setUploadProgress(prog);
      if (prog >= 100) { clearInterval(interval); setTimeout(() => { setUploading(false); setShowMapping(true); }, 300); }
    }, 200);
  };

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Imports</h1>
          <p className="text-sm text-slate-500">Upload and manage financial data imports</p>
        </div>
        <Btn variant="secondary" size="sm"><RefreshCw size={13} />Sync All Sources</Btn>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {["upload", "history", "scheduled"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cx("px-4 py-2 rounded-md text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>{t}</button>
        ))}
      </div>

      {tab === "upload" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="flex flex-col gap-4">
            {!showMapping ? (
              <>
                {/* Drop Zone */}
                <Card padding={false}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cx("transition-all cursor-pointer", dragOver ? "border-blue-500 bg-blue-50" : "border-dashed border-2 hover:border-blue-400")}>
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className={cx("w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                      dragOver ? "bg-blue-100" : "bg-slate-100"
                    )}>
                      <CloudUpload size={28} className={dragOver ? "text-blue-600" : "text-slate-400"} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {dragOver ? "Drop your file here" : "Drag & drop your file here"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Supports CSV, Excel (.xlsx), XML, OFX, QFX</p>
                    {uploading ? (
                      <div className="w-full mt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600">bank_dec_2024.csv</span>
                          <span className="text-xs text-blue-600 font-mono">{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-4">
                        <label className="cursor-pointer">
                          <Btn variant="primary" size="sm" onClick={() => {}}>
                            <FileUp size={13} />Browse Files
                          </Btn>
                        </label>
                        <span className="text-xs text-slate-400">or paste URL</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Quick Connect */}
                <Card padding={false}>
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Connected Sources</h3>
                    <p className="text-xs text-slate-500">Auto-import from connected systems</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {[
                      { name: "SAP S/4HANA ERP", icon: "SAP", status: "active", lastSync: "30 min ago" },
                      { name: "Stripe API", icon: "S", status: "active", lastSync: "1 hr ago" },
                      { name: "JPMorgan Chase", icon: "JPM", status: "syncing", lastSync: "Syncing..." },
                      { name: "QuickBooks Online", icon: "QB", status: "error", lastSync: "Failed 2 hr ago" },
                    ].map(s => (
                      <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-slate-600">{s.icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-800">{s.name}</p>
                          <p className="text-[10px] text-slate-400">{s.lastSync}</p>
                        </div>
                        <StatusBadge status={s.status} />
                        <button className="p-1 hover:bg-slate-100 rounded text-slate-400 ml-1"><RefreshCw size={13} /></button>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              /* Column Mapping */
              <Card padding={false}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Column Mapping</h3>
                    <p className="text-xs text-slate-500">bank_dec_2024.csv · 2,847 rows detected</p>
                  </div>
                  <StatusBadge status="success" />
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {[
                    { file: "Date", system: "Transaction Date" },
                    { file: "Description", system: "Description" },
                    { file: "Amount", system: "Amount (Debit/Credit)" },
                    { file: "Reference", system: "Reference Number" },
                    { file: "Balance", system: "Running Balance" },
                  ].map(col => (
                    <div key={col.file} className="grid grid-cols-2 gap-3 items-center">
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-xs font-medium text-slate-700">{col.file}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Column from file</p>
                      </div>
                      <select className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>{col.system}</option>
                      </select>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Btn variant="secondary" size="sm" onClick={() => setShowMapping(false)} className="flex-1">Cancel</Btn>
                    <Btn variant="primary" size="sm" className="flex-1"><Check size={13} />Confirm & Import</Btn>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-4">
            <Card padding={false}>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">File Preview</h3>
                <span className="text-xs text-slate-400 font-mono">First 5 rows</span>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Date", "Description", "Amount", "Reference", "Balance"].map(h => (
                        <th key={h} className="pb-2 text-left font-semibold text-slate-500 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[
                      ["12/15/24", "STRIPE PAYOUT", "+187,432.50", "STR-PAY-20241215", "2,847,293.50"],
                      ["12/15/24", "AWS CLOUD SERVICES", "-24,750.00", "AWS-INV-1215", "2,659,861.00"],
                      ["12/14/24", "SALESFORCE.COM *SUBSCR", "-18,500.00", "SF-DEC14-8821", "2,684,611.00"],
                      ["12/14/24", "ADP PAYROLL DIRECT DEP", "-342,180.00", "ADP-PAY-DEC1", "2,703,111.00"],
                      ["12/13/24", "WIRE IN GLOBAL TECH", "+95,000.00", "WIRE-GTS-001247", "3,045,291.00"],
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {row.map((cell, j) => (
                          <td key={j} className={cx("py-2 pr-4 font-mono",
                            j === 2 ? (cell.startsWith("+") ? "text-emerald-600" : "text-red-500") : "text-slate-700"
                          )}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Validation Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Rows", value: "2,847", ok: true },
                  { label: "Valid Rows", value: "2,844", ok: true },
                  { label: "Errors", value: "3", ok: false },
                  { label: "Duplicates", value: "0", ok: true },
                  { label: "Date Format", value: "MM/DD/YY", ok: true },
                  { label: "Currency", value: "USD", ok: true },
                ].map(v => (
                  <div key={v.label} className="flex items-center gap-2">
                    {v.ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <AlertCircle size={13} className="text-red-500" />}
                    <span className="text-xs text-slate-600">{v.label}:</span>
                    <span className={cx("text-xs font-semibold font-mono", v.ok ? "text-slate-900" : "text-red-600")}>{v.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "history" && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["File Name", "Source", "Records", "Matched", "Errors", "Size", "Imported At", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {importHistory.map(imp => (
                  <tr key={imp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-800">{imp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-600">{imp.source}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-slate-700">{fmtNumber(imp.records)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-emerald-600">{fmtNumber(imp.matched)}</span>
                        <ProgressBar value={imp.matched} max={imp.records} color={imp.status === "error" ? "red" : "green"} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx("text-xs font-mono font-medium", imp.errors > 0 ? "text-red-600" : "text-slate-400")}>{imp.errors}</span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-500">{imp.size}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-500">{imp.time}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={imp.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><Eye size={13} /></button>
                        <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><Download size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "scheduled" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Scheduled Imports</h3>
            <Btn variant="primary" size="sm"><Plus size={13} />Schedule Import</Btn>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { name: "SAP ERP Daily Sync", freq: "Daily · 02:00 AM UTC", next: "Tomorrow 02:00 AM", status: "active" },
              { name: "Stripe Settlements", freq: "Every 6 hours", next: "In 2 hours", status: "active" },
              { name: "Bank Statement", freq: "Monthly · 1st", next: "Jan 1, 2025", status: "active" },
              { name: "QuickBooks Sync", freq: "Weekly · Monday", next: "Dec 23", status: "inactive" },
            ].map(s => (
              <div key={s.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <Timer size={14} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800">{s.name}</p>
                  <p className="text-[10px] text-slate-500">{s.freq} · Next: {s.next}</p>
                </div>
                <StatusBadge status={s.status} />
                <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><Edit size={13} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Reconciliation Workspace ─────────────────────────────────
function ReconciliationScreen() {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [progress, setProgress] = useState(72);

  const handleMatch = () => {
    if (selectedBank && selectedLedger) {
      setMatched(m => [...m, selectedBank, selectedLedger]);
      setSelectedBank(null);
      setSelectedLedger(null);
      setProgress(p => Math.min(100, p + 5));
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reconciliation Workspace</h1>
          <p className="text-sm text-slate-500">December 2024 · JPMorgan Chase Operating Account</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm"><RotateCcw size={13} />Undo</Btn>
          <Btn variant="secondary" size="sm"><Download size={13} />Export</Btn>
          <Btn variant="success" size="sm"><CheckCircle2 size={13} />Finalize Reconciliation</Btn>
        </div>
      </div>

      {/* Progress Bar */}
      <Card padding={false}>
        <div className="p-4 flex items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">Reconciliation Progress</span>
              <span className="text-xs font-bold text-blue-600 font-mono">{progress}% complete</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-center flex-shrink-0">
            {[
              { label: "Matched", value: "4 / 6", color: "text-emerald-600" },
              { label: "Unmatched", value: "2", color: "text-amber-600" },
              { label: "Exceptions", value: "1", color: "text-red-500" },
            ].map(s => (
              <div key={s.label}>
                <p className={cx("text-base font-bold font-mono", s.color)}>{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Btn variant={selectedBank && selectedLedger ? "primary" : "secondary"} size="sm"
          onClick={handleMatch} disabled={!selectedBank || !selectedLedger}>
          <GitMerge size={13} />Match Selected
        </Btn>
        <Btn variant="secondary" size="sm"><Split size={13} />Split Transaction</Btn>
        <Btn variant="secondary" size="sm"><Merge size={13} />Merge</Btn>
        <Btn variant="secondary" size="sm"><Wand2 size={13} />AI Auto-Match All</Btn>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>All transactions</option><option>Unmatched only</option><option>Exceptions</option>
          </select>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-[1fr_220px_1fr] gap-3">
        {/* Bank Transactions */}
        <Card padding={false} className="overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Landmark size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-slate-800">Bank Transactions</span>
            <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">6 items</span>
          </div>
          <div className="flex flex-col divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
            {bankTxns.map(tx => {
              const isMatched = matched.includes(tx.id);
              const isSelected = selectedBank === tx.id;
              return (
                <button key={tx.id} onClick={() => !isMatched && setSelectedBank(isSelected ? null : tx.id)}
                  disabled={isMatched}
                  className={cx(
                    "flex flex-col gap-1 p-3 text-left transition-all",
                    isMatched ? "opacity-40 bg-emerald-50/50 cursor-not-allowed" :
                    isSelected ? "bg-blue-50 border-l-2 border-blue-500" :
                    "hover:bg-slate-50 cursor-pointer"
                  )}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{tx.date}</span>
                    <span className={cx("text-xs font-bold font-mono", tx.amount > 0 ? "text-emerald-600" : "text-slate-800")}>
                      {tx.amount > 0 ? "+" : ""}{fmtCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-tight">{tx.desc}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{tx.ref}</p>
                  {isMatched && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 font-medium">Matched</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* AI Suggestions Panel */}
        <div className="flex flex-col gap-2">
          <div className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-xl p-3 text-white text-center">
            <Sparkles size={16} className="mx-auto mb-1" />
            <p className="text-xs font-semibold">AI Matching</p>
            <p className="text-[10px] opacity-80 mt-0.5">98.7% confidence</p>
          </div>

          {/* Suggested Matches */}
          {[
            { bankId: "B001", ledgerId: "L001", confidence: 99.8, reason: "Exact amount + same-day" },
            { bankId: "B002", ledgerId: "L002", confidence: 99.1, reason: "Amount match + vendor" },
            { bankId: "B006", ledgerId: "L005", confidence: 97.3, reason: "Amount + date ±1 day" },
          ].map((s, i) => {
            const isApplied = matched.includes(s.bankId);
            return (
              <Card key={i} padding={false} className={cx("overflow-hidden transition-all", isApplied ? "opacity-40" : "")}>
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <div className={cx("w-1.5 h-1.5 rounded-full",
                        s.confidence > 99 ? "bg-emerald-500" : s.confidence > 95 ? "bg-blue-500" : "bg-amber-500"
                      )} />
                      <span className="text-[10px] font-bold font-mono text-slate-700">{s.confidence}%</span>
                    </div>
                    <span className="text-[9px] text-slate-400">AI</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">{s.reason}</p>
                  {!isApplied && (
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => { setMatched(m => [...m, s.bankId, s.ledgerId]); setProgress(p => Math.min(100, p + 5)); }}
                        className="flex-1 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md py-1 font-medium transition-colors flex items-center justify-center gap-0.5">
                        <Check size={9} />Apply
                      </button>
                      <button className="flex-1 text-[10px] bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-md py-1 font-medium transition-colors flex items-center justify-center gap-0.5">
                        <X size={9} />Skip
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-[10px] font-semibold text-amber-700 mb-1">⚠ No Match Found</p>
            <p className="text-[10px] text-amber-600">Wire transfer $95,000 has no ERP counterpart</p>
            <button className="text-[10px] text-amber-700 font-medium underline mt-1">Review manually</button>
          </div>
        </div>

        {/* Ledger Transactions */}
        <Card padding={false} className="overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={14} className="text-purple-600" />
            <span className="text-xs font-semibold text-slate-800">Ledger / ERP Transactions</span>
            <span className="ml-auto text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">6 items</span>
          </div>
          <div className="flex flex-col divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
            {ledgerTxns.map(tx => {
              const isMatched = matched.includes(tx.id);
              const isSelected = selectedLedger === tx.id;
              return (
                <button key={tx.id} onClick={() => !isMatched && setSelectedLedger(isSelected ? null : tx.id)}
                  disabled={isMatched}
                  className={cx(
                    "flex flex-col gap-1 p-3 text-left transition-all",
                    isMatched ? "opacity-40 bg-emerald-50/50 cursor-not-allowed" :
                    isSelected ? "bg-purple-50 border-r-2 border-purple-500" :
                    "hover:bg-slate-50 cursor-pointer"
                  )}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{tx.date}</span>
                    <span className={cx("text-xs font-bold font-mono", tx.amount > 0 ? "text-emerald-600" : "text-slate-800")}>
                      {tx.amount > 0 ? "+" : ""}{fmtCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-tight">{tx.desc}</p>
                  <p className="text-[10px] text-slate-400">{tx.account}</p>
                  {isMatched && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 font-medium">Matched</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Summary Panel */}
      <Card>
        <div className="flex items-center justify-between gap-6">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Bank Closing Balance</p>
            <p className="text-lg font-bold text-slate-900 font-mono">$2,847,293.50</p>
          </div>
          <div className="text-slate-200 text-2xl font-thin">=</div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Opening Balance</p>
            <p className="text-lg font-bold text-slate-900 font-mono">$2,812,000.00</p>
          </div>
          <div className="text-slate-200 text-2xl font-thin">+</div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Deposits</p>
            <p className="text-lg font-bold text-emerald-600 font-mono">+$282,432.50</p>
          </div>
          <div className="text-slate-200 text-2xl font-thin">−</div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Payments</p>
            <p className="text-lg font-bold text-slate-800 font-mono">$247,139.00</p>
          </div>
          <div className="text-slate-200 text-2xl font-thin">=</div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Difference</p>
            <p className="text-lg font-bold text-red-500 font-mono">$5,446.28</p>
          </div>
          <Btn variant="danger" size="sm" className="flex-shrink-0">
            <AlertTriangle size={13} />Review Difference
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Matching Rules ───────────────────────────────────────────
function MatchingRulesScreen() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRule, setSelectedRule] = useState<typeof matchingRules[0] | null>(null);

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Matching Rules</h1>
          <p className="text-sm text-slate-500">Configure automatic transaction matching logic</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm"><Play size={13} />Run Simulator</Btn>
          <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus size={13} />Create Rule</Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Rules", value: "5", icon: <SlidersHorizontal size={14} />, color: "blue" as const },
          { label: "Active Rules", value: "4", icon: <CheckCircle2 size={14} />, color: "green" as const },
          { label: "Total Matches", value: "2,891", icon: <GitMerge size={14} />, color: "purple" as const },
          { label: "Avg Accuracy", value: "97.1%", icon: <Target size={14} />, color: "amber" as const },
        ].map(s => (
          <KpiCard key={s.label} title={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      {showCreate && (
        <Card className="border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Matching Rule</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rule Name" placeholder="e.g. Stripe Settlement Matching" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>1 — Highest</option><option>2</option><option>3</option><option>4</option><option>5 — Lowest</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Conditions</label>
              <div className="flex flex-col gap-2">
                {[
                  { field: "Vendor", operator: "contains", value: "Stripe" },
                  { field: "Amount", operator: "within tolerance", value: "$0.50" },
                ].map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs bg-white focus:outline-none">
                      <option>{c.field}</option>
                    </select>
                    <select className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs bg-white focus:outline-none">
                      <option>{c.operator}</option>
                    </select>
                    <input defaultValue={c.value} className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300 transition-colors"><X size={13} /></button>
                  </div>
                ))}
                <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={12} />Add condition
                </button>
              </div>
            </div>
            <Input label="Amount Tolerance" placeholder="$0.50" icon={<DollarSign size={15} />}
              hint="Maximum allowed amount difference" />
            <Input label="Date Tolerance" placeholder="1 day" icon={<Calendar size={15} />}
              hint="Maximum allowed date difference" />
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <Btn variant="secondary" size="sm" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Btn>
            <Btn variant="secondary" size="sm" className="flex-1"><Play size={13} />Test Rule</Btn>
            <Btn variant="primary" size="sm" onClick={() => setShowCreate(false)} className="flex-1"><Check size={13} />Save Rule</Btn>
          </div>
        </Card>
      )}

      {/* Rules List */}
      <Card padding={false}>
        <div className="divide-y divide-slate-50">
          {matchingRules.map(rule => (
            <div key={rule.id} className={cx("flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer",
              selectedRule?.id === rule.id ? "bg-blue-50" : ""
            )} onClick={() => setSelectedRule(selectedRule?.id === rule.id ? null : rule)}>
              <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-500">#{rule.priority}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                  <StatusBadge status={rule.status} />
                </div>
                <p className="text-xs text-slate-500">{rule.conditions}</p>
              </div>
              <div className="flex items-center gap-6 text-center flex-shrink-0">
                <div>
                  <p className="text-sm font-bold text-slate-900 font-mono">{fmtNumber(parseInt(rule.matches.toString()))}</p>
                  <p className="text-[10px] text-slate-400">matches</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-600 font-mono">{rule.accuracy}</p>
                  <p className="text-[10px] text-slate-400">accuracy</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{rule.tolerance}</p>
                  <p className="text-[10px] text-slate-400">tolerance</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Edit size={13} /></button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Copy size={13} /></button>
                <button className="p-1.5 hover:bg-red-50 hover:text-red-400 rounded-lg text-slate-400 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Bank Accounts ────────────────────────────────────────────
function BankAccountsScreen() {
  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bank Accounts</h1>
          <p className="text-sm text-slate-500">Manage connected financial accounts and sync settings</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm"><FileUp size={13} />Upload Statement</Btn>
          <Btn variant="primary" size="sm"><Plus size={13} />Connect Account</Btn>
        </div>
      </div>

      {/* Total Balance */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">Total Cash Position</p>
            <p className="text-3xl font-bold font-mono">$4,925,193.50</p>
            <p className="text-xs opacity-60 mt-1">Across 4 accounts · USD equivalent</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xl font-bold font-mono">4</p>
              <p className="text-xs opacity-70">Accounts</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-mono text-emerald-300">3</p>
              <p className="text-xs opacity-70">Synced</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-mono text-amber-300">1</p>
              <p className="text-xs opacity-70">Syncing</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {bankAccounts.map(acct => (
          <Card key={acct.id} className="hover:shadow-md transition-shadow" padding={false}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Landmark size={18} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{acct.name}</p>
                    <p className="text-xs text-slate-500">{acct.bank} · {acct.type} · {acct.accountNo}</p>
                  </div>
                </div>
                <StatusBadge status={acct.status} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Current Balance</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono">{fmtCurrency(acct.balance)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{acct.currency} · Last sync: {acct.lastSync}</p>
                </div>
                <div className="flex gap-1">
                  <Btn variant="secondary" size="sm"><RefreshCw size={12} />Sync</Btn>
                  <Btn variant="ghost" size="sm"><MoreHorizontal size={13} /></Btn>
                </div>
              </div>
            </div>
            <div className="px-5 pb-4">
              <ProgressBar value={85} color="blue" showLabel={false} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">42 unmatched transactions</span>
                <span className="text-[10px] text-slate-400">85% matched</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Integrations ─────────────────────────────────────────────
function IntegrationsScreen() {
  const integrations = [
    { name: "SAP S/4HANA", category: "ERP", status: "active", icon: "SAP", desc: "Enterprise resource planning" },
    { name: "Oracle NetSuite", category: "ERP", status: "inactive", icon: "NS", desc: "Cloud ERP solution" },
    { name: "QuickBooks Online", category: "Accounting", status: "active", icon: "QB", desc: "Small business accounting" },
    { name: "Xero", category: "Accounting", status: "inactive", icon: "X", desc: "Online accounting software" },
    { name: "Stripe", category: "Payments", status: "active", icon: "S", desc: "Payment processing" },
    { name: "Square POS", category: "POS", status: "inactive", icon: "SQ", desc: "Point of sale system" },
    { name: "PayPal", category: "Payments", status: "inactive", icon: "PP", desc: "Online payments" },
    { name: "Plaid", category: "Banking", status: "active", icon: "PL", desc: "Bank account connection" },
    { name: "Salesforce", category: "CRM", status: "inactive", icon: "SF", desc: "Customer relationship management" },
    { name: "Workday", category: "HR/Payroll", status: "inactive", icon: "WD", desc: "Human capital management" },
    { name: "ADP", category: "HR/Payroll", status: "active", icon: "ADP", desc: "Payroll services" },
    { name: "AWS S3", category: "Storage", status: "active", icon: "S3", desc: "Cloud file storage" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500">Connect your financial ecosystem</p>
        </div>
        <Btn variant="secondary" size="sm"><Key size={13} />API Keys</Btn>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search integrations..." className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {["All", "ERP", "Accounting", "Payments", "Banking"].map(cat => (
          <button key={cat} className={cx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            cat === "All" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
          )}>{cat}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map(int => (
          <Card key={int.name} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-slate-600">{int.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{int.name}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{int.category}</span>
                </div>
              </div>
              <StatusBadge status={int.status} />
            </div>
            <p className="text-xs text-slate-500 mb-4">{int.desc}</p>
            <Btn variant={int.status === "active" ? "secondary" : "outline"} size="sm" className="w-full">
              {int.status === "active" ? <><Settings size={12} />Configure</> : <><Plus size={12} />Connect</>}
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── AI Assistant ─────────────────────────────────────────────
function AIAssistantScreen() {
  const [messages, setMessages] = useState(aiMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = { id: messages.length + 1, role: "user", content: input, time: "Now" };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, {
        id: m.length + 1, role: "assistant",
        content: "I've analyzed your query. Based on the December 2024 transaction data, I can see a pattern that suggests this may be related to the timing differences in your international wire transfers. Let me run a deeper analysis...\n\n**Recommendation:** Create a matching rule with a 3-day date tolerance and $100 amount tolerance for international wires above $50,000.",
        time: "Now"
      }]);
    }, 1500);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const suggestions = [
    "Why are there unmatched transactions?",
    "Generate Q4 reconciliation summary",
    "Detect anomalies in December",
    "Optimize my matching rules",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Assistant</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Powered by E-Reconcile AI · Trained on your financial data
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Btn variant="secondary" size="sm"><FileBarChart size={13} />Generate Report</Btn>
          <Btn variant="secondary" size="sm"><Trash2 size={13} />Clear Chat</Btn>
        </div>
      </div>

      {/* Chat Area */}
      <Card padding={false} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.map(msg => (
            <div key={msg.id} className={cx("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
              {msg.role === "assistant" ? (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
              ) : (
                <Avatar name="Sarah Chen" size="sm" color="bg-blue-600" />
              )}
              <div className={cx("max-w-[80%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-1")}>
                <div className={cx("rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-sm"
                )}>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('\n').map((line, i) => {
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <strong key={i} className="block font-semibold">{line.slice(2, -2)}</strong>;
                      }
                      if (line.startsWith('• ')) {
                        return <div key={i} className="flex items-start gap-1.5 mt-0.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" /><span>{line.slice(2)}</span></div>;
                      }
                      if (line.startsWith('🔴') || line.startsWith('🟡') || line.startsWith('🟢') || line.startsWith('✅')) {
                        return <div key={i} className="mt-1">{line}</div>;
                      }
                      return <span key={i}>{line}{i < msg.content.split('\n').length - 1 ? ' ' : ''}</span>;
                    })}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 px-1">{msg.time}</span>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 overflow-x-auto">
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="whitespace-nowrap text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 hover:border-blue-300 rounded-full px-3 py-1.5 transition-colors font-medium">
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask about transactions, exceptions, or request analysis..."
              rows={1}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all" />
          </div>
          <Btn variant="primary" size="md" onClick={sendMessage} disabled={!input.trim()}>
            <Send size={15} />
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────
function ReportsScreen() {
  const [activeReport, setActiveReport] = useState("reconciliation");

  const reports = [
    { id: "reconciliation", name: "Reconciliation Summary", icon: <GitMerge size={14} />, desc: "Full period reconciliation status" },
    { id: "exception", name: "Exception Report", icon: <AlertTriangle size={14} />, desc: "All flagged discrepancies" },
    { id: "audit", name: "Audit Report", icon: <ScrollText size={14} />, desc: "Complete audit trail" },
    { id: "import", name: "Import Report", icon: <Upload size={14} />, desc: "Data import history & status" },
    { id: "performance", name: "Performance Dashboard", icon: <BarChart3 size={14} />, desc: "AI & matching metrics" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Generate and export financial reconciliation reports</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm"><Calendar size={13} />Schedule Report</Btn>
          <Btn variant="primary" size="sm"><Download size={13} />Export All</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Report Nav */}
        <div className="flex flex-col gap-1">
          {reports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={cx("flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                activeReport === r.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
              )}>
              <div className={cx("mt-0.5", activeReport === r.id ? "text-blue-600" : "text-slate-400")}>{r.icon}</div>
              <div>
                <p className={cx("text-xs font-semibold", activeReport === r.id ? "text-blue-800" : "text-slate-700")}>{r.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Report Content */}
        <Card className="xl:col-span-3" padding={false}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Reconciliation Summary Report</h3>
              <p className="text-xs text-slate-500">December 1–15, 2024 · Acme Corporation</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm"><FileText size={12} />PDF</Btn>
              <Btn variant="secondary" size="sm"><FileSpreadsheet size={12} />Excel</Btn>
              <Btn variant="primary" size="sm"><Download size={12} />Download</Btn>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Summary Table */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Executive Summary</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Volume", value: "$4,847,293", sub: "12,847 transactions" },
                  { label: "Matched", value: "11,423", sub: "88.9% match rate" },
                  { label: "Net Difference", value: "$5,446.28", sub: "Needs resolution" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-slate-900 font-mono">{s.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Reconciliation Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData.slice(6)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="matched" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Account Breakdown */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">By Account</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Account", "Transactions", "Matched", "Unmatched", "Balance"].map(h => (
                      <th key={h} className="pb-2 text-left font-semibold text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    ["JPMorgan Operating", "2,847", "2,701 (94.9%)", "146", "$2,847,293.50"],
                    ["Bank of America Payroll", "624", "624 (100%)", "0", "$485,720.00"],
                    ["Wells Fargo Savings", "89", "82 (92.1%)", "7", "$1,250,000.00"],
                    ["Citibank International", "312", "278 (89.1%)", "34", "$342,280.00"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {row.map((cell, j) => (
                        <td key={j} className={cx("py-2.5 font-mono",
                          j === 0 ? "text-slate-700 font-sans font-medium" :
                          j === 2 ? "text-emerald-600" :
                          j === 3 ? (parseInt(cell) > 0 ? "text-amber-600" : "text-slate-400") :
                          "text-slate-700"
                        )}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Audit Logs ───────────────────────────────────────────────
function AuditLogsScreen() {
  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500">Complete activity history for compliance and security</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm"><Filter size={13} />Filter</Btn>
          <Btn variant="secondary" size="sm"><Download size={13} />Export Logs</Btn>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search logs..." className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Btn variant="secondary" size="sm"><Calendar size={13} />Last 7 days</Btn>
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All users</option><option>Sarah Chen</option><option>James Wilson</option>
        </select>
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All actions</option><option>Reconciliation</option><option>Import</option><option>User Management</option>
        </select>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["User", "Action", "Resource", "Result", "Timestamp", "IP Address", "Device"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={log.user} size="sm" />
                      <span className="text-xs font-medium text-slate-800">{log.user}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-700">{log.action}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-blue-600">{log.resource}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={log.type} /></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-500">{log.time}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-slate-500">{log.ip}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-400">{log.device}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────
function UsersScreen() {
  const [showInvite, setShowInvite] = useState(false);
  const users = [
    { name: "Sarah Chen", email: "sarah.chen@acmecorp.com", role: "Finance Manager", status: "active", lastActive: "2 min ago", mfa: true },
    { name: "James Wilson", email: "james.wilson@acmecorp.com", role: "Finance Manager", status: "active", lastActive: "1 hr ago", mfa: true },
    { name: "Maria Rodriguez", email: "maria.r@acmecorp.com", role: "Accountant", status: "active", lastActive: "3 hr ago", mfa: false },
    { name: "David Kim", email: "david.kim@acmecorp.com", role: "Auditor", status: "active", lastActive: "Yesterday", mfa: true },
    { name: "Emily Thompson", email: "emily.t@acmecorp.com", role: "Viewer", status: "inactive", lastActive: "1 week ago", mfa: false },
    { name: "Michael Brown", email: "michael.b@acmecorp.com", role: "Accountant", status: "pending", lastActive: "Invited today", mfa: false },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      {showInvite && (
        <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Members">
          <div className="flex flex-col gap-4">
            <Input label="Email addresses" placeholder="colleague@company.com" icon={<Mail size={15} />}
              hint="Separate multiple emails with commas" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Finance Manager</option><option>Accountant</option><option>Auditor</option><option>Viewer</option>
              </select>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
              <Info size={13} className="text-blue-500 mt-0.5" />
              <p className="text-xs text-blue-700">Invited users will receive an email to set up their account.</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" size="md" onClick={() => setShowInvite(false)} className="flex-1">Cancel</Btn>
              <Btn variant="primary" size="md" onClick={() => setShowInvite(false)} className="flex-1"><Send size={13} />Send Invitations</Btn>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage team members and their access</p>
        </div>
        <Btn variant="primary" size="sm" onClick={() => setShowInvite(true)}><Plus size={13} />Invite Users</Btn>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: "6", icon: <Users size={14} />, color: "blue" as const },
          { label: "Active Users", value: "4", icon: <CheckCircle2 size={14} />, color: "green" as const },
          { label: "MFA Enabled", value: "3", icon: <Shield size={14} />, color: "purple" as const },
        ].map(s => <KpiCard key={s.label} title={s.label} value={s.value} icon={s.icon} color={s.color} />)}
      </div>

      <Card padding={false}>
        <div className="divide-y divide-slate-50">
          {users.map(user => (
            <div key={user.email} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
              <Avatar name={user.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">{user.role}</span>
              <StatusBadge status={user.status} />
              <div className="flex items-center gap-1 text-xs">
                {user.mfa ? (
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px] font-medium">
                    <Shield size={9} />MFA On
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-medium">
                    <AlertTriangle size={9} />MFA Off
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 min-w-24 text-right">{user.lastActive}</p>
              <div className="flex gap-1">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Edit size={13} /></button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><MoreHorizontal size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Roles ────────────────────────────────────────────────────
function RolesScreen() {
  const roles = [
    { name: "Admin", users: 1, color: "bg-red-100 text-red-700", perms: [true, true, true, true, true, true, true, true] },
    { name: "Finance Manager", users: 2, color: "bg-blue-100 text-blue-700", perms: [true, true, true, true, true, false, true, false] },
    { name: "Accountant", users: 2, color: "bg-purple-100 text-purple-700", perms: [true, true, true, false, true, false, false, false] },
    { name: "Auditor", users: 1, color: "bg-amber-100 text-amber-700", perms: [true, false, false, false, true, false, false, false] },
    { name: "Viewer", users: 1, color: "bg-slate-100 text-slate-600", perms: [true, false, false, false, false, false, false, false] },
  ];

  const permissions = ["View Transactions", "Edit Transactions", "Run Reconciliation", "Approve Recon.", "View Reports", "Manage Rules", "Manage Users", "Billing Access"];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roles & Permissions</h1>
          <p className="text-sm text-slate-500">Define access control for your team</p>
        </div>
        <Btn variant="primary" size="sm"><Plus size={13} />Create Custom Role</Btn>
      </div>

      <Card padding={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 min-w-40">Permission</th>
              {roles.map(r => (
                <th key={r.name} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cx("px-2 py-0.5 rounded-full text-[10px] font-semibold", r.color)}>{r.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{r.users} user{r.users !== 1 ? "s" : ""}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {permissions.map((perm, pi) => (
              <tr key={perm} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-xs font-medium text-slate-700 sticky left-0 bg-white">{perm}</td>
                {roles.map(role => (
                  <td key={role.name} className="px-4 py-3 text-center">
                    {role.perms[pi] ? (
                      <CheckCircle2 size={15} className="text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle size={15} className="text-slate-200 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────
function SettingsScreen() {
  const [tab, setTab] = useState("organization");

  const tabs = [
    { id: "organization", label: "Organization", icon: <Building size={13} /> },
    { id: "security", label: "Security", icon: <Shield size={13} /> },
    { id: "api", label: "API Keys", icon: <Key size={13} /> },
    { id: "webhooks", label: "Webhooks", icon: <Webhook size={13} /> },
    { id: "sessions", label: "Sessions", icon: <Smartphone size={13} /> },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your organization preferences and security</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx("flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>{t.icon}{t.label}</button>
        ))}
      </div>

      {tab === "organization" && (
        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-4">Organization Profile</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">AC</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Acme Corporation</p>
                <p className="text-xs text-slate-500 mt-0.5">acme-corp · Professional Plan</p>
                <Btn variant="secondary" size="sm" className="mt-2"><Upload size={12} />Upload Logo</Btn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Company Name" value="Acme Corporation" />
              <Input label="Legal Name" value="Acme Corporation, Inc." />
              <Input label="Tax ID (EIN)" value="47-1234567" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Country</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>United States</option>
                </select>
              </div>
              <Input label="Base Currency" value="USD — US Dollar" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Fiscal Year Start</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>January</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Btn variant="primary" size="sm"><Check size={13} />Save Changes</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Password Policy</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: "Minimum password length", value: "12 characters" },
                { label: "Require uppercase letters", value: "Enabled" },
                { label: "Require numbers & symbols", value: "Enabled" },
                { label: "Password expiry", value: "90 days" },
                { label: "Password history", value: "Last 5 passwords" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{s.value}</span>
                    <button className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Multi-Factor Authentication</h3>
              <StatusBadge status="active" />
            </div>
            <div className="flex flex-col gap-3">
              {[
                { method: "Authenticator App (TOTP)", desc: "Google Authenticator, Authy", enabled: true },
                { method: "SMS / Phone", desc: "Text message verification", enabled: false },
                { method: "Email OTP", desc: "One-time code via email", enabled: true },
                { method: "Hardware Key (FIDO2)", desc: "YubiKey, Touch ID", enabled: false },
              ].map(m => (
                <div key={m.method} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.method}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                  </div>
                  <div className={cx("relative inline-flex w-10 h-5.5 rounded-full transition-colors cursor-pointer",
                    m.enabled ? "bg-blue-600" : "bg-slate-200"
                  )}>
                    <span className={cx("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      m.enabled ? "translate-x-4.5" : "translate-x-0"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "api" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">API Keys</h3>
            <Btn variant="primary" size="sm"><Plus size={13} />Generate Key</Btn>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { name: "Production API Key", key: "sk_live_•••••••••••••••••••••••••••efg8", created: "Dec 1, 2024", lastUsed: "2 min ago" },
              { name: "Test API Key", key: "sk_test_•••••••••••••••••••••••••••xyz1", created: "Nov 15, 2024", lastUsed: "1 day ago" },
              { name: "Webhook Signing Secret", key: "whsec_•••••••••••••••••••••••••••abc2", created: "Nov 1, 2024", lastUsed: "5 min ago" },
            ].map(k => (
              <div key={k.name} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-800">{k.name}</p>
                  <div className="flex gap-1">
                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><Copy size={12} /></button>
                    <button className="p-1 hover:bg-red-50 hover:text-red-400 rounded text-slate-400"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-xs font-mono text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">{k.key}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[10px] text-slate-400">Created {k.created}</span>
                  <span className="text-[10px] text-slate-400">Last used {k.lastUsed}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "webhooks" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Webhooks</h3>
            <Btn variant="primary" size="sm"><Plus size={13} />Add Endpoint</Btn>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { url: "https://api.acme.com/webhooks/reconcile", events: "reconciliation.completed, exception.created", status: "active" },
              { url: "https://erp.acme.com/hooks/match", events: "transaction.matched, transaction.unmatched", status: "active" },
            ].map(w => (
              <div key={w.url} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-mono font-semibold text-blue-600">{w.url}</p>
                  <StatusBadge status={w.status} />
                </div>
                <p className="text-[10px] text-slate-500">{w.events}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "sessions" && (
        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-4">Active Sessions</h3>
          <div className="flex flex-col gap-3">
            {[
              { device: "MacBook Pro · Chrome 120", ip: "192.168.1.42", location: "San Francisco, CA", current: true, lastActive: "Active now" },
              { device: "iPhone 15 · Safari", ip: "10.0.0.15", location: "San Francisco, CA", current: false, lastActive: "1 hour ago" },
              { device: "Windows PC · Firefox 121", ip: "172.16.0.8", location: "New York, NY", current: false, lastActive: "Yesterday" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Smartphone size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-800">{s.device}</p>
                    {s.current && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                  </div>
                  <p className="text-[10px] text-slate-400">{s.ip} · {s.location} · {s.lastActive}</p>
                </div>
                {!s.current && (
                  <button className="text-xs text-red-600 hover:underline font-medium">Revoke</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Btn variant="danger" size="sm" className="w-full">
              <LogOut size={13} />Sign Out All Other Sessions
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────
function BillingScreen() {
  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500">Manage your subscription and payment details</p>
        </div>
        <Btn variant="primary" size="sm"><Zap size={13} />Upgrade Plan</Btn>
      </div>

      {/* Current Plan */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">Professional Plan</span>
            </div>
            <p className="text-2xl font-bold mt-2">$149 <span className="text-base font-normal opacity-80">/month</span></p>
            <p className="text-sm opacity-70 mt-1">Billed monthly · Renews Jan 1, 2025</p>
          </div>
          <div className="text-right">
            <div className="flex gap-4 text-center">
              {[
                { label: "Transactions", used: "12,847", limit: "50,000", pct: 26 },
                { label: "Team Members", used: "6", limit: "10", pct: 60 },
              ].map(u => (
                <div key={u.label}>
                  <p className="text-xs opacity-70 mb-1">{u.label}</p>
                  <p className="text-sm font-bold">{u.used} <span className="opacity-60 font-normal text-xs">/ {u.limit}</span></p>
                  <div className="w-24 h-1.5 bg-white/20 rounded-full mt-1">
                    <div className="h-full bg-white rounded-full" style={{ width: `${u.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Payment Method */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Payment Method</h3>
            <Btn variant="ghost" size="sm"><Plus size={12} />Add</Btn>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-10 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">VISA</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Visa ending in 4242</p>
              <p className="text-[10px] text-slate-400">Expires 03/2027 · Default</p>
            </div>
            <span className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">Default</span>
          </div>
        </Card>

        {/* Next Invoice */}
        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-4">Next Invoice</h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900 font-mono">$149.00</p>
              <p className="text-xs text-slate-500 mt-0.5">Due January 1, 2025</p>
            </div>
            <Btn variant="secondary" size="sm"><Download size={12} />Preview</Btn>
          </div>
        </Card>
      </div>

      {/* Invoice History */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Invoice History</h3>
          <Btn variant="ghost" size="sm"><Download size={12} />Download All</Btn>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { date: "Dec 1, 2024", amount: "$149.00", status: "paid", inv: "INV-2024-012" },
            { date: "Nov 1, 2024", amount: "$149.00", status: "paid", inv: "INV-2024-011" },
            { date: "Oct 1, 2024", amount: "$149.00", status: "paid", inv: "INV-2024-010" },
            { date: "Sep 1, 2024", amount: "$149.00", status: "paid", inv: "INV-2024-009" },
          ].map(inv => (
            <div key={inv.inv} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={14} className="text-slate-400" />
                <div>
                  <p className="text-xs font-medium text-slate-800">{inv.inv}</p>
                  <p className="text-[10px] text-slate-400">{inv.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-900 font-mono">{inv.amount}</span>
                <StatusBadge status={inv.status} />
                <button className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded"><Download size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────
function NotificationsScreen() {
  const [filter, setFilter] = useState("all");

  const notifs = [
    { id: 1, title: "Reconciliation completed", body: "December 2024 bank reconciliation completed with 88.9% match rate.", time: "2 min ago", type: "success", read: false },
    { id: 2, title: "4 exceptions require review", body: "New exceptions flagged in JPMorgan Chase account. Immediate review recommended.", time: "18 min ago", type: "warning", read: false },
    { id: 3, title: "SAP ERP sync failed", body: "Scheduled sync failed due to authentication timeout. Retrying automatically.", time: "1 hr ago", type: "error", read: false },
    { id: 4, title: "New team member invited", body: "michael.brown@acmecorp.com has been invited as Accountant.", time: "3 hr ago", type: "info", read: false },
    { id: 5, title: "Matching rule created", body: "Rule MR-2024-087 (Salesforce Mapping) created and activated successfully.", time: "5 hr ago", type: "success", read: true },
    { id: 6, title: "Monthly report ready", body: "November 2024 reconciliation report is ready to download.", time: "Yesterday", type: "info", read: true },
    { id: 7, title: "Stripe rate limit warning", body: "Approaching Stripe API rate limit. Consider upgrading your Stripe plan.", time: "2 days ago", type: "warning", read: true },
    { id: 8, title: "Backup completed", body: "Automated backup of all reconciliation data completed successfully.", time: "3 days ago", type: "success", read: true },
  ];

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle2 size={16} className="text-emerald-500" />,
    warning: <AlertTriangle size={16} className="text-amber-500" />,
    error: <XCircle size={16} className="text-red-500" />,
    info: <Info size={16} className="text-blue-500" />,
  };

  const filtered = filter === "all" ? notifs : filter === "unread" ? notifs.filter(n => !n.read) : notifs.filter(n => n.type === filter);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("notifications.title")}</h1>
          <p className="text-sm text-slate-500">{t("notifications.unreadCount", { count: notifs.filter(n => !n.read).length })}</p>
        </div>
        <Btn variant="secondary" size="sm"><Check size={13} />{t("actions.markAllRead")}</Btn>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {["all", "unread", "success", "warning", "error", "info"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cx("px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>{t(`notifications.filters.${f}`)}</button>
        ))}
      </div>

      <Card padding={false}>
        <div className="divide-y divide-slate-50">
          {filtered.map(n => (
            <div key={n.id} className={cx("flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer", !n.read ? "bg-blue-50/30" : "")}>
              <div className="mt-0.5 flex-shrink-0">{icons[n.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
              </div>
              <button className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-500 flex-shrink-0"><X size={13} /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Help ─────────────────────────────────────────────────────
function HelpScreen() {
  const articles = [
    { title: "Getting started with E-Reconcile MN", category: "Onboarding", reads: "2.4k" },
    { title: "How AI matching works", category: "AI Features", reads: "1.8k" },
    { title: "Importing transactions from SAP", category: "Integrations", reads: "1.2k" },
    { title: "Creating custom matching rules", category: "Reconciliation", reads: "987" },
    { title: "Setting up bank connections via Plaid", category: "Bank Accounts", reads: "842" },
    { title: "Understanding exception reports", category: "Reports", reads: "756" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Help Center</h1>
        <p className="text-sm text-slate-500">Documentation, tutorials, and support</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search documentation..."
          className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { icon: <BookOpen size={18} />, label: "Documentation", desc: "Full guides & references", color: "bg-blue-50 text-blue-600" },
          { icon: <Video size={18} />, label: "Video Tutorials", desc: "Step-by-step walkthroughs", color: "bg-purple-50 text-purple-600" },
          { icon: <MessageSquare size={18} />, label: "Live Chat", desc: "Chat with support", color: "bg-emerald-50 text-emerald-600" },
          { icon: <LifeBuoy size={18} />, label: "Submit Ticket", desc: "Email support team", color: "bg-amber-50 text-amber-600" },
        ].map(c => (
          <button key={c.label} className="flex flex-col items-center text-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className={cx("p-3 rounded-xl", c.color)}>{c.icon}</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{c.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Popular Articles</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {articles.map(a => (
            <div key={a.title} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
              <FileText size={14} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 hover:text-blue-600">{a.title}</p>
                <p className="text-xs text-slate-400">{a.category}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Eye size={11} />{a.reads}
              </div>
              <ChevronRight size={13} className="text-slate-300" />
            </div>
          ))}
        </div>
      </Card>

      {/* Release Notes */}
      <Card>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Latest Release Notes</h3>
        <div className="flex flex-col gap-3">
          {[
            { version: "v2.4.0", date: "Dec 10, 2024", notes: "AI matching accuracy improved to 98.7%; added Xero integration; new exception dashboard" },
            { version: "v2.3.1", date: "Nov 25, 2024", notes: "Bug fix: CSV import date parsing; performance improvements for large imports" },
            { version: "v2.3.0", date: "Nov 15, 2024", notes: "New reconciliation workspace redesign; bulk matching actions; Plaid v2 upgrade" },
          ].map(r => (
            <div key={r.version} className="flex gap-3 pb-3 border-b border-slate-50 last:border-0">
              <span className="text-[10px] font-bold font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded-lg flex-shrink-0 h-fit">{r.version}</span>
              <div>
                <p className="text-xs font-medium text-slate-800">{r.date}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Error Screens ────────────────────────────────────────────
function ErrorScreen({ code, title, desc, onNavigate }: {
  code: string; title: string; desc: string; onNavigate: (v: View) => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    "403": <ShieldAlert size={48} className="text-amber-400" />,
    "404": <FolderOpen size={48} className="text-slate-300" />,
    "500": <ServerCrash size={48} className="text-red-400" />,
    "maintenance": <Loader2 size={48} className="text-blue-400 animate-spin" />,
    "offline": <WifiOff size={48} className="text-slate-400" />,
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-24 h-24 bg-white rounded-3xl shadow-md flex items-center justify-center mx-auto mb-6">
          {icons[code]}
        </div>
        <div className="text-5xl font-black text-slate-200 font-mono mb-3">{code.startsWith("4") || code.startsWith("5") ? code : ""}</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-600 text-sm mb-8">{desc}</p>
        <div className="flex gap-3 justify-center">
          <Btn variant="primary" size="md" onClick={() => onNavigate("dashboard")}>
            <LayoutDashboard size={15} />{t("actions.backToDashboard")}
          </Btn>
          <Btn variant="secondary" size="md" onClick={() => window.location.reload()}>
            <RefreshCw size={15} />{t("actions.tryAgain")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────
function MainLayout({ children, currentView, onNavigate }: {
  children: React.ReactNode; currentView: View; onNavigate: (v: View) => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar current={currentView} onChange={onNavigate} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onNavigate={onNavigate} sidebarCollapsed={sidebarCollapsed} onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        {/* Breadcrumb */}
        <div className="px-6 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5">
          <span className="text-xs text-slate-400">{t("app.name")}</span>
          <ChevronRight size={11} className="text-slate-300" />
          <span className="text-xs text-slate-600 font-medium capitalize">{currentView.replace(/-/g, " ")}</span>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>("login");

  const navigate = useCallback((v: View) => setView(v), []);

  // Auth-only views
  const authViews: View[] = ["login", "register", "forgot-password", "reset-password", "email-verification", "mfa", "session-expired", "accept-invitation"];
  const onboardingViews: View[] = ["onboarding"];
  const errorViews: View[] = ["403", "404", "500", "maintenance", "offline"];

  if (authViews.includes(view)) {
    return (
      <>
        {view === "login" && <LoginScreen onNavigate={navigate} />}
        {view === "register" && <RegisterScreen onNavigate={navigate} />}
        {view === "forgot-password" && <ForgotPasswordScreen onNavigate={navigate} />}
        {view === "reset-password" && <ForgotPasswordScreen onNavigate={navigate} />}
        {view === "email-verification" && (
          <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code sent to your inbox">
            <div className="flex flex-col gap-5 items-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Mail size={24} className="text-blue-600" />
              </div>
              <p className="text-xs text-slate-600 text-center">We sent a verification code to <strong>sarah.chen@acmecorp.com</strong></p>
              <MFAScreen onNavigate={() => navigate("onboarding")} />
            </div>
          </AuthLayout>
        )}
        {view === "mfa" && <MFAScreen onNavigate={navigate} />}
        {view === "session-expired" && <SessionExpiredScreen onNavigate={navigate} />}
        {view === "accept-invitation" && <AcceptInvitationScreen onNavigate={navigate} />}
      </>
    );
  }

  if (onboardingViews.includes(view)) {
    return <OnboardingScreen onNavigate={navigate} />;
  }

  if (errorViews.includes(view)) {
    const errorConfig: Record<string, { title: string; desc: string }> = {
      "403": { title: t("errors.403.title"), desc: t("errors.403.description") },
      "404": { title: t("errors.404.title"), desc: t("errors.404.description") },
      "500": { title: t("errors.500.title"), desc: t("errors.500.description") },
      "maintenance": { title: t("errors.maintenance.title"), desc: t("errors.maintenance.description") },
      "offline": { title: t("errors.offline.title"), desc: t("errors.offline.description") },
    };
    const cfg = errorConfig[view] || errorConfig["404"];
    return <ErrorScreen code={view} title={cfg.title} desc={cfg.desc} onNavigate={navigate} />;
  }

  const screenMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardScreen onNavigate={navigate} />,
    transactions: <TransactionsScreen />,
    reconciliation: <ReconciliationScreen />,
    imports: <ImportsScreen />,
    "matching-rules": <MatchingRulesScreen />,
    "bank-accounts": <BankAccountsScreen />,
    integrations: <IntegrationsScreen />,
    "ai-assistant": <AIAssistantScreen />,
    reports: <ReportsScreen />,
    "audit-logs": <AuditLogsScreen />,
    notifications: <NotificationsScreen />,
    users: <UsersScreen />,
    roles: <RolesScreen />,
    settings: <SettingsScreen />,
    billing: <BillingScreen />,
    help: <HelpScreen />,
  };

  return (
    <MainLayout currentView={view} onNavigate={navigate}>
      {screenMap[view] || (
        <EmptyState icon={<FolderOpen size={32} />} title={t("system.screenNotFound")}
          desc={t("system.screenNotImplemented")} action={<Btn variant="primary" size="sm" onClick={() => navigate("dashboard")}>{t("actions.backToDashboard")}</Btn>} />
      )}
      {/* Demo Error Navigation */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("system.errorPages")}</p>
          {(["403", "404", "500", "maintenance", "offline"] as View[]).map(e => (
            <button key={e} onClick={() => navigate(e)} className="text-[10px] text-blue-600 hover:underline text-left font-mono">
              {t("system.view", { name: e })}
            </button>
          ))}
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{t("system.authPages")}</p>
          {(["login", "register", "mfa", "session-expired"] as View[]).map(e => (
            <button key={e} onClick={() => navigate(e)} className="text-[10px] text-blue-600 hover:underline text-left">
              {e}
            </button>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
