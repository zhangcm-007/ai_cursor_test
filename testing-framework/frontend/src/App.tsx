import { Layout, Menu, Typography } from "antd";
import { Outlet, useNavigate, useLocation, Routes, Route } from "react-router-dom";
import {
  DashboardOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import Dashboard from "./pages/Dashboard";
import RequirementList from "./pages/RequirementList";
import RequirementDetail from "./pages/RequirementDetail";
import TestCaseList from "./pages/TestCaseList";
import TestCaseDetail from "./pages/TestCaseDetail";
import ExportPage from "./pages/ExportPage";

const { Sider, Content } = Layout;

const navItems = [
  { key: "/", icon: DashboardOutlined, label: "首页" },
  { key: "/requirements", icon: FileTextOutlined, label: "需求" },
  { key: "/test-cases", icon: UnorderedListOutlined, label: "测试用例" },
  { key: "/export", icon: ExportOutlined, label: "导出" },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentKey = location.pathname === "/" ? "/" : "/" + (location.pathname.split("/")[1] || "");

  const menuItems = navItems.map(({ key, icon: Icon, label }) => ({
    key,
    icon: <Icon />,
    label,
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={220}
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: "4px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", paddingLeft: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Typography.Title level={5} style={{ margin: 0, color: "#f8fafc", fontWeight: 600, letterSpacing: "0.02em" }}>
            测试平台
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Content style={{ padding: 28, background: "#0f172a", minHeight: "100vh" }}>
          <div className="app-content-inner" style={{ background: "#1e293b", padding: 28, borderRadius: 12, minHeight: "100%", border: "1px solid rgba(255,255,255,0.14)" }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
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
        <Route path="test-cases" element={<TestCaseList />} />
        <Route path="test-cases/:id" element={<TestCaseDetail />} />
        <Route path="export" element={<ExportPage />} />
      </Route>
    </Routes>
  );
}
