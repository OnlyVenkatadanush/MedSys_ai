import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Stethoscope, User, MessageSquare, FileStack, Pill, Calendar, Command } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  category: "Patients" | "Tools" | "Navigation";
  icon: any;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const items: CommandItem[] = [
    {
      id: "p1",
      label: "John Doe (Patient ID: pat_01)",
      category: "Patients",
      icon: User,
      action: () => navigate("/doctor/patient/pat_01"),
    },
    {
      id: "p2",
      label: "Emma Watson (Patient ID: pat_02)",
      category: "Patients",
      icon: User,
      action: () => navigate("/doctor/patient/pat_02"),
    },
    {
      id: "p3",
      label: "Robert Chen (Patient ID: pat_03)",
      category: "Patients",
      icon: User,
      action: () => navigate("/doctor/patient/pat_03"),
    },
    {
      id: "n1",
      label: "Doctor Command Center",
      category: "Navigation",
      icon: Stethoscope,
      action: () => navigate("/doctor/dashboard"),
    },
    {
      id: "n2",
      label: "My Patients Directory",
      category: "Navigation",
      icon: User,
      action: () => navigate("/doctor/patients"),
    },
    {
      id: "t1",
      label: "Clinical Copilot Assistant",
      category: "Tools",
      icon: MessageSquare,
      action: () => navigate("/doctor/copilot"),
    },
    {
      id: "t2",
      label: "Appointments Schedule",
      category: "Tools",
      icon: Calendar,
      action: () => navigate("/appointments"),
    },
  ];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-ink/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-2xl border border-hairline bg-surface-card shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 bg-bg-mist">
          <Search className="h-5 w-5 text-stone" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients, tools, or commands... (Press ESC to close)"
            className="flex-1 bg-transparent text-sm text-ink placeholder-stone focus:outline-none"
          />
          <kbd className="hidden sm:inline-block font-mono text-[10px] bg-surface-card border border-hairline px-2 py-0.5 rounded text-stone">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-bg-mist text-left transition-colors font-medium text-sm text-ink"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-teal-deep" />
                  <span>{item.label}</span>
                </div>
                <span className="font-mono text-[10px] uppercase text-stone bg-surface-card border border-hairline px-2 py-0.5 rounded-full">
                  {item.category}
                </span>
              </button>
            ))
          ) : (
            <div className="p-6 text-center font-mono text-xs text-stone">No matching results found.</div>
          )}
        </div>
      </div>
    </div>
  );
};
