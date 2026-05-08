import React, { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Play, Square, Loader2 } from "lucide-react";

interface UrlFormProps {
  onStart: (url: string) => void;
  onCancel: () => void;
  isCreating: boolean;
  isRunning: boolean;
  isCancelling: boolean;
}

export function UrlForm({ onStart, onCancel, isCreating, isRunning, isCancelling }: UrlFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    try {
      const parsed = new URL(url.includes("://") ? url : `https://${url}`);
      onStart(parsed.toString());
    } catch (err) {
      setError("Please enter a valid URL (e.g., https://example.com)");
    }
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit} 
      className="w-full relative z-10"
    >
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        <div className="relative flex-1 group">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-focus-within:bg-primary/30 transition-all duration-500 opacity-50" />
          <div className="relative flex items-center glass-panel rounded-2xl px-4 py-1 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
            <Globe className="w-6 h-6 text-muted-foreground mr-3" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isRunning || isCreating}
              placeholder="https://example.com"
              className="w-full bg-transparent border-none py-4 text-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 disabled:opacity-50 font-mono"
            />
          </div>
        </div>

        {!isRunning ? (
          <button
            type="submit"
            disabled={isCreating || !url.trim()}
            className="group relative px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 overflow-hidden flex items-center justify-center min-w-[160px]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700" />
            {isCreating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 fill-current" />
                Start Job
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="group relative px-8 py-4 bg-destructive text-destructive-foreground font-semibold rounded-2xl shadow-lg shadow-destructive/25 hover:shadow-destructive/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center min-w-[160px]"
          >
            {isCancelling
              ? <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              : <Square className="w-5 h-5 mr-2 fill-current" />
            }
            Cancel
          </button>
        )}
      </div>
      
      <p className="mt-3 px-2 text-xs text-muted-foreground/50">
        Works best on sites you own or control. Sites with bot protection (like Amazon or Google) may return partial results.
      </p>

      <div className="h-6 mt-1 px-2">
        {error && (
          <motion.p 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="text-destructive font-medium text-sm"
          >
            {error}
          </motion.p>
        )}
      </div>
    </motion.form>
  );
}
