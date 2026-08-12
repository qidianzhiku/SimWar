import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesignSystemLab } from "../src/index";
import "../src/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("root element not found");
}

createRoot(root).render(
  <StrictMode>
    <DesignSystemLab />
  </StrictMode>
);
