import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryHud } from "./components/hud/MemoryHud";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Memory UI root element is missing");

createRoot(root).render(
  <StrictMode>
    <MemoryHud />
  </StrictMode>,
);
