import React from "react";
import "@/App.css";
import "@/index.css";
import VibeCheck from "@/pages/VibeCheck";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App min-h-screen grain bg-[#0f0f0f] text-[#f5f1e8]">
      <VibeCheck />
      <Toaster theme="dark" position="top-center" />
    </div>
  );
}

export default App;
