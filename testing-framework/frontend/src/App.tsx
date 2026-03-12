import { Layout, Menu, Typography } from "antd";
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

const { Sider, Content } = Layout;

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

  const menuItems = navItems.map(({ key, icon: Icon, label }) => ({
    key,
    icon: <Icon />,
    label,
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={200}
        style={{
          background: "#001529",
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", paddingLeft: 24 }}>
          <Typography.Title level={5} style={{ margin: 0, color: "#fff" }}>
            测试平台
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Content style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 8, minHeight: "100%" }}>
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
        <Route path="test-points" element={<TestPointList />} />
        <Route path="test-points/:id" element={<TestPointDetail />} />
        <Route path="test-cases" element={<TestCaseList />} />
        <Route path="test-cases/:id" element={<TestCaseDetail />} />
        <Route path="export" element={<ExportPage />} />
      </Route>
    </Routes>
  );
}
