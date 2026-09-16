import React from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  Shield,
} from "lucide-react";

const Footer = () => {
  const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || "+91 98765 43210";
  const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "support@kalnaliquor.com";

  const socialLinks = [
    { Icon: Facebook, url: "#", label: "Facebook" },
    { Icon: Twitter, url: "#", label: "Twitter" },
    { Icon: Instagram, url: "#", label: "Instagram" },
    { Icon: Linkedin, url: "#", label: "LinkedIn" },
  ];

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* ── Grid ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-1">
              <span className="text-2xl font-bold tracking-tight text-gray-800">
                Kalna<span className="text-orange-500">Liquor</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 animate-pulse" />
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Licensed liquor delivery in Kalna, West Bengal. Order premium spirits, wine, and beer from verified shops near you — delivered discreetly to your doorstep.
            </p>
            <div className="flex gap-2 pt-1">
              {socialLinks.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-all"
                  aria-label={item.label}
                >
                  <item.Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-5">Quick Links</h3>
            <ul className="space-y-3">
              {[
                { name: "Home", path: "/" },
                { name: "All Shops", path: "/#shops" },
                { name: "About Us", path: "/about" },
                { name: "Contact", path: "/contact" },
                { name: "FAQ", path: "/page/faq" },
              ].map((item) => (
                <li key={item.name}>
                  <Link to={item.path} className="text-sm text-gray-500 hover:text-orange-500 transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-5">Policies</h3>
            <ul className="space-y-3">
              {[
                { name: "Terms of Service", path: "/page/terms" },
                { name: "Privacy Policy", path: "/page/privacy" },
                { name: "Cookie Policy", path: "/page/cookie" },
                { name: "Age Verification", path: "/page/age-verification" },
                { name: "Return Policy", path: "/page/returns" },
              ].map((item) => (
                <li key={item.name}>
                  <Link to={item.path} className="text-sm text-gray-500 hover:text-orange-500 transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-5">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-gray-500">
                <MapPin size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <span>Kalna, Purba Bardhaman,<br />West Bengal, India</span>
              </li>
              <li>
                <a href={`tel:${SUPPORT_PHONE}`} className="flex items-center gap-3 text-sm text-gray-500 hover:text-orange-500 transition-colors">
                  <Phone size={16} className="text-orange-500 shrink-0" />
                  {SUPPORT_PHONE}
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 text-sm text-gray-500 hover:text-orange-500 transition-colors">
                  <Mail size={16} className="text-orange-500 shrink-0" />
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Age notice ──────────────────────────────── */}
        <div className="mt-10 p-4 rounded-xl bg-white border border-gray-200 flex items-center gap-3 text-sm text-gray-500">
          <Shield size={20} className="text-orange-500 shrink-0" />
          <p>
            <strong className="text-gray-800">21+ Only.</strong> All orders require valid age verification upon delivery. 
            By using this website, you confirm that you are of legal drinking age in India.
          </p>
        </div>

        {/* ── Bottom bar ──────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Kalna Liquor. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Secured by <Shield size={11} className="text-orange-500" /> Razorpay
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;