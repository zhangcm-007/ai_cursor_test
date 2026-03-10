import { Layout, Typography } from "antd";
import { Outlet, useNavigate, useLocation, Routes, Route } from "react-router-dom";
import {
  DashboardOutlined,
  FileTextOutlined,
  AimOutlined,
  UnorderedListOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import Dashboard from "./pages/Dashboard";
import RequirementList from "./pages/RequirementList";
import RequirementDetail from "./pages/RequirementDetail";
import TestPointList from "./pages/TestPointList";
import TestPointDetail from "./pages/TestPointDetail";
import TestCaseList from "./pages/TestCaseList";
import TestCaseDetail from "./pages/TestCaseDetail";
import ExportPage from "./pages/ExportPage";

const { Header, Content } = Layout;

const navItems = [
  { key: "/", icon: DashboardOutlined, label: "首页" },
  { key: "/requirements", icon: FileTextOutlined, label: "需求" },
  { key: "/test-points", icon: AimOutlined, label: "测试点" },
  { key: "/test-cases", icon: UnorderedListOutlined, label: "测试用例" },
  { key: "/export", icon: ExportOutlined, label: "导出" },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentKey = location.pathname === "/" ? "/" : "/" + (location.pathname.split("/")[1] || "");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          background: "#001529",
          gap: 0,
        }}
      >
        <Typography.Title level={5} style={{ margin: 0, color: "#fff", marginRight: 32 }}>
          测试平台
        </Typography.Title>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {navItems.map(({ key, icon: Icon, label }) => {
            const isActive = currentKey === key;
            return (
              <div
                key={key}
                onClick={() => navigate(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 16px",
                  height: 64,
                  lineHeight: "64px",
                  color: "#fff",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon style={{ fontSize: 16 }} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </Header>
      <Content style={{ padding: 24, background: "#f0f2f5", minHeight: "calc(100vh - 64px)" }}>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, minHeight: "100%" }}>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="requirements" element={<RequirementList />} />
        <Route path="requirements/:id" element={<RequirementDetail />} />
        <Route path="test-points" element={<TestPointList />} />
        <Route path="test-points/:id" element={<TestPointDetail />} />
        <Route path="test-cases" element={<TestCaseList />} />
        <Route path="test-cases/:id" element={<TestCaseDetail />} />
        <Route path="export" element={<ExportPage />} />
      </Route>
    </Routes>
  );
}
