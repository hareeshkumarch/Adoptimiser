import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@radix-ui/colors/slate.css";
import "@radix-ui/colors/iris.css";
import "@radix-ui/colors/jade.css";
import "@radix-ui/colors/amber.css";
import "@radix-ui/colors/ruby.css";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
