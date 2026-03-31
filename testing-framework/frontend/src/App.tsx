import { Layout, Menu, Typography } from "antd";
import { Outlet, useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  DashboardOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  ExportOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import Dashboard from "./pages/Dashboard";
import RequirementList from "./pages/RequirementList";
import RequirementDetail from "./pages/RequirementDetail";
import TestCaseList from "./pages/TestCaseList";
import TestCaseDetail from "./pages/TestCaseDetail";
import ExportPage from "./pages/ExportPage";
import ApiRegressionEnvironments from "./pages/ApiRegressionEnvironments";
import ApiRegressionEndpoints from "./pages/ApiRegressionEndpoints";
import ApiRegressionCollections from "./pages/ApiRegressionCollections";
import ApiRegressionCollectionDetail from "./pages/ApiRegressionCollectionDetail";
import ApiRegressionRuns from "./pages/ApiRegressionRuns";
import ApiRegressionRunDetail from "./pages/ApiRegressionRunDetail";
import ApiRegressionSchedules from "./pages/ApiRegressionSchedules";

const { Sider, Content } = Layout;

const API_TEST_PREFIXES = [
  "/api-tests/environments",
  "/api-tests/endpoints",
  "/api-tests/collections",
  "/api-tests/runs",
  "/api-tests/schedules",
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    location.pathname.startsWith("/api-tests") ? ["api-tests-group"] : []
  );

  const selectedKeys = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/api-tests")) {
      for (const prefix of API_TEST_PREFIXES) {
        if (p === prefix || p.startsWith(prefix + "/")) return [prefix];
      }
      return ["/api-tests/environments"];
    }
    const top = p === "/" ? "/" : "/" + (p.split("/")[1] || "");
    return [top];
  }, [location.pathname]);

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: "首页" },
    { key: "/requirements", icon: <FileTextOutlined />, label: "需求" },
    { key: "/test-cases", icon: <UnorderedListOutlined />, label: "测试用例" },
    { key: "/export", icon: <ExportOutlined />, label: "导出" },
    {
      key: "api-tests-group",
      icon: <ApiOutlined />,
      label: "接口测试",
      children: [
        { key: "/api-tests/environments", label: "环境" },
        { key: "/api-tests/endpoints", label: "接口清单" },
        { key: "/api-tests/collections", label: "集合" },
        { key: "/api-tests/runs", label: "运行历史" },
        { key: "/api-tests/schedules", label: "定时任务" },
      ],
    },
  ];

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
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          onClick={({ key }) => {
            if (!String(key).includes("group")) navigate(key);
          }}
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
        <Route path="api-tests/environments" element={<ApiRegressionEnvironments />} />
        <Route path="api-tests/endpoints" element={<ApiRegressionEndpoints />} />
        <Route path="api-tests/collections" element={<ApiRegressionCollections />} />
        <Route path="api-tests/collections/:id" element={<ApiRegressionCollectionDetail />} />
        <Route path="api-tests/runs" element={<ApiRegressionRuns />} />
        <Route path="api-tests/runs/:id" element={<ApiRegressionRunDetail />} />
        <Route path="api-tests/schedules" element={<ApiRegressionSchedules />} />
      </Route>
    </Routes>
  );
}
