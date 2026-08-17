import React from "react";
import ReactDOM from "react-dom/client";
import { PetRenderer } from "./PetRenderer";
import "./pet.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PetRenderer />
  </React.StrictMode>,
);
