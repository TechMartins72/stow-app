"use client";

import { useToast } from "@/app/_components/toaster";

export function CopyButton({ text, label = "Copy address", what = "Address" }: { text: string; label?: string; what?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ tone: "success", title: `${what} copied` });
        } catch {
          toast({ tone: "error", title: "Couldn't copy", body: "Select the address on screen and copy it instead." });
        }
      }}
      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
    >
      {label}
    </button>
  );
}
