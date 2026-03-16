import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "react-query";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";
import zhCN from "antd/es/locale/zh_CN";
import "./global.css";
import App from "./App";

const queryClient = new QueryClient();

/** 深色科技风：深色底 + 靛紫主色（按钮/链接/高亮） */
const theme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#6366f1",
    colorPrimaryHover: "#818cf8",
    colorPrimaryActive: "#4f46e5",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#6366f1",
    colorBgLayout: "#0f172a",
    colorBgContainer: "#1e293b",
    colorBorder: "rgba(255,255,255,0.14)",
    colorBorderSecondary: "rgba(255,255,255,0.12)",
    colorText: "#f1f5f9",
    colorTextSecondary: "#cbd5e1",
    borderRadius: 6,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    lineHeight: 1.5715,
  },
  components: {
    Menu: {
      darkItemBg: "transparent",
      darkSubMenuItemBg: "transparent",
      darkItemSelectedBg: "rgba(99,102,241,0.2)",
      darkItemSelectedColor: "#a5b4fc",
      darkItemHoverColor: "#c7d2fe",
      darkItemColor: "rgba(255,255,255,0.88)",
    },
    Card: {
      headerBg: "transparent",
    },
    Table: {
      headerBg: "#1e293b",
      headerColor: "#cbd5e1",
      colorBorderSecondary: "rgba(255,255,255,0.12)",
    },
    Button: {
      primaryShadow: "0 0 0 2px rgba(99,102,241,0.3)",
    },
  },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider locale={zhCN} theme={theme}>
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
